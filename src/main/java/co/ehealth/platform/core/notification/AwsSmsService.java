package co.ehealth.platform.core.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.MessageAttributeValue;
import software.amazon.awssdk.services.sns.model.PublishRequest;
import software.amazon.awssdk.services.sns.model.PublishResponse;

import java.util.Map;

@Service
public class AwsSmsService {

    private static final Logger log = LoggerFactory.getLogger(AwsSmsService.class);
    private static final String SMS_TYPE_ATTRIBUTE = "AWS.SNS.SMS.SMSType";

    private final SnsClient snsClient;
    private final AwsCredentialsProvider credentialsProvider;
    private final boolean smsEnabled;

    public AwsSmsService(SnsClient snsClient, AwsCredentialsProvider credentialsProvider,
                         @Value("${app.notifications.aws.sms-enabled:false}") boolean smsEnabled) {
        this.snsClient = snsClient;
        this.credentialsProvider = credentialsProvider;
        this.smsEnabled = smsEnabled;
    }

    public boolean isReadyToSend() {
        if (!smsEnabled) {
            return false;
        }
        try {
            credentialsProvider.resolveCredentials();
            return true;
        } catch (SdkClientException ex) {
            log.debug("Queue approach SMS is disabled because AWS credentials are unavailable");
            return false;
        }
    }

    @Async("smsTaskExecutor")
    public void sendApproachingTurn(String phoneNumber, int tokensAhead, int tokenNumber) {
        if (!isReadyToSend()) {
            return;
        }

        String message = "Your turn at the clinic is approaching. There are about " + tokensAhead
                + " token(s) ahead of you.";
        PublishRequest request = PublishRequest.builder()
                .phoneNumber(phoneNumber)
                .message(message)
                .messageAttributes(Map.of(SMS_TYPE_ATTRIBUTE, MessageAttributeValue.builder()
                        .stringValue("Transactional")
                        .dataType("String")
                        .build()))
                .build();
        try {
            PublishResponse response = snsClient.publish(request);
            log.info("AWS SNS accepted approach SMS for token {} with message id {}",
                    tokenNumber, response.messageId());
        } catch (RuntimeException ex) {
            log.warn("AWS SNS failed to accept approach SMS for token {}", tokenNumber, ex);
        }
    }
}