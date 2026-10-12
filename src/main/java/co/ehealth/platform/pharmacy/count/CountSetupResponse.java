package co.ehealth.platform.pharmacy.count;

import java.time.Instant;
import java.util.List;

// What the "start a count" screen needs before any count exists: how many
// lots a whole-facility count would list, and the areas that can be counted
// on their own with when each was last counted.
public record CountSetupResponse(long wholeFacilityLots, List<AreaSummary> areas) {

    public record AreaSummary(String label, int lotCount, Instant lastCountedAt) {
    }
}
