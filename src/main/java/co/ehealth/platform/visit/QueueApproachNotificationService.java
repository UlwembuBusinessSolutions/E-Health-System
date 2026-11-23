package co.ehealth.platform.visit;

import co.ehealth.platform.core.notification.AwsSmsService;
import co.ehealth.platform.core.notification.WhatsAppCloudApiService;
import co.ehealth.platform.core.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Autowired;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;

@Service
public class QueueApproachNotificationService {

    private static final Logger log = LoggerFactory.getLogger(QueueApproachNotificationService.class);
    private static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{7,14}$");

    private final QueueTokenRepository tokens;
    private final VisitRepository visits;
    private final PatientRepository patients;
    private final FacilityRepository facilities;
    private final AwsSmsService smsService;
        private final WhatsAppCloudApiService whatsAppService;
    private final QueueApproachDeliveryRecorder deliveryRecorder;
    private final Clock clock;

    @Autowired
    public QueueApproachNotificationService(QueueTokenRepository tokens, VisitRepository visits,
            PatientRepository patients, FacilityRepository facilities, AwsSmsService smsService,
            WhatsAppCloudApiService whatsAppService, QueueApproachDeliveryRecorder deliveryRecorder, Clock clock) {
        this.tokens = tokens;
        this.visits = visits;
        this.patients = patients;
        this.facilities = facilities;
        this.smsService = smsService;
        this.whatsAppService = whatsAppService;
        this.deliveryRecorder = deliveryRecorder;
        this.clock = clock;
    }

    QueueApproachNotificationService(QueueTokenRepository tokens, VisitRepository visits,
            PatientRepository patients, FacilityRepository facilities, AwsSmsService smsService,
            WhatsAppCloudApiService whatsAppService, Clock clock) {
        this(tokens, visits, patients, facilities, smsService, whatsAppService,
                new QueueApproachDeliveryRecorder(tokens), clock);
    }

    @Transactional
    public void evaluateFacility(UUID facilityId) {
        boolean smsReady = smsService.isReadyToSend();
        boolean whatsAppReady = whatsAppService.isReadyToSend();
        if (!smsReady && !whatsAppReady) {
            return;
        }
        Facility facility = facilities.findById(facilityId).orElseThrow(FacilityNotFoundException::new);
        ZoneId zone = ZoneId.of(facility.getTimezone());
        Instant now = clock.instant();
        LocalDate today = now.atZone(zone).toLocalDate();
        Instant start = today.atStartOfDay(zone).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(zone).toInstant();
        List<QueueToken> dayTokens = tokens.lockQueueForApproachEvaluation(facilityId, start, end);
        int calledAhead = (int) dayTokens.stream().filter(token -> token.getStatus() == TokenStatus.CALLED).count();
        List<QueueToken> waiting = dayTokens.stream().filter(token -> token.getStatus() == TokenStatus.ISSUED).toList();
        Double average = tokens.findAverageCompletedServiceMinutes(facilityId);
        double averageMinutes = average == null || average <= 0
                ? QueueApproachPolicy.FALLBACK_MINUTES_PER_TOKEN : average;

        for (int index = 0; index < waiting.size(); index++) {
            QueueToken token = waiting.get(index);
            if (token.getApproachSmsSentAt() != null && token.getApproachWhatsAppSentAt() != null) {
                continue;
            }
            int tokensAhead = calledAhead + index;
            if (!QueueApproachPolicy.shouldNotify(tokensAhead, averageMinutes)) {
                break;
            }
            Visit visit = visits.findById(token.getVisitId()).orElseThrow(VisitNotFoundException::new);
            Patient patient = patients.findById(visit.getPatientId()).orElse(null);
            String phoneNumber = patient == null ? null : toE164(patient.getContactNumber());
            if (phoneNumber == null) {
                log.debug("Skipping queue WhatsApp for token {}: missing or invalid mobile number",
                        token.getTokenNumber());
                continue;
            }
            boolean sendSms = smsReady && token.getApproachSmsSentAt() == null;
            boolean sendWhatsApp = whatsAppReady && patient.isWhatsAppOptedIn()
                    && token.getApproachWhatsAppSentAt() == null;
            if (whatsAppReady && !patient.isWhatsAppOptedIn()
                    && token.getApproachWhatsAppSentAt() == null) {
                log.debug("Skipping queue WhatsApp for token {}: patient has not opted in",
                        token.getTokenNumber());
            }
            if (!sendSms && !sendWhatsApp) {
                continue;
            }
            if (sendSms) {
                token.markApproachSmsSent(now);
            }
            if (sendWhatsApp) {
                token.markApproachWhatsAppSent(now);
            }
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    if (sendSms) {
                        try {
                            smsService.sendApproachingTurn(phoneNumber, tokensAhead, token.getTokenNumber());
                        } catch (RuntimeException ex) {
                            log.warn("Could not queue approach SMS for token {}", token.getTokenNumber(), ex);
                        }
                    }
                    if (sendWhatsApp) {
                        try {
                            String tenantSchema = TenantContext.getCurrentTenant();
                            CompletableFuture<Boolean> delivery = whatsAppService.sendApproachingTurn(
                                    phoneNumber, tokensAhead, token.getTokenNumber());
                            delivery.whenComplete((accepted, deliveryError) -> {
                                if (deliveryError != null) {
                                    log.warn("Could not determine WhatsApp delivery acceptance for queue token {}",
                                            token.getTokenNumber(), deliveryError);
                                }
                                if ((deliveryError != null || !Boolean.TRUE.equals(accepted))
                                        && tenantSchema != null) {
                                    TenantContext.setCurrentTenant(tenantSchema);
                                    try {
                                        deliveryRecorder.clearFailedWhatsAppAttempt(token.getId());
                                    } finally {
                                        TenantContext.clear();
                                    }
                                }
                            });
                        } catch (RuntimeException ex) {
                            log.warn("Could not queue WhatsApp notification for token {}", token.getTokenNumber(), ex);
                            token.clearApproachWhatsAppSent();
                            String tenantSchema = TenantContext.getCurrentTenant();
                            if (tenantSchema != null) {
                                deliveryRecorder.clearFailedWhatsAppAttempt(token.getId());
                            }
                        }
                    }
                }
            });
        }
    }

    static String toE164(String number) {
        if (number == null || number.isBlank()) {
            return null;
        }
        String compact = number.trim().replaceAll("[\\s()-]", "");
        if (compact.startsWith("+")) {
            if (!E164.matcher(compact).matches()) {
                return null;
            }
            return compact.startsWith("+27") && !compact.matches("\\+27[6-8][0-9]{8}") ? null : compact;
        }
        if (compact.startsWith("0") && compact.matches("0[6-8][0-9]{8}")) {
            return "+27" + compact.substring(1);
        }
        if (compact.startsWith("27") && compact.matches("27[6-8][0-9]{8}")) {
            return "+" + compact;
        }
        return null;
    }
}
