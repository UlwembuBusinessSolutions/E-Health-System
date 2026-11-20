package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class ReferralNotificationController {

    private final ReferralNotificationService notificationService;

    public ReferralNotificationController(ReferralNotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/api/v1/referral-notifications")
    public ResponseEntity<Map<String, Object>> listNotifications(
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        List<ReferralNotificationService.ReferralNotificationResponse> items =
                notificationService.listForUser(staffUserId(staff));
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/api/v1/referral-notifications/{notificationId}")
    public ResponseEntity<ReferralNotificationService.ReferralNotificationDetail> details(
            @PathVariable UUID notificationId, @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(notificationService.getDetails(notificationId, staffUserId(staff)));
    }

    @PostMapping("/api/v1/referral-notifications/{notificationId}/accept")
    public ResponseEntity<IncomingReferralService.PatientReceived> accept(
            @PathVariable UUID notificationId, @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(notificationService.accept(notificationId, staffUserId(staff)));
    }

    @PostMapping("/api/v1/referral-notifications/{notificationId}/acknowledge")
    public ResponseEntity<Void> acknowledge(@PathVariable UUID notificationId,
                                             @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        notificationService.acknowledge(notificationId, staffUserId(staff));
        return ResponseEntity.noContent().build();
    }

    private UUID staffUserId(AuthenticatedPrincipal staff) {
        if (staff == null) {
            throw new AccessDeniedException("Only authenticated clinic staff can access referral notifications.");
        }
        return staff.userId();
    }
}
