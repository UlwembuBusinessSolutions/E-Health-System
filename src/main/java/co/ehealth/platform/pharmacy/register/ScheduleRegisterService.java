package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Manual register entries (receiving, destroying, losing, returning, an
// opening balance, or a hand-written dispense). There is deliberately no
// update or delete here: the register only ever grows.
@Service
public class ScheduleRegisterService {

    public record NewEntryCommand(UUID facilityId, UUID productId, RegisterEntryKind kind, long quantity,
                                  String rxSerial, String patientName, String patientIdRef,
                                  String prescriberName, String prescriberRegNo, String lotNumber,
                                  UUID witnessStaffId, String witnessPin, String reason) {
    }

    private static final int MIN_REASON_LENGTH = 3;

    private final ScheduledProductLookup scheduledProducts;
    private final WitnessVerifier witnessVerifier;
    private final ScheduleRegisterAppender appender;

    public ScheduleRegisterService(ScheduledProductLookup scheduledProducts, WitnessVerifier witnessVerifier,
                                   ScheduleRegisterAppender appender) {
        this.scheduledProducts = scheduledProducts;
        this.witnessVerifier = witnessVerifier;
        this.appender = appender;
    }

    @Transactional
    public ScheduleRegisterEntry record(NewEntryCommand command, UUID actorUserId, String actorName) {
        requireLotNumber(command.lotNumber());
        String reason = reasonToRecord(command.kind(), command.reason());
        DrugSchedule schedule = scheduledProducts.scheduleOf(command.productId())
                .orElseThrow(() -> new InvalidRegisterEntryException(
                        "This medicine is not a Schedule 5 or 6 product, so it does not belong in the register."));
        RegisterStaff witness = schedule.requiresWitness()
                ? witnessVerifier.verify(actorUserId, command.witnessStaffId(), command.witnessPin())
                : null;

        return appender.append(new RegisterEntryDetails(command.facilityId(), command.productId(), command.kind(),
                command.quantity(), command.rxSerial(), command.patientName(), command.patientIdRef(),
                command.prescriberName(), command.prescriberRegNo(), command.lotNumber().trim(),
                new RegisterStaff(actorUserId, actorName), witness, null, reason));
    }

    // Destroying or losing scheduled stock must be explained; for the other
    // kinds a reason is optional and kept only when one was given.
    private String reasonToRecord(RegisterEntryKind kind, String reason) {
        String trimmed = reason == null ? "" : reason.trim();
        if (kind.requiresReason() && trimmed.length() < MIN_REASON_LENGTH) {
            throw new InvalidRegisterEntryException("Say why this medicine was " + kind.name().toLowerCase()
                    + " (at least " + MIN_REASON_LENGTH + " characters).");
        }
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void requireLotNumber(String lotNumber) {
        if (lotNumber == null || lotNumber.isBlank()) {
            throw new InvalidRegisterEntryException("Enter the lot number.");
        }
    }
}
