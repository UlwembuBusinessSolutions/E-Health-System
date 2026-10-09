package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.NotAuthorizedException;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class OfflineSyncService {

    static final int MAX_BATCH_SIZE = 50;
    private static final Logger log = LoggerFactory.getLogger(OfflineSyncService.class);

    private final OfflineRegistrationProcessor processor;
    private final OfflineSyncRecordRepository syncRepo;
    private final PatientRepository patientRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public OfflineSyncService(OfflineRegistrationProcessor processor, OfflineSyncRecordRepository syncRepo,
            PatientRepository patientRepository, PatientService patientService,
            PermissionService permissionService, AuditLogService auditLogService,
            ObjectMapper objectMapper, Clock clock) {
        this.processor = processor;
        this.syncRepo = syncRepo;
        this.patientRepository = patientRepository;
        this.patientService = patientService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    // NOT @Transactional: each record commits in its own transaction inside
    // OfflineRegistrationProcessor, so one bad record can't roll back the rest.
    public List<SyncResult> sync(String deviceId, List<SyncItem> items, UUID userId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        if (!StringUtils.hasText(deviceId) || deviceId.length() > 100) {
            throw new InvalidOfflineSyncException("A device id of up to 100 characters is required.");
        }
        if (items == null || items.isEmpty() || items.size() > MAX_BATCH_SIZE) {
            throw new InvalidOfflineSyncException("Send between 1 and " + MAX_BATCH_SIZE + " records per sync.");
        }
        // Sequential, in device capture order, so two offline registrations of
        // the same person conflict with each other deterministically.
        List<SyncResult> results = new ArrayList<>(items.size());
        for (SyncItem item : items) {
            results.add(processOne(item, deviceId, userId));
        }
        return results;
    }

    private SyncResult processOne(SyncItem item, String deviceId, UUID userId) {
        // Can't even be identified, so nothing is persisted.
        if (item == null || item.clientRecordId() == null || item.data() == null) {
            return new SyncResult(item == null ? null : item.clientRecordId(), OfflineSyncStatus.REJECTED,
                    null, null, null, "Record is malformed.");
        }
        try {
            return processor.process(item, deviceId, userId);
        } catch (DataIntegrityViolationException | DuplicateFieldException race) {
            // Lost a race on client_record_id or id_number. The pre-checks will now see the
            // winner.
            try {
                return processor.process(item, deviceId, userId);
            } catch (NotAuthorizedException forbidden) {
                throw forbidden;
            } catch (RuntimeException second) {
                return retryLater(item, second);
            }
        } catch (NotAuthorizedException forbidden) {
            throw forbidden; // the whole request is forbidden, not a per-record problem
        } catch (RuntimeException e) {
            return retryLater(item, e);
        }
    }

    // Transient or unexpected: nothing persisted, so the device keeps the record
    // pending.
    private SyncResult retryLater(SyncItem item, RuntimeException e) {
        log.error("Offline sync failed for clientRecordId {}", item.clientRecordId(), e);
        return new SyncResult(item.clientRecordId(), OfflineSyncStatus.RETRY_LATER, null, null, null,
                "Temporary server problem; will retry.");
    }

    public List<OfflineSyncRecord> listOpenIssues() {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        return syncRepo.findByStatusInOrderByReceivedAtAsc(
                List.of(OfflineSyncStatus.CONFLICT, OfflineSyncStatus.REJECTED));
    }

    // Reached only through /api/v1/admin/** (ORG_ADMIN). APPLY_OFFLINE
    // overwrites demographics, which is admin-only elsewhere in this codebase
    // (PatientController.update()).
    @Transactional
    public OfflineSyncRecord resolve(UUID syncRecordId, SyncResolution resolution, String reason, UUID userId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        if (resolution == null || !StringUtils.hasText(reason)) {
            throw new InvalidOfflineSyncException("A resolution and a reason are required.");
        }
        OfflineSyncRecord record = syncRepo.findById(syncRecordId)
                .orElseThrow(OfflineSyncRecordNotFoundException::new);
        if (record.getStatus() != OfflineSyncStatus.CONFLICT) {
            throw new OfflineSyncStateException("Only an open conflict can be resolved.");
        }
        UUID existingId = record.getConflictingPatientId();
        Patient existing = patientRepository.findById(existingId).orElseThrow(PatientNotFoundException::new);

        if (resolution == SyncResolution.APPLY_OFFLINE) {
            PatientController.RegisterPatientRequest d = readPayload(record);
            // Offline values win only where non-blank: a field the nurse
            // never captured must not erase what the server already holds.
            // Goes through update(): field history, audit, archived-patient guard.
            patientService.update(existingId, new PatientService.UpdatePatientCommand(
                    pick(d.firstName(), existing.getFirstName()),
                    pick(d.lastName(), existing.getLastName()),
                    pick(d.address(), existing.getAddress()),
                    pick(d.contactNumber(), existing.getContactNumber()),
                    pick(d.email(), existing.getEmail()),
                    pick(d.medicalAidProvider(), existing.getMedicalAidProvider()),
                    pick(d.medicalAidNumber(), existing.getMedicalAidNumber()),
                    pick(d.passportNumber(), existing.getPassportNumber()),
                    d.passportExpiry() != null ? d.passportExpiry() : existing.getPassportExpiry(),
                    "Offline sync conflict resolution: " + reason), userId);
        }

        Instant now = clock.instant();
        record.resolve(resolution, reason, existingId, userId, now);
        syncRepo.save(record);
        auditLogService.append(userId, null, "OFFLINE_SYNC_CONFLICT_RESOLVED", "OfflineSyncRecord",
                record.getId().toString(), null, null);
        return record;
    }

    public PatientController.RegisterPatientRequest readPayload(OfflineSyncRecord record) {
        try {
            return objectMapper.readValue(record.getPayload(), PatientController.RegisterPatientRequest.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored offline payload is unreadable", e);
        }
    }

    private static String pick(String offline, String existing) {
        return StringUtils.hasText(offline) ? offline : existing;
    }

    public record SyncItem(UUID clientRecordId, Instant capturedAt, PatientController.RegisterPatientRequest data) {
    }

    public record SyncResult(UUID clientRecordId, OfflineSyncStatus status, UUID patientId, String mpiNumber,
            UUID conflictId, String message) {
    }
}