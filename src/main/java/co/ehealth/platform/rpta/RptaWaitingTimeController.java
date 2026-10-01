package co.ehealth.platform.rpta;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.recq.WaitingTimeLog;
import co.ehealth.platform.recq.WaitingTimeService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/rpta/waiting-time")
public class RptaWaitingTimeController {

    private final WaitingTimeService waitingTimeService;
    private final PermissionService permissionService;

    public RptaWaitingTimeController(
            WaitingTimeService waitingTimeService,
            PermissionService permissionService) {

        this.waitingTimeService =
                waitingTimeService;

        this.permissionService =
                permissionService;
    }

    @GetMapping
    public ResponseEntity<List<WaitingTimeReportRow>>
    getWaitingTime(

            @RequestParam
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE_TIME)
            Instant from,

            @RequestParam
            @DateTimeFormat(
                    iso = DateTimeFormat.ISO.DATE_TIME)
            Instant to,

            @RequestParam(required = false)
            UUID facilityId) {

        permissionService.requireAccess(
                ModuleCode.RPTA,
                PermissionLevel.VIEW);

        List<WaitingTimeReportRow> rows =
                waitingTimeService
                        .findBetween(
                                from,
                                to,
                                facilityId)
                        .stream()
                        .map(WaitingTimeReportRow::from)
                        .toList();

        return ResponseEntity.ok(rows);
    }

    public record WaitingTimeReportRow(

            UUID visitId,
            UUID pharmacyVisitId,
            UUID patientId,
            UUID facilityId,

            Instant registrationStartedAt,
            Instant registrationCompletedAt,
            Long registrationDurationMinutes,

            Instant triageStartedAt,
            Instant triageCompletedAt,
            Long triageDurationMinutes,

            Instant consultationStartedAt,
            Instant consultationCompletedAt,
            Long consultationDurationMinutes,

            Instant pharmacyStartedAt,
            Instant pharmacyCompletedAt,
            Long pharmacyDurationMinutes,

            Long totalWaitingMinutes,
            Long totalJourneyMinutes,

            boolean exceeds120Minutes) {

        static WaitingTimeReportRow from(
                WaitingTimeLog log) {

            return new WaitingTimeReportRow(

                    log.getVisitId(),

                    log.getPharmacyVisitId(),

                    log.getPatientId(),

                    log.getFacilityId(),

                    log.getRegistrationStartedAt(),

                    log.getRegistrationCompletedAt(),

                    log.getRegistrationDurationMinutes(),

                    log.getTriageStartedAt(),

                    log.getTriageCompletedAt(),

                    log.getTriageDurationMinutes(),

                    log.getConsultationStartedAt(),

                    log.getConsultationCompletedAt(),

                    log.getConsultationDurationMinutes(),

                    log.getPharmacyStartedAt(),

                    log.getPharmacyCompletedAt(),

                    log.getPharmacyDurationMinutes(),

                    log.getTotalWaitingMinutes(),

                    log.getTotalJourneyMinutes(),

                    log.isExceeds120Minutes());
        }
    }
}