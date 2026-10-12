package co.ehealth.platform.pharmacy.integration;

import co.ehealth.platform.pharmacy.register.ScheduleRegisterRecorder;
import co.ehealth.platform.pharmacy.stock.ReceiptReversedEvent;
import co.ehealth.platform.pharmacy.stock.StockIntakeEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

// A scheduled medicine has to appear in the register the moment it arrives,
// otherwise it could never be dispensed (dispensing is checked against the
// register balance). Runs in the receiving transaction, so stock and register
// are never out of step.
@Component
class ScheduledStockIntakeListener {

    private final ScheduleRegisterRecorder register;

    ScheduledStockIntakeListener(ScheduleRegisterRecorder register) {
        this.register = register;
    }

    @EventListener
    void recordScheduledIntake(StockIntakeEvent event) {
        for (StockIntakeEvent.IntakeLot lot : event.lots()) {
            register.recordIntake(event.facilityId(), lot.productId(), lot.lotNumber(), lot.quantity(),
                    event.recordedBy(), event.openingBalance(), event.ledgerTransactionId());
        }
    }

    // The register must give the stock back too when a receipt is cancelled.
    @EventListener
    void recordScheduledReversal(ReceiptReversedEvent event) {
        for (StockIntakeEvent.IntakeLot lot : event.lots()) {
            register.recordReversal(event.facilityId(), lot.productId(), lot.lotNumber(), lot.quantity(),
                    event.recordedBy(), event.ledgerTransactionId(), event.reason());
        }
    }
}
