package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

// A register "day" runs midnight to midnight in the facility's own
// timezone, not the server's, so a late-evening dispense lands on the right
// day's reconciliation.
@Component
class FacilityBusinessDay {

    record Window(Instant start, Instant end) {
    }

    private final FacilityRepository facilityRepository;
    private final Clock clock;

    FacilityBusinessDay(FacilityRepository facilityRepository, Clock clock) {
        this.facilityRepository = facilityRepository;
        this.clock = clock;
    }

    LocalDate today(UUID facilityId) {
        return LocalDate.now(clock.withZone(zoneOf(facilityId)));
    }

    Window windowOf(UUID facilityId, LocalDate date) {
        ZoneId zone = zoneOf(facilityId);
        return new Window(date.atStartOfDay(zone).toInstant(), date.plusDays(1).atStartOfDay(zone).toInstant());
    }

    private ZoneId zoneOf(UUID facilityId) {
        return ZoneId.of(facilityRepository.findById(facilityId).orElseThrow(FacilityNotFoundException::new)
                .getTimezone());
    }
}
