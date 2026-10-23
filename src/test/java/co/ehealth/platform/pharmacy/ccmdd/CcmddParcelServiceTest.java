package co.ehealth.platform.pharmacy.ccmdd;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.patient.PatientRepository;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionRepository;
import co.ehealth.platform.pharmacy.PrescriptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CcmddParcelServiceTest {
    private final CcmddParcelRepository parcels = mock(CcmddParcelRepository.class);
    private final CcmddPickupPointRepository points = mock(CcmddPickupPointRepository.class);
    private final PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
    private final PatientRepository patients = mock(PatientRepository.class);
    private final AuditLogService audit = mock(AuditLogService.class);
    private final EmailService email = mock(EmailService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-21T09:00:00Z"), ZoneOffset.UTC);
    private CcmddParcelService service;
    private UUID facility;

    @BeforeEach void setUp() {
        service = new CcmddParcelService(parcels, points, prescriptions, patients, audit, email, clock, 7);
        facility = UUID.randomUUID();
    }
    @Test void onlyDispensedPrescriptionsMayBeDispatched() {
        Prescription rx = mock(Prescription.class);
        when(rx.getFacilityId()).thenReturn(facility);
        when(rx.getStatus()).thenReturn(PrescriptionStatus.PENDING);
        when(prescriptions.findBySerialNumber("RX-01")).thenReturn(Optional.of(rx));
        assertThrows(ResponseStatusException.class,
                () -> service.dispatch(facility, "RX-01", UUID.randomUUID(), 7, UUID.randomUUID()));
        verifyNoInteractions(points, email);
    }
    @Test void tracingAppearsOnlyAfterDeadlineAndDisappearsOnCollection() {
        UUID patientId = UUID.randomUUID();
        CcmddPickupPoint point = new CcmddPickupPoint("SYNCH-1");
        point.update("Pickup", "Gauteng", "", "Soweto", "", null, true, clock.instant());
        CcmddParcel parcel = new CcmddParcel(UUID.randomUUID(), facility, patientId, point,
                7, UUID.randomUUID(), clock.instant().minus(Duration.ofDays(8)));
        when(parcels.findByFacilityIdAndStatusInAndTraceDueAtLessThanEqualOrderByTraceDueAtAsc(
                eq(facility), eq(List.of("DISPATCHED", "READY")), any(Instant.class)))
                .thenReturn(List.of(parcel));
        var patient = mock(co.ehealth.platform.patient.Patient.class);
        when(patient.getFirstName()).thenReturn("Test");
        when(patient.getLastName()).thenReturn("Person");
        when(patient.getMpiNumber()).thenReturn("MPI-1");
        when(patients.findById(patientId)).thenReturn(Optional.of(patient));
        assertTrue(service.list(facility, true).getFirst().overdue());
        parcel.collected(clock.instant());
        // Collected parcel is no longer part of an overdue-only repository result.
        when(parcels.findByFacilityIdAndStatusInAndTraceDueAtLessThanEqualOrderByTraceDueAtAsc(
                eq(facility), eq(List.of("DISPATCHED", "READY")), any(Instant.class))).thenReturn(List.of());
        assertTrue(service.list(facility, true).isEmpty());
    }
    @Test void refusesTrackingPeriodOutsideConfigurationBounds() {
        assertThrows(ResponseStatusException.class,
                () -> service.dispatch(facility, "RX-01", UUID.randomUUID(), 0, UUID.randomUUID()));
    }
}
