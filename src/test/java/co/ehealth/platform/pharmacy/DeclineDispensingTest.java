package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.*;
import co.ehealth.platform.facility.*;
import co.ehealth.platform.identity.*;
import co.ehealth.platform.patient.*;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DeclineDispensingTest {
    PrescriptionSupplyRepository supplies = mock(PrescriptionSupplyRepository.class);
    PrescriptionRepository prescriptions = mock(PrescriptionRepository.class);
    PrescriptionItemRepository items = mock(PrescriptionItemRepository.class);
    FacilityRepository facilities = mock(FacilityRepository.class);
    PermissionService permissions = mock(PermissionService.class);
    StaffService staff = mock(StaffService.class);
    UserRepository users = mock(UserRepository.class);
    OrganizationRepository organizations = mock(OrganizationRepository.class);
    PrescriberMessageRepository messages = mock(PrescriberMessageRepository.class);
    EmailService email = mock(EmailService.class);
    AuditLogService audit = mock(AuditLogService.class);
    PatientRepository patients = mock(PatientRepository.class);
    Clock clock = Clock.fixed(Instant.parse("2026-10-01T22:30:00Z"), ZoneOffset.UTC);
    PrescriptionSafetyService service = new PrescriptionSafetyService(supplies, prescriptions, items, facilities,
            permissions, staff, users, organizations, messages, email, audit, clock, patients);
    UUID actor = UUID.randomUUID(), product = UUID.randomUUID();
    Prescription p = new Prescription("RX-1", UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), clock.instant());
    PrescriptionItem item;

    @BeforeEach void setup() {
        TenantContext.setCurrentTenant("tenant_test");
        ReflectionTestUtils.setField(p, "id", UUID.randomUUID());
        item = new PrescriptionItem(p.getId(), "Medicine", "Daily", 30);
        ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
        item.review(product, ClinicalCheckStatus.PASSED, "Reviewed", actor, clock.instant());
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(false, true));
        when(prescriptions.findForUpdate(p.getId())).thenReturn(Optional.of(p));
        when(items.findById(item.getId())).thenReturn(Optional.of(item));
        when(items.findByPrescriptionId(p.getId())).thenReturn(List.of(item));
        var facility = mock(Facility.class);
        when(facility.getTimezone()).thenReturn("Africa/Johannesburg");
        when(facilities.findById(p.getFacilityId())).thenReturn(Optional.of(facility));
        when(patients.findForDispensingUpdate(p.getPatientId())).thenReturn(Optional.of(mock(Patient.class)));
        var prescriber = mock(User.class);
        when(prescriber.getEmail()).thenReturn("prescriber@example.test");
        when(prescriber.getFirstName()).thenReturn("Doctor");
        when(users.findById(p.getPrescriberId())).thenReturn(Optional.of(prescriber));
        var sender = mock(User.class);
        when(sender.getFirstName()).thenReturn("Pharmacist"); when(sender.getLastName()).thenReturn("One");
        when(users.findById(actor)).thenReturn(Optional.of(sender));
        var organization = mock(Organization.class);
        when(organization.getDisplayName()).thenReturn("Test clinic group");
        when(organizations.findBySchemaName("tenant_test")).thenReturn(Optional.of(organization));
    }
    @AfterEach void cleanup() {
        TenantContext.clear();
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
    }
    PrescriptionStockService.DispenseCommand command(boolean acknowledged) {
        return new PrescriptionStockService.DispenseCommand(product, UUID.randomUUID(), UUID.randomUUID(), 7,
                LocalDate.of(2026, 10, 9), acknowledged);
    }

    @Test void declinePreservesPartialSupplyAndBlocksEveryMutation() {
        item.dispenseQuantity(7);
        service.decline(p.getId(), item.getId(), actor, DeclineReason.SUFFICIENT_MEDICATION, "Patient has supply at home");
        assertEquals(PrescriptionStatus.DECLINED, item.getStatus()); assertEquals(7, item.getDispensedQuantity());
        assertEquals(PrescriptionStatus.DECLINED, p.getStatus());
        assertEquals(actor, item.getDeclinedBy()); assertEquals(clock.instant(), item.getDeclinedAt());
        assertThrows(InvalidDispenseException.class, () -> item.dispenseQuantity(1));
        assertThrows(InvalidDispenseException.class, item::markOutOfStock);
        assertThrows(InvalidDispenseException.class, item::markDispensed);
        assertThrows(InvalidDispenseException.class, () -> item.review(product, ClinicalCheckStatus.PASSED, "Review", actor, clock.instant()));
        verify(messages).save(argThat(m -> m.getMessage().contains("SUFFICIENT_MEDICATION") && m.getMessage().contains("Previously supplied quantity: 7")));
        verify(audit).append(eq(actor), eq(p.getFacilityId()), eq("PRESCRIPTION_ITEM_DECLINED"), eq("PrescriptionItem"),
                eq(item.getId().toString()), contains("PARTIALLY_DISPENSED"), contains("SUFFICIENT_MEDICATION"));
        verify(email).sendPrescriberDeclineEmail(eq("prescriber@example.test"), eq("Doctor"), anyString(), anyString(), eq("RX-1"), contains("Patient has supply at home"));
    }
    @Test void reasonAndOtherExplanationAreMandatory() {
        assertThrows(InvalidDispenseException.class, () -> service.decline(p.getId(), item.getId(), actor, null, ""));
        assertThrows(InvalidDispenseException.class, () -> service.decline(p.getId(), item.getId(), actor, DeclineReason.OTHER, "  "));
        assertThrows(InvalidDispenseException.class, () -> service.decline(p.getId(), item.getId(), actor, DeclineReason.INTERACTION, "x".repeat(501)));
        assertEquals(PrescriptionStatus.PENDING, item.getStatus());
        verifyNoInteractions(messages, email, audit);
    }
    @Test void completedItemCannotBeDeclined() {
        item.dispenseQuantity(30);
        assertThrows(InvalidDispenseException.class, () -> service.decline(p.getId(), item.getId(), actor, DeclineReason.DUPLICATE_THERAPY, null));
        verifyNoInteractions(messages, email, audit);
    }
    @Test void repeatedDeclineDoesNotDuplicateNotificationOrAudit() {
        service.decline(p.getId(), item.getId(), actor, DeclineReason.DOSAGE_CONCERN, null);
        assertThrows(InvalidDispenseException.class, () -> service.decline(p.getId(), item.getId(), actor, DeclineReason.INTERACTION, null));
        verify(messages, times(1)).save(any()); verify(audit, times(1)).append(any(), any(), any(), any(), any(), any(), any());
        verify(email, times(1)).sendPrescriberDeclineEmail(any(), any(), any(), any(), any(), any());
    }
    @Test void unrelatedItemIsRejected() {
        ReflectionTestUtils.setField(item, "prescriptionId", UUID.randomUUID());
        assertThrows(PrescriptionItemNotFoundException.class, () -> service.decline(p.getId(), item.getId(), actor, DeclineReason.INTERACTION, null));
        verifyNoInteractions(messages, email, audit);
    }
    @Test void permissionAndLicenseAreRequired() {
        doThrow(new NotAuthorizedException(ModuleCode.PHRM, PermissionLevel.MANAGE)).when(permissions).requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        assertThrows(NotAuthorizedException.class, () -> service.decline(p.getId(), item.getId(), actor, DeclineReason.INTERACTION, null));
        reset(permissions);
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(true, false));
        assertThrows(NotLicensedException.class, () -> service.decline(p.getId(), item.getId(), actor, DeclineReason.INTERACTION, null));
        verifyNoInteractions(messages, email, audit);
    }
    @Test void emailOnlyRunsAfterCommit() {
        TransactionSynchronizationManager.initSynchronization();
        service.decline(p.getId(), item.getId(), actor, DeclineReason.INTERACTION, "Interaction");
        verifyNoInteractions(email);
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(email).sendPrescriberDeclineEmail(any(), any(), any(), any(), any(), any());
    }
    @Test void rollbackDoesNotSendEmail() {
        TransactionSynchronizationManager.initSynchronization();
        service.decline(p.getId(), item.getId(), actor, DeclineReason.INTERACTION, "Interaction");
        TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        verifyNoInteractions(email);
    }
    @Test void crossClinicSupplyWarnsWithDateAndFacilityAndRequiresAcknowledgement() {
        var other = new Prescription("RX-0", UUID.randomUUID(), p.getPatientId(), UUID.randomUUID(), p.getPrescriberId(), clock.instant());
        var previous = new PrescriptionItem(UUID.randomUUID(), "Medicine", "Daily", 30);
        ReflectionTestUtils.setField(previous, "id", UUID.randomUUID());
        previous.review(product, ClinicalCheckStatus.PASSED, "Review", actor, clock.instant());
        var supply = new PrescriptionSupply(other, previous, actor, clock.instant().minusSeconds(86400), LocalDate.of(2026, 10, 9), 7);
        var priorClinic = mock(Facility.class); when(priorClinic.getName()).thenReturn("Other clinic");
        when(facilities.findById(other.getFacilityId())).thenReturn(Optional.of(priorClinic));
        when(supplies.findByPatientIdAndProductIdAndSupplyUntilGreaterThanEqualOrderByDispensedAtDesc(p.getPatientId(), product, LocalDate.of(2026, 10, 2))).thenReturn(List.of(supply));
        var ex = assertThrows(DuplicateSupplyException.class, () -> service.checkSupply(p, item, command(false)));
        var warning = ex.getWarnings().getFirst(); assertEquals("Other clinic", warning.facilityName());
        assertEquals(supply.getDispensedAt(), warning.dispensedAt()); assertEquals(other.getFacilityId(), warning.facilityId());
        assertThrows(DuplicateSupplyException.class, () -> service.checkSupply(p, item, command(true)));
        var acknowledged = command(true);
        assertDoesNotThrow(() -> service.checkSupply(p, item, new PrescriptionStockService.DispenseCommand(
                acknowledged.productId(), acknowledged.batchId(), acknowledged.locationId(), acknowledged.quantity(),
                acknowledged.supplyUntil(), true, List.of(supply.getId()))));
        verify(patients, times(3)).findForDispensingUpdate(p.getPatientId());
    }
    @Test void continuationOfSameItemDoesNotWarn() {
        when(supplies.findByPatientIdAndProductIdAndSupplyUntilGreaterThanEqualOrderByDispensedAtDesc(any(), any(), any()))
                .thenReturn(List.of(new PrescriptionSupply(p, item, actor, clock.instant(), LocalDate.of(2026, 10, 9), 7)));
        assertTrue(service.warnings(p, item).isEmpty());
    }
    @Test void coverageDateIsRequiredAndUsesClinicTimezone() {
        var c = command(false);
        assertThrows(InvalidDispenseException.class, () -> service.checkSupply(p, item, new PrescriptionStockService.DispenseCommand(c.productId(), c.batchId(), c.locationId(), 7)));
        assertThrows(InvalidDispenseException.class, () -> service.checkSupply(p, item, new PrescriptionStockService.DispenseCommand(c.productId(), c.batchId(), c.locationId(), 7, LocalDate.of(2026, 10, 1), false)));
    }
    @Test void unknownHistoricalCoverageIsVisibleAndMustBeReviewed() {
        var history = mock(PrescriptionSupplyRepository.HistoricalSupply.class);
        when(history.getPrescriptionItemId()).thenReturn(UUID.randomUUID());
        when(history.getFacilityId()).thenReturn(p.getFacilityId());
        when(history.getDispensedAt()).thenReturn(clock.instant().minusSeconds(86400));
        when(history.getQuantity()).thenReturn(30);
        when(supplies.findHistoricalSupplies(p.getPatientId(), product, item.getDrugName())).thenReturn(List.of(history));
        var warning = service.warnings(p, item).getFirst(); assertNull(warning.supplyUntil()); assertEquals(30, warning.quantity());
        assertThrows(DuplicateSupplyException.class, () -> service.checkSupply(p, item, command(false)));
    }
    @Test void mixedPrescriptionKeepsPendingItemsInQueue() {
        item.decline(DeclineReason.CONTRAINDICATION, null, actor, clock.instant());
        var pending = new PrescriptionItem(p.getId(), "Another", "Daily", 10);
        p.recomputeStatus(List.of(item, pending)); assertEquals(PrescriptionStatus.PARTIALLY_DISPENSED, p.getStatus());
        pending.dispenseQuantity(10); p.recomputeStatus(List.of(item, pending)); assertEquals(PrescriptionStatus.DECLINED, p.getStatus());
    }
}
