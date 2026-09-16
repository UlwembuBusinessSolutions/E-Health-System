package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicContext;
import co.ehealth.platform.identity.PermissionService;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PrescriptionQueryServiceTest {
    private final UUID clinic = UUID.randomUUID();
    @BeforeEach void selectClinic() { ClinicContext.set(clinic); }
    @AfterEach void clearClinic() { ClinicContext.clear(); }

    @Test
    void raises_a_query_with_an_early_warning_and_holds_the_prescription() {
        UUID prescriptionId = UUID.randomUUID(), pharmacist = UUID.randomUUID(), prescriber = UUID.randomUUID();
        Prescription prescription = new Prescription("RX-0000001", UUID.randomUUID(), UUID.randomUUID(), clinic, prescriber, Instant.EPOCH);
        PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
        when(prescriptions.findByIdAndFacilityId(prescriptionId, clinic)).thenReturn(Optional.of(prescription));
        PrescriptionItemRepository items = mock(PrescriptionItemRepository.class);
        when(items.findByPrescriptionId(prescriptionId)).thenReturn(List.of(new PrescriptionItem(prescriptionId, "Warfarin", "5mg", 1)));
        ClinicalSafetyService safety = mock(ClinicalSafetyService.class);
        when(safety.check(any(), anyList())).thenReturn(List.of(new ClinicalSafetyAlert(UUID.randomUUID(), ClinicalRuleType.DRUG_INTERACTION, ClinicalSeverity.HIGH, "Guideline deviation", "Warfarin", "Ibuprofen")));
        PrescriptionQueryRepository queries = mock(PrescriptionQueryRepository.class);
        when(queries.save(any())).thenAnswer(invocation -> withId(invocation.getArgument(0)));
        PrescriptionQueryService service = service(prescriptions, items, queries, safety);

        PrescriptionQuery query = service.raise(prescriptionId, "Please confirm the dose.", pharmacist);

        assertThat(prescription.getStatus()).isEqualTo(PrescriptionStatus.HELD);
        assertThat(query.getGuidelineWarning()).isEqualTo("Guideline deviation");
        verify(prescriptions).save(prescription);
    }

    @Test
    void only_the_original_prescriber_can_reply_and_a_reply_returns_the_item_to_queue() {
        UUID prescriptionId = UUID.randomUUID(), pharmacist = UUID.randomUUID(), prescriber = UUID.randomUUID();
        Prescription prescription = new Prescription("RX-0000002", UUID.randomUUID(), UUID.randomUUID(), clinic, prescriber, Instant.EPOCH);
        prescription.hold();
        PrescriptionQuery query = new PrescriptionQuery(prescriptionId, clinic, pharmacist, prescriber, "Confirm dose", null, Instant.EPOCH);
        PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
        when(prescriptions.findByIdAndFacilityId(prescriptionId, clinic)).thenReturn(Optional.of(prescription));
        PrescriptionQueryRepository queries = mock(PrescriptionQueryRepository.class);
        when(queries.findByIdAndFacilityId(any(), eq(clinic))).thenReturn(Optional.of(query));
        PrescriptionQueryService service = service(prescriptions, mock(PrescriptionItemRepository.class), queries, mock(ClinicalSafetyService.class));

        service.respond(UUID.randomUUID(), "Dose confirmed.", prescriber);

        assertThat(query.getStatus()).isEqualTo(PrescriptionQueryStatus.RESPONDED);
        assertThat(prescription.getStatus()).isEqualTo(PrescriptionStatus.PENDING);
        verify(prescriptions).save(prescription);
    }

    private PrescriptionQueryService service(PrescriptionRepository prescriptions, PrescriptionItemRepository items,
                                              PrescriptionQueryRepository queries, ClinicalSafetyService safety) {
        PrescriptionQueryNotificationRepository notifications = mock(PrescriptionQueryNotificationRepository.class);
        when(notifications.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        return new PrescriptionQueryService(prescriptions, items, queries, notifications,
                safety, mock(PermissionService.class), mock(AuditLogService.class), Clock.fixed(Instant.EPOCH, ZoneOffset.UTC),
                new PrescriptionQueryLiveNotifier());
    }

    private PrescriptionQuery withId(PrescriptionQuery query) {
        if (query.getId() == null) ReflectionTestUtils.setField(query, "id", UUID.randomUUID());
        return query;
    }
}
