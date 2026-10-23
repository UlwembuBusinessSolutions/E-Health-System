package co.ehealth.platform.pharmacy.stock;

import java.util.UUID;

// The authenticated staff member behind a stock command. The name is
// recorded alongside the id because ledger attribution must survive a later
// rename or offboarding (plan section 7).
public record StockActor(UUID userId, String name) {
}
