package co.ehealth.platform.pharmacy.stock;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Default until the serial table exists: no product is serial-tracked yet, so
// the only way to reach register/remove is a client sending serial numbers
// for a product that can't take them — refused loudly rather than silently
// dropped. reverseUnits() is a harmless no-op because without serial
// tracking there are no units to mirror. See SerialUnitGateway for how the
// real implementation replaces this one.
@Component
class UnwiredSerialUnitGateway implements SerialUnitGateway {

    private static final String NOT_WIRED = "Serial-number tracking is not available yet.";

    @Override
    public boolean isSerialTracked(UUID productId) {
        return false;
    }

    @Override
    public void registerUnits(UUID productId, UUID batchId, List<String> serialNumbers, UUID transactionId) {
        throw new UnsupportedOperationException(NOT_WIRED);
    }

    @Override
    public void removeUnits(UUID productId, List<String> serialNumbers, UUID transactionId) {
        throw new UnsupportedOperationException(NOT_WIRED);
    }

    @Override
    public void reverseUnits(UUID originalTransactionId, UUID reversalTransactionId) {
    }

    @Override
    public Map<UUID, List<String>> inStockSerialsByBatch(UUID productId) {
        return Map.of();
    }
}
