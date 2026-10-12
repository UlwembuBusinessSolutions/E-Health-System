package co.ehealth.platform.pharmacy.dispensing;

import java.util.UUID;

// Who is acting, with the name captured now: ledger and audit rows keep the
// name as it was at the time (plan section 7, historical attribution).
public record DispensingActor(UUID userId, String name) {
}
