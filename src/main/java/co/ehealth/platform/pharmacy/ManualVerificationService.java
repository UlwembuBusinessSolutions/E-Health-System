package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class ManualVerificationService {

    private final ManualVerificationCaseRepository manualVerificationCases;
    private final AuditLogService auditLogService;

    public ManualVerificationService(ManualVerificationCaseRepository manualVerificationCases,
                                     AuditLogService auditLogService) {
        this.manualVerificationCases = manualVerificationCases;
        this.auditLogService = auditLogService;
    }

    // This must commit independently: dispense() deliberately throws after
    // routing, which rolls back its transaction but must not lose the work item.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ManualVerificationCase route(Prescription prescription, UUID requestedByUserId, String reason,
                                        Instant createdAt) {
        return manualVerificationCases.findByPrescriptionId(prescription.getId()).orElseGet(() -> {
            ManualVerificationCase verificationCase = manualVerificationCases.save(new ManualVerificationCase(
                    prescription.getId(), prescription.getPatientId(), reason, createdAt));
            auditLogService.append(requestedByUserId, prescription.getFacilityId(),
                    "DISPENSING_MANUAL_VERIFICATION_REQUIRED", "ManualVerificationCase",
                    verificationCase.getId().toString(), null, null);
            return verificationCase;
        });
    }
}
