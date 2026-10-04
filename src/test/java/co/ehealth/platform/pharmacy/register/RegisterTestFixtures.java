package co.ehealth.platform.pharmacy.register;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

final class RegisterTestFixtures {

    static final Instant NOW = Instant.parse("2026-10-04T08:00:00Z");
    static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    static final UUID FACILITY_ID = UUID.randomUUID();
    static final UUID PRODUCT_ID = UUID.randomUUID();
    static final RegisterStaff ACTOR = new RegisterStaff(UUID.randomUUID(), "Thandi Nkosi");

    private RegisterTestFixtures() {
    }

    static RegisterEntryDetails details(RegisterEntryKind kind, long quantity, RegisterStaff witness) {
        return new RegisterEntryDetails(FACILITY_ID, PRODUCT_ID, kind, quantity, null, null, null, null, null,
                "LOT-1", ACTOR, witness, null);
    }

    static ScheduleRegisterEntry entry(RegisterEntryKind kind, long quantity, long balanceAfter) {
        return new ScheduleRegisterEntry(details(kind, quantity, null), balanceAfter, NOW);
    }
}
