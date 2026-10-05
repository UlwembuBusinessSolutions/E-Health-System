package co.ehealth.platform.patient;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OfflineRegistrationProcessor {

    private final OfflineSyncRecordRepository syncRepo;
    private final PatientRepository patientRepository;
    private final PatientService patientService;
    private final Validator validator;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public OfflineRegistrationProcessor(OfflineSyncRecordRepository syncRepo, PatientRepository patientRepository,
            PatientService patientService, Validator validator,
            ObjectMapper objectMapper, Clock clock) {
        this.syncRepo = syncRepo;
        this.patientRepository = patientRepository;
        this.patientService = patientService;
        this.validator = validator;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    // OfflineSyncService guarantees item, clientRecordId and data are
    // non-null before calling this.
    @Transactional
    public OfflineSyncService.SyncResult process(OfflineSyncService.SyncItem item, String deviceId, UUID userId) {
        Instant now = clock.instant();
        Instant capturedAt = item.capturedAt() != null ? item.capturedAt() : now;
        String payload = toJson(item.data());

        // Idempotent replay: SYNCED / CONFLICT / RESOLVED return their
        // original outcome untouched. Only REJECTED may be reprocessed (the
        // device corrected and resent it).
        Optional<OfflineSyncRecord> existing = syncRepo.findByClientRecordId(item.clientRecordId());
        if (existing.isPresent() && existing.get().getStatus() != OfflineSyncStatus.REJECTED) {
            return toResult(existing.get());
        }

        OfflineSyncRecord record;
        if (existing.isPresent()) {
            record = existing.get();
            record.resubmit(payload, capturedAt, userId, now);
        } else {
            record = new OfflineSyncRecord(item.clientRecordId(), deviceId, payload, capturedAt, userId, now);
        }

        // Validation: a permanent failure, surfaced to the device for correction.
        String problem = validate(item, now);
        if (problem != null) {
            record.markRejected(problem);
            syncRepo.save(record);
            return toResult(record);
        }

        // Conflict pre-check. Deliberately not relying on
        // DuplicateFieldException: a conflict is an outcome to record, not an
        // exception that would mark this transaction rollback-only and lose it.
        Optional<Patient> clash = patientRepository.findByIdNumber(item.data().idNumber());
        if (clash.isPresent()) {
            Patient other = clash.get();
            record.markConflict(OfflineConflictType.ID_NUMBER_EXISTS, other.getId(),
                    "A patient with this ID number already exists (" + other.getMpiNumber() + ")."
                            + (other.isArchived() ? " That record is archived." : ""));
            syncRepo.save(record);
            return toResult(record);
        }

        // Happy path: the exact same registration logic as online.
        PatientController.RegisterPatientRequest d = item.data();
        Patient patient = patientService.registerOffline(
                new PatientService.RegisterPatientCommand(d.firstName(), d.lastName(), d.idNumber(), d.address(),
                        d.contactNumber(), d.email(), d.medicalAidProvider(), d.medicalAidNumber(),
                        d.passportNumber(), d.passportExpiry()),
                userId, capturedAt);
        record.markSynced(patient.getId());
        syncRepo.save(record);
        return toResult(record);
    }

    private String validate(OfflineSyncService.SyncItem item, Instant now) {
        if (item.capturedAt() == null) {
            return "Capture time is required.";
        }
        if (item.capturedAt().isAfter(now.plusSeconds(300))) {
            return "Capture time cannot be in the future.";
        }
        var violations = validator.validate(item.data());
        if (!violations.isEmpty()) {
            return violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .sorted().collect(Collectors.joining("; "));
        }
        try {
            SouthAfricanIdNumber.parse(item.data().idNumber());
        } catch (InvalidIdNumberException e) {
            return e.getMessage();
        }
        return null;
    }

    private OfflineSyncService.SyncResult toResult(OfflineSyncRecord r) {
        String mpi = r.getPatientId() == null ? null
                : patientRepository.findById(r.getPatientId()).map(Patient::getMpiNumber).orElse(null);
        UUID conflictId = r.getStatus() == OfflineSyncStatus.CONFLICT ? r.getId() : null;
        return new OfflineSyncService.SyncResult(r.getClientRecordId(), r.getStatus(), r.getPatientId(), mpi,
                conflictId, r.getMessage());
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise offline payload", e);
        }
    }
}