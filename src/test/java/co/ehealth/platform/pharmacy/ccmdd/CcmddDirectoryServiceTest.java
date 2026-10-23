package co.ehealth.platform.pharmacy.ccmdd;

import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CcmddDirectoryServiceTest {
    private final CcmddPickupPointRepository points = mock(CcmddPickupPointRepository.class);
    private final CcmddSyncStateRepository states = mock(CcmddSyncStateRepository.class);
    private final SynchDirectoryClient synch = mock(SynchDirectoryClient.class);
    private final Clock now = Clock.fixed(Instant.parse("2026-10-21T09:00:00Z"), ZoneOffset.UTC);

    @Test void usesStaleCachedPointsWhenSynchIsDownAndFiltersArea() throws Exception {
        CcmddSyncState state = new CcmddSyncState((short)1);
        state.success(now.instant().minus(Duration.ofHours(3)));
        when(states.findById((short)1)).thenReturn(Optional.of(state));
        when(synch.configured()).thenReturn(true);
        when(synch.fetch()).thenThrow(new IOException("Service unavailable"));
        CcmddPickupPoint point = new CcmddPickupPoint("G100");
        point.update("Main Collection", "Gauteng", "Johannesburg", "Soweto", "", null,
                true, now.instant().minus(Duration.ofHours(3)));
        when(points.findByActiveTrueOrderByNameAsc()).thenReturn(List.of(point));

        var service = new CcmddDirectoryService(points, states, synch, now, 60);
        var result = service.search("Main", "GAUTENG", "", "soweto", false);

        assertEquals("CACHED", result.source());
        assertTrue(result.stale());
        assertTrue(result.fallback());
        assertEquals(1, result.items().size());
        assertEquals("G100", result.items().getFirst().synchId());
        assertNotNull(result.lastSuccessfulSync());
        verify(points, never()).deleteAll();
    }

    @Test void emptyCacheAndMissingConfigurationAreClearlyUnavailable() throws Exception {
        when(states.findById((short)1)).thenReturn(Optional.of(new CcmddSyncState((short)1)));
        when(synch.configured()).thenReturn(false);
        when(points.findByActiveTrueOrderByNameAsc()).thenReturn(List.of());
        var result = new CcmddDirectoryService(points, states, synch, now, 60)
                .search("", "", "", "", false);
        assertEquals("UNAVAILABLE", result.source());
        assertTrue(result.stale());
        assertTrue(result.items().isEmpty());
        verify(synch, never()).fetch();
    }
    @Test void synchronizesMasterListAndFiltersAreaCaseInsensitively() throws Exception {
        when(states.findById((short)1)).thenReturn(Optional.empty());
        when(synch.configured()).thenReturn(true);
        var entry = new SynchDirectoryClient.Entry("S100", "SYNCH Collection", "Gauteng",
                "Johannesburg", "Soweto", "Main Road", "", true);
        when(synch.fetch()).thenReturn(List.of(entry));
        CcmddPickupPoint matching = new CcmddPickupPoint("S100");
        matching.update(entry.name(), entry.province(), entry.district(), entry.area(), entry.address(),
                null, true, now.instant());
        CcmddPickupPoint other = new CcmddPickupPoint("S200");
        other.update("Other Collection", "Gauteng", "Johannesburg", "Sandton", "", null, true, now.instant());
        when(points.findBySynchId("S100")).thenReturn(Optional.of(matching));
        when(points.findAll()).thenReturn(List.of(matching, other));
        when(points.findByActiveTrueOrderByNameAsc()).thenReturn(List.of(matching));

        var result = new CcmddDirectoryService(points, states, synch, now, 60)
                .search("SYNCH", "gauteng", "", " SOWETO ", false);

        assertEquals("SYNCH_LIVE", result.source());
        assertFalse(result.stale());
        assertFalse(result.fallback());
        assertTrue(result.refreshAttempted());
        assertEquals(now.instant(), result.lastSuccessfulSync());
        assertEquals(List.of("S100"), result.items().stream().map(CcmddDirectoryService.PointView::synchId).toList());
        assertFalse(other.isActive());
        verify(points).save(matching);
    }

    @Test void freshCacheFiltersOutOtherAreasWithoutFetchingAgain() throws Exception {
        CcmddSyncState state = new CcmddSyncState((short)1);
        state.success(now.instant().minusSeconds(60));
        when(states.findById((short)1)).thenReturn(Optional.of(state));
        when(synch.configured()).thenReturn(true);
        CcmddPickupPoint point = new CcmddPickupPoint("G100");
        point.update("Collection", "Gauteng", "Johannesburg", "Soweto", "", null, true, now.instant());
        when(points.findByActiveTrueOrderByNameAsc()).thenReturn(List.of(point));

        var result = new CcmddDirectoryService(points, states, synch, now, 60)
                .search("", "", "", "Sandton", false);

        assertEquals("CACHED", result.source());
        assertFalse(result.stale());
        assertTrue(result.items().isEmpty());
        verify(synch, never()).fetch();
    }
}
