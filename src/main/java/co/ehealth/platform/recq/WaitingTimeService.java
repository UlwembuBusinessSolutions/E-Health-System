package co.ehealth.platform.recq;

import co.ehealth.platform.visit.Visit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class WaitingTimeService {

    private final WaitingTimeLogRepository repository;
    private final Clock clock;
    private final long targetMinutes;

    public WaitingTimeService(
            WaitingTimeLogRepository repository,
            Clock clock,
            @Value("${ehealth.recq.waiting-time.target-minutes:120}")
            long targetMinutes) {

        this.repository = repository;
        this.clock = clock;
        this.targetMinutes = targetMinutes;
    }

    @Transactional
    public WaitingTimeLog startRegistration(
            Visit visit,
            Instant startedAt) {

        return repository.findByVisitId(visit.getId())
                .orElseGet(() -> repository.save(
                        new WaitingTimeLog(
                                visit.getId(),
                                visit.getPatientId(),
                                visit.getFacilityId(),
                                startedAt,
                                clock.instant())));
    }

    @Transactional
    public WaitingTimeLog completeRegistration(
            UUID visitId,
            Instant completedAt) {

        WaitingTimeLog log = require(visitId);

        log.setRegistrationCompletedAt(
                completedAt);

        recalculate(log);

        return repository.save(log);
    }

    @Transactional
    public WaitingTimeLog startStage(
            UUID visitId,
            WaitingTimeStage stage,
            Instant startedAt) {

        WaitingTimeLog log = require(visitId);

        switch (stage) {
            case TRIAGE ->
                    log.setTriageStartedAt(startedAt);

            case CONSULTATION ->
                    log.setConsultationStartedAt(startedAt);

            case PHARMACY ->
                    log.setPharmacyStartedAt(startedAt);

            case REGISTRATION -> {
                // Registration is created through startRegistration().
            }
        }

        recalculate(log);

        return repository.save(log);
    }

    @Transactional
    public WaitingTimeLog completeStage(
            UUID visitId,
            WaitingTimeStage stage,
            Instant completedAt) {

        WaitingTimeLog log = require(visitId);

        switch (stage) {
            case TRIAGE ->
                    log.setTriageCompletedAt(completedAt);

            case CONSULTATION ->
                    log.setConsultationCompletedAt(completedAt);

            case PHARMACY ->
                    log.setPharmacyCompletedAt(completedAt);

            case REGISTRATION ->
                    log.setRegistrationCompletedAt(completedAt);
        }

        recalculate(log);

        return repository.save(log);
    }

    /**
     * Links the original clinic journey to the Visit created
     * when the patient is transferred to the pharmacy facility.
     *
     * The original visit remains the journey/reporting identity.
     */
    @Transactional
    public WaitingTimeLog linkPharmacyVisit(
            UUID originalVisitId,
            UUID pharmacyVisitId,
            Instant pharmacyStartedAt) {

        WaitingTimeLog log =
                require(originalVisitId);

        log.setPharmacyVisitId(
                pharmacyVisitId);

        log.setPharmacyStartedAt(
                pharmacyStartedAt);

        recalculate(log);

        return repository.save(log);
    }

    /**
     * Completes the pharmacy stage using the pharmacy Visit ID.
     *
     * This is necessary because QueueService.transferVisitToFacility()
     * creates a new Visit at the destination facility.
     */
    @Transactional
    public WaitingTimeLog completePharmacyByVisit(
            UUID pharmacyVisitId,
            Instant pharmacyCompletedAt) {

        WaitingTimeLog log =
                repository.findByPharmacyVisitId(
                        pharmacyVisitId)
                        .orElseThrow(() ->
                                new IllegalStateException(
                                        "No waiting-time journey is linked to pharmacy visit "
                                                + pharmacyVisitId));

        log.setPharmacyCompletedAt(
                pharmacyCompletedAt);

        recalculate(log);

        return repository.save(log);
    }

    @Transactional
    public WaitingTimeLog refresh(
            UUID visitId) {

        WaitingTimeLog log =
                require(visitId);

        recalculate(log);

        return repository.save(log);
    }

    public WaitingTimeLog get(
            UUID visitId) {

        return require(visitId);
    }

    public List<WaitingTimeLog> findBetween(
            Instant from,
            Instant to,
            UUID facilityId) {

        if (facilityId != null) {

            return repository
                    .findByFacilityIdAndRegistrationStartedAtBetweenOrderByRegistrationStartedAtAsc(
                            facilityId,
                            from,
                            to);
        }

        return repository
                .findByRegistrationStartedAtBetweenOrderByRegistrationStartedAtAsc(
                        from,
                        to);
    }

    private WaitingTimeLog require(
            UUID visitId) {

        return repository
                .findByVisitId(visitId)
                .orElseThrow(() ->
                        new IllegalStateException(
                                "No waiting-time log exists for visit "
                                        + visitId));
    }

    private void recalculate(
            WaitingTimeLog log) {

        log.recalculate(
                clock.instant(),
                targetMinutes);
    }
}