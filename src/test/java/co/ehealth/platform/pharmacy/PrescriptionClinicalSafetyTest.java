package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicContext;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitService;
import org.junit.jupiter.api.*;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PrescriptionClinicalSafetyTest {
    private final UUID clinicId = UUID.randomUUID();
    @BeforeEach void clinic() { ClinicContext.set(clinicId); }
    @AfterEach void clear() { ClinicContext.clear(); }
    @Test
    void blocks_high_severity_prescribing_until_a_reasoned_override_is_given() {
        UUID patientId = UUID.randomUUID(), userId = UUID.randomUUID();
        Visit visit = mock(Visit.class); Patient patient = mock(Patient.class);
        when(visit.getPatientId()).thenReturn(patientId); when(visit.getId()).thenReturn(UUID.randomUUID()); when(visit.getFacilityId()).thenReturn(clinicId);
        when(patient.getMpiNumber()).thenReturn("MPI-0000001");
        VisitService visits = mock(VisitService.class); when(visits.get(any())).thenReturn(visit);
        PatientService patients = mock(PatientService.class); when(patients.get(patientId)).thenReturn(patient);
        StaffService staff = mock(StaffService.class); when(staff.getLicenseStatus(userId)).thenReturn(new StaffService.LicenseStatus(true, true));
        ClinicalSafetyService safety = mock(ClinicalSafetyService.class);
        when(safety.check(eq(patientId), anyList())).thenReturn(List.of(new ClinicalSafetyAlert(UUID.randomUUID(),
                ClinicalRuleType.DRUG_INTERACTION, ClinicalSeverity.HIGH, "Bleeding risk", "Warfarin", "Ibuprofen")));
        PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
        AuditLogService audit = mock(AuditLogService.class);
        PrescriptionService service = new PrescriptionService(prescriptions, mock(PrescriptionItemRepository.class),
                mock(DispensingRecordRepository.class), mock(StockMovementRepository.class), visits, patients,
                mock(ManualVerificationCaseRepository.class), mock(ManualVerificationService.class), staff, audit,
                Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), mock(PermissionService.class), safety);
        var items = List.of(new PrescriptionService.PrescriptionItemInput("Warfarin", "5mg", 1),
                new PrescriptionService.PrescriptionItemInput("Ibuprofen", "200mg", 1));

        assertThatThrownBy(() -> service.create(new PrescriptionService.CreatePrescriptionCommand(UUID.randomUUID(), items), userId))
                .isInstanceOf(ClinicalSafetyBlockedException.class);
        verify(prescriptions, never()).save(any());

        when(prescriptions.nextSerialSequenceValue()).thenReturn(1L);
        // Saving is deliberately made to fail after safety validation: this isolates the assertion
        // that the override is audit-recorded before any prescription state is committed.
        doThrow(new RuntimeException("stop after audit")).when(prescriptions).save(any(Prescription.class));
        assertThatThrownBy(() -> service.create(new PrescriptionService.CreatePrescriptionCommand(UUID.randomUUID(), items,
                "Benefits outweigh risk"), userId)).isInstanceOf(RuntimeException.class);
        verify(audit).append(eq(userId), eq(clinicId), eq("CLINICAL_ALERT_OVERRIDDEN"), eq("ClinicalSafetyAlert"),
                eq(patientId.toString()), isNull(), contains("Benefits outweigh risk"));
        verify(prescriptions).save(any(Prescription.class));
    }
}
