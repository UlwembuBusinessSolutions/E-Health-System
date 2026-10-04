package co.ehealth.platform.pharmacy.stock;

import java.util.List;
import java.util.UUID;

// The seam between ledger operations (adjustments, reversals) and
// serial-tracked units — one ledger identity per physical device. The serial
// table (pharmacy_serial_units) arrives with the suppliers/tracking
// migration (V42), so this module only depends on this interface.
//
// WIRING (integrator): provide a @Component implementation backed by the
// serial table and mark it @Primary — it then replaces UnwiredSerialUnitGateway
// without that class needing to be deleted. Every method runs inside the
// caller's transaction, so a failure here rolls back the ledger posting too.
public interface SerialUnitGateway {

    boolean isSerialTracked(UUID productId);

    // Units added by an ADD adjustment: create them IN_STOCK.
    void registerUnits(UUID productId, UUID batchId, List<String> serialNumbers, UUID transactionId);

    // Units taken out by a REMOVE adjustment: each must currently be IN_STOCK
    // for this product, otherwise reject so the ledger and serial table can't
    // disagree.
    void removeUnits(UUID productId, List<String> serialNumbers, UUID transactionId);

    // Mirror a reversal onto the units the original transaction touched:
    // units it added are removed again, units it removed come back IN_STOCK.
    // A no-op for transactions that involved no serial units.
    void reverseUnits(UUID originalTransactionId, UUID reversalTransactionId);
}
