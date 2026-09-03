package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PrescriptionServicePatientIdentityTest {

    @Test
    void refuses_to_create_a_prescription_when_the_visit_patient_has_no_valid_mpi() {
        UUID patientId = UUID.randomUUID();
        Visit visit = mock(Visit.class);
        Patient patient = mock(Patient.class);
        when(visit.getPatientId()).thenReturn(patientId);
        when(patient.getMpiNumber()).thenReturn("unknown");

        VisitService visits = mock(VisitService.class);
        PatientService patients = mock(PatientService.class);
        PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
        StaffService staff = licensedStaff(true, true);
        when(visits.get(any())).thenReturn(visit);
        when(patients.get(patientId)).thenReturn(patient);

        PrescriptionService service = service(prescriptions, visits, patients, staff,
                mock(DispensingRecordRepository.class), mock(StockMovementRepository.class),
                mock(ManualVerificationService.class));

        assertThatThrownBy(() -> service.create(new PrescriptionService.CreatePrescriptionCommand(
                UUID.randomUUID(), List.of()), UUID.randomUUID()))
                .isInstanceOf(PatientIdentityNotVerifiedException.class);
        verify(prescriptions, never()).save(any());
    }

    @Test
    void routes_an_unidentified_patient_to_manual_verification_without_dispensing() {
        UUID prescriptionId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        Prescription prescription = mock(Prescription.class);
        Patient patient = mock(Patient.class);
        PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
        DispensingRecordRepository records = mock(DispensingRecordRepository.class);
        StockMovementRepository stockMovements = mock(StockMovementRepository.class);
        ManualVerificationService manualVerification = mock(ManualVerificationService.class);
        PatientService patients = mock(PatientService.class);
        when(prescription.getId()).thenReturn(prescriptionId);
        when(prescription.getPatientId()).thenReturn(patientId);
        when(prescription.getStatus()).thenReturn(PrescriptionStatus.PENDING);
        when(patient.getMpiNumber()).thenReturn(null);
        when(prescriptions.findById(prescriptionId)).thenReturn(Optional.of(prescription));
        when(patients.get(patientId)).thenReturn(patient);
        PrescriptionService service = service(prescriptions, mock(VisitService.class), patients,
                licensedStaff(true, true), records, stockMovements, manualVerification);

        assertThatThrownBy(() -> service.dispense(prescriptionId, UUID.randomUUID()))
                .isInstanceOf(PatientIdentityNotVerifiedException.class);
        verify(records, never()).save(any());
        verify(prescription, never()).markDispensed();
        verify(manualVerification).route(org.mockito.ArgumentMatchers.same(prescription), any(), any(), any());
    }

    @Test
    void carries_patient_id_and_mpi_into_the_dispensing_record() {
        UUID prescriptionId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        Prescription prescription = mock(Prescription.class);
        Patient patient = mock(Patient.class);
        PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
        DispensingRecordRepository records = mock(DispensingRecordRepository.class);
        StockMovementRepository stockMovements = mock(StockMovementRepository.class);
        PrescriptionItem prescriptionItem = mock(PrescriptionItem.class);
        PrescriptionItemRepository items = mock(PrescriptionItemRepository.class);
        PatientService patients = mock(PatientService.class);
        when(prescription.getPatientId()).thenReturn(patientId);
        when(prescription.getFacilityId()).thenReturn(UUID.randomUUID());
        when(prescription.getStatus()).thenReturn(PrescriptionStatus.PENDING);
        when(prescriptions.findById(prescriptionId)).thenReturn(Optional.of(prescription));
        when(patient.getId()).thenReturn(patientId);
        when(patient.getMpiNumber()).thenReturn("MPI-0000001");
        when(patients.get(patientId)).thenReturn(patient);
        when(prescriptionItem.getDrugName()).thenReturn("Amoxicillin");
        when(prescriptionItem.getQuantity()).thenReturn(12);
        when(items.findByPrescriptionId(prescriptionId)).thenReturn(List.of(prescriptionItem));

        PrescriptionService service = serviceWithItems(prescriptions, items, mock(VisitService.class), patients,
                licensedStaff(true, true), records, stockMovements, mock(ManualVerificationService.class));
        service.dispense(prescriptionId, UUID.randomUUID());

        ArgumentCaptor<DispensingRecord> saved = ArgumentCaptor.forClass(DispensingRecord.class);
        verify(records).save(saved.capture());
        assertThat(saved.getValue().getPatientId()).isEqualTo(patientId);
        assertThat(saved.getValue().getPatientMpi()).isEqualTo("MPI-0000001");
        ArgumentCaptor<StockMovement> movement = ArgumentCaptor.forClass(StockMovement.class);
        verify(stockMovements).save(movement.capture());
        assertThat(movement.getValue().getPatientId()).isEqualTo(patientId);
        assertThat(movement.getValue().getPatientMpi()).isEqualTo("MPI-0000001");
    }

    private PrescriptionService service(PrescriptionRepository prescriptions, VisitService visits,
                                        PatientService patients, StaffService staff, DispensingRecordRepository records,
                                        StockMovementRepository stockMovements,
                                        ManualVerificationService manualVerification) {
        return new PrescriptionService(prescriptions, mock(PrescriptionItemRepository.class), records, stockMovements, visits,
                patients, mock(ManualVerificationCaseRepository.class), manualVerification, staff,
                mock(AuditLogService.class), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC),
                mock(PermissionService.class));
    }

    private PrescriptionService serviceWithItems(PrescriptionRepository prescriptions, PrescriptionItemRepository items,
                                                 VisitService visits, PatientService patients, StaffService staff,
                                                 DispensingRecordRepository records, StockMovementRepository stockMovements,
                                                 ManualVerificationService manualVerification) {
        return new PrescriptionService(prescriptions, items, records, stockMovements, visits, patients,
                mock(ManualVerificationCaseRepository.class), manualVerification, staff, mock(AuditLogService.class),
                Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), mock(PermissionService.class));
    }

    private StaffService licensedStaff(boolean canPrescribe, boolean canDispense) {
        StaffService staff = mock(StaffService.class);
        when(staff.getLicenseStatus(any())).thenReturn(new StaffService.LicenseStatus(canPrescribe, canDispense));
        return staff;
    }
}
