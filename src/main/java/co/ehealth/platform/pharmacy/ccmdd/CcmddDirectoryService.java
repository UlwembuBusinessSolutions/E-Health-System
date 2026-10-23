package co.ehealth.platform.pharmacy.ccmdd;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class CcmddDirectoryService {
    private static final Logger log = LoggerFactory.getLogger(CcmddDirectoryService.class);
    private final CcmddPickupPointRepository points;
    private final CcmddSyncStateRepository syncStates;
    private final SynchDirectoryClient client;
    private final Clock clock;
    private final Duration refreshInterval;

    public CcmddDirectoryService(CcmddPickupPointRepository points, CcmddSyncStateRepository syncStates,
                                 SynchDirectoryClient client, Clock clock,
                                 @Value("${app.ccmdd.synch-cache-minutes:60}") int cacheMinutes) {
        this.points = points; this.syncStates = syncStates; this.client = client; this.clock = clock;
        this.refreshInterval = Duration.ofMinutes(Math.max(1, cacheMinutes));
    }

    @Transactional
    public DirectoryResult search(String query, String province, String district, String area, boolean forceRefresh) {
        Instant now = clock.instant();
        CcmddSyncState state = syncStates.findById((short) 1).orElseGet(() -> new CcmddSyncState((short) 1));
        boolean fresh = state.getLastSuccess() != null
                && state.getLastSuccess().plus(refreshInterval).isAfter(now);
        boolean cooldown = state.getLastError() != null && state.getLastAttempt() != null
                && state.getLastAttempt().plus(Duration.ofMinutes(5)).isAfter(now);
        boolean attempted = false;
        boolean success = false;
        if (client.configured() && (forceRefresh || (!fresh && !cooldown))) {
            attempted = true;
            try {
                List<SynchDirectoryClient.Entry> entries = client.fetch();
                // Validate the complete response before altering the cached master list.
                Set<String> current = new HashSet<>();
                for (var entry : entries) {
                    current.add(entry.id());
                    CcmddPickupPoint point = points.findBySynchId(entry.id())
                            .orElseGet(() -> new CcmddPickupPoint(entry.id()));
                    point.update(entry.name(), entry.province(), entry.district(), entry.area(), entry.address(),
                            entry.email().isBlank() ? null : entry.email(), entry.active(), now);
                    points.save(point);
                }
                for (CcmddPickupPoint old : points.findAll()) {
                    if (!current.contains(old.getSynchId())) old.retire();
                }
                state.success(now);
                success = true;
            } catch (Exception ex) {
                log.warn("CCMDD SYNCH fetch failed; keeping existing tenant directory cache: {}", ex.toString());
                state.fail(now, "SYNCH directory could not be refreshed");
            }
            syncStates.save(state);
        }
        boolean stale = !client.configured() || state.getLastSuccess() == null
                || !state.getLastSuccess().plus(refreshInterval).isAfter(now)
                || state.getLastError() != null;
        String source = success ? "SYNCH_LIVE" : (state.getLastSuccess() != null ? "CACHED" : "UNAVAILABLE");
        List<PointView> matches = points.findByActiveTrueOrderByNameAsc().stream()
                .filter(p -> contains(p.getName() + " " + p.getSynchId() + " " + p.getAddress(), query))
                .filter(p -> contains(p.getProvince(), province))
                .filter(p -> contains(p.getDistrict(), district))
                .filter(p -> contains(p.getArea(), area))
                .limit(300).map(PointView::from).toList();
        return new DirectoryResult(matches, source, stale, state.getLastSuccess(),
                client.configured(), state.getLastError() != null || !client.configured(),
                attempted, Math.max(1, refreshInterval.toMinutes()));
    }
    private static boolean contains(String value, String filter) {
        return filter == null || filter.isBlank() || value.toLowerCase(Locale.ROOT).contains(filter.trim().toLowerCase(Locale.ROOT));
    }
    public record PointView(UUID id, String synchId, String name, String province, String district,
                            String area, String address, String contactEmail) {
        static PointView from(CcmddPickupPoint point) {
            return new PointView(point.getId(), point.getSynchId(), point.getName(), point.getProvince(),
                    point.getDistrict(), point.getArea(), point.getAddress(), point.getContactEmail());
        }
    }
    public record DirectoryResult(List<PointView> items, String source, boolean stale, Instant lastSuccessfulSync,
                                  boolean configured, boolean fallback, boolean refreshAttempted, long cacheMinutes) {}
}
