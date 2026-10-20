package co.ehealth.platform.core.notification;

import java.time.Duration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.pinpointsmsvoicev2.PinpointSmsVoiceV2Client;
import software.amazon.awssdk.services.pinpointsmsvoicev2.model.MessageType;
import software.amazon.awssdk.services.pinpointsmsvoicev2.model.SendTextMessageRequest;

/** Small reusable SMS gateway. Credentials come from the AWS default credential chain. */
public final class AwsSmsSender implements AutoCloseable {
    private final PinpointSmsVoiceV2Client client;
    private final String originationIdentity;

    public AwsSmsSender(String region, String originationIdentity) {
        if (region == null || region.isBlank() || originationIdentity == null || originationIdentity.isBlank()) {
            throw new IllegalArgumentException("AWS region and SMS origination identity are required");
        }
        this.originationIdentity = originationIdentity;
        this.client = PinpointSmsVoiceV2Client.builder()
                .region(Region.of(region))
                .overrideConfiguration(c -> c.apiCallTimeout(Duration.ofSeconds(30))
                        .apiCallAttemptTimeout(Duration.ofSeconds(10)))
                .build();
    }

    /** Returns AWS's message ID (acceptance does not guarantee delivery). */
    public String send(String phoneNumber, String message) {
        if (phoneNumber == null || !phoneNumber.matches("\\+[1-9][0-9]{1,14}")) {
            throw new IllegalArgumentException("Use an international phone number, for example +27821234567");
        }
        if (message == null || message.isBlank() || message.length() > 1600) {
            throw new IllegalArgumentException("Message must contain between 1 and 1600 characters");
        }
        return client.sendTextMessage(SendTextMessageRequest.builder()
                .destinationPhoneNumber(phoneNumber)
                .originationIdentity(originationIdentity)
                .messageType(MessageType.TRANSACTIONAL)
                .messageBody(message)
                .build()).messageId();
    }

    @Override
    public void close() {
        client.close();
    }

    /** Run manually; never sends on application startup. */
    public static void main(String[] args) {
        if (args.length != 2) {
            throw new IllegalArgumentException("Usage: AwsSmsSender <+phone-number> <message>");
        }
        try (var sender = new AwsSmsSender(System.getenv("AWS_REGION"),
                System.getenv("SMS_ORIGINATION_IDENTITY"))) {
            System.out.println("SMS accepted by AWS. Message ID: " + sender.send(args[0], args[1]));
        }
    }
}
