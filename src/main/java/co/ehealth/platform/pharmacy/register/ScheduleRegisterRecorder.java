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

    private final ScheduledProductLookup scheduledProducts;
    private final ScheduleRegisterAppender appender;
    private final UserRepository userRepository;

    public ScheduleRegisterRecorder(ScheduledProductLookup scheduledProducts, ScheduleRegisterAppender appender,
                                    UserRepository userRepository) {
        this.scheduledProducts = scheduledProducts;
        this.appender = appender;
        this.userRepository = userRepository;
    }

    @Transactional
    public void recordDispense(UUID facilityId, UUID productId, String rxSerial, String patientName,
                               String patientIdRef, String prescriberName, String prescriberRegNo, long quantity,
                               String lotNumber, UUID dispensedBy, UUID ledgerTransactionId) {
        if (scheduledProducts.scheduleOf(productId).isEmpty()) {
            return;
        }
        User dispenser = userRepository.findById(dispensedBy).orElseThrow();
        RegisterStaff actor = new RegisterStaff(dispenser.getId(),
                dispenser.getFirstName() + " " + dispenser.getLastName());

        appender.append(new RegisterEntryDetails(facilityId, productId, RegisterEntryKind.DISPENSED, quantity,
                rxSerial, patientName, patientIdRef, prescriberName, prescriberRegNo, lotNumber, actor, null,
                ledgerTransactionId));
    }
}
