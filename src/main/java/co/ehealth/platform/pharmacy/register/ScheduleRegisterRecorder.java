package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Called by dispensing, inside the dispensing transaction, so the register
// entry and the stock deduction succeed or fail together. Unscheduled
// products are ignored, which lets dispensing call this for every item
// without checking the schedule first.
@Service
public class ScheduleRegisterRecorder {

    private static final String DAMAGED_RETURN_REASON = "Damaged item returned by patient";

    private final ScheduledProductLookup scheduledProducts;
    private final ScheduleRegisterAppender appender;
    private final UserRepository userRepository;

    public ScheduleRegisterRecorder(ScheduledProductLookup scheduledProducts, ScheduleRegisterAppender appender,
                                    UserRepository userRepository) {
        this.scheduledProducts = scheduledProducts;
        this.appender = appender;
        this.userRepository = userRepository;
    }

    // witnessStaffId is a witness dispensing has already confirmed (password
    // checked); null when the medicine needs none.
    @Transactional
    public void recordDispense(UUID facilityId, UUID productId, String rxSerial, String patientName,
                               String patientIdRef, String prescriberName, String prescriberRegNo, long quantity,
                               String lotNumber, UUID dispensedBy, UUID ledgerTransactionId, UUID witnessStaffId) {
        if (scheduledProducts.scheduleOf(productId).isEmpty()) {
            return;
        }
        RegisterStaff witness = witnessStaffId == null ? null : staffMember(witnessStaffId);

        appender.append(new RegisterEntryDetails(facilityId, productId, RegisterEntryKind.DISPENSED, quantity,
                rxSerial, patientName, patientIdRef, prescriberName, prescriberRegNo, lotNumber,
                staffMember(dispensedBy), witness, ledgerTransactionId, null));
    }

    // A returned unit comes back into the register; if it cannot go back on
    // the shelf (damaged) it is destroyed straight away, mirroring the two
    // ledger entries dispensing posts for the same return.
    @Transactional
    public void recordReturn(UUID facilityId, UUID productId, String rxSerial, String patientName,
                             String patientIdRef, long quantity, String lotNumber, UUID recordedBy,
                             boolean restocked, UUID ledgerTransactionId) {
        if (scheduledProducts.scheduleOf(productId).isEmpty()) {
            return;
        }
        RegisterStaff actor = staffMember(recordedBy);

        appendReturnStep(RegisterEntryKind.RETURNED, facilityId, productId, rxSerial, patientName, patientIdRef,
                quantity, lotNumber, actor, ledgerTransactionId, null);
        if (!restocked) {
            appendReturnStep(RegisterEntryKind.DESTROYED, facilityId, productId, rxSerial, patientName,
                    patientIdRef, quantity, lotNumber, actor, ledgerTransactionId, DAMAGED_RETURN_REASON);
        }
    }

    private void appendReturnStep(RegisterEntryKind kind, UUID facilityId, UUID productId, String rxSerial,
                                  String patientName, String patientIdRef, long quantity, String lotNumber,
                                  RegisterStaff actor, UUID ledgerTransactionId, String reason) {
        appender.append(new RegisterEntryDetails(facilityId, productId, kind, quantity, rxSerial, patientName,
                patientIdRef, null, null, lotNumber, actor, null, ledgerTransactionId, reason));
    }

    private RegisterStaff staffMember(UUID userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return new RegisterStaff(user.getId(), user.getFirstName() + " " + user.getLastName());
    }
}
