package co.ehealth.platform.pharmacy.register;

import java.util.List;

// One product's movements for one business day. `opening` is what the
// register held when the day began, including any OPENING entry made that
// day (an opening entry is a starting balance, not a movement).
public record DayFigures(long opening, long received, long dispensed, long destroyed, long lost, long returned) {

    static DayFigures of(long balanceBeforeDay, List<ScheduleRegisterEntry> entriesOfDay) {
        long openingEntries = totalOf(entriesOfDay, RegisterEntryKind.OPENING);
        // A cancelled receipt takes stock back out, so it nets against what was received.
        long receivedNet = totalOf(entriesOfDay, RegisterEntryKind.RECEIVED)
                - totalOf(entriesOfDay, RegisterEntryKind.REVERSED);
        return new DayFigures(balanceBeforeDay + openingEntries,
                receivedNet, totalOf(entriesOfDay, RegisterEntryKind.DISPENSED),
                totalOf(entriesOfDay, RegisterEntryKind.DESTROYED), totalOf(entriesOfDay, RegisterEntryKind.LOST),
                totalOf(entriesOfDay, RegisterEntryKind.RETURNED));
    }

    // What should physically be on the shelf at close of day.
    public long expected() {
        return opening + received - dispensed - destroyed - lost + returned;
    }

    private static long totalOf(List<ScheduleRegisterEntry> entries, RegisterEntryKind kind) {
        return entries.stream().filter(entry -> entry.getKind() == kind)
                .mapToLong(entry -> entry.getQuantityIn() + entry.getQuantityOut()).sum();
    }
}
