package co.ehealth.platform.pharmacy.integration;

import co.ehealth.platform.pharmacy.dispensing.ScheduleRegisterRecorder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Writes dispensing events into the append-only scheduled-medicines register.
// It joins the dispensing transaction, so a register failure rolls the whole
// dispense back and the register can never disagree with the stock.
//
// The bean is named explicitly because the register package has its own
// class called ScheduleRegisterRecorder (the one dispensing hands off to).
@Component("dispensingRegisterRecorder")
class DispensingRegisterAdapter implements ScheduleRegisterRecorder {

    private final co.ehealth.platform.pharmacy.register.ScheduleRegisterRecorder register;

    DispensingRegisterAdapter(co.ehealth.platform.pharmacy.register.ScheduleRegisterRecorder register) {
        this.register = register;
    }

    @Override
    @Transactional
    public void recordDispense(UUID facilityId, UUID productId, String rxSerial, String patientName,
                               String patientIdRef, String prescriberName, String prescriberRegNo, long quantity,
                               String lotNumber, UUID dispensedBy, UUID ledgerTransactionId) {
        register.recordDispense(facilityId, productId, rxSerial, patientName, patientIdRef, prescriberName,
                prescriberRegNo, quantity, lotNumber, dispensedBy, ledgerTransactionId);
    }

    @Override
    @Transactional
    public void recordReturn(ReturnEntry entry) {
        register.recordReturn(entry.facilityId(), entry.productId(), entry.prescriptionSerial(), entry.patientName(),
                entry.patientId() == null ? null : entry.patientId().toString(), entry.quantity(), entry.lotNumber(),
                entry.recordedByUserId(), entry.restocked(), entry.ledgerTransactionId());
    }
}
