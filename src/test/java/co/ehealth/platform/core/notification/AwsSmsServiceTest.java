package co.ehealth.platform.core.notification;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;
import software.amazon.awssdk.services.sns.model.PublishResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AwsSmsServiceTest {

    @Test
    void publishesTransactionalSmsDirectlyToPatientNumber() {
        SnsClient snsClient = mock(SnsClient.class);
        AwsCredentialsProvider credentialsProvider = credentialsProvider();
        when(snsClient.publish(any(PublishRequest.class)))
                .thenReturn(PublishResponse.builder().messageId("message-123").build());
        AwsSmsService service = new AwsSmsService(snsClient, credentialsProvider, true);

        service.sendApproachingTurn("+27821234567", 2, 18);

        var request = org.mockito.ArgumentCaptor.forClass(PublishRequest.class);
        verify(snsClient).publish(request.capture());
        assertEquals("+27821234567", request.getValue().phoneNumber());
        assertTrue(request.getValue().message().contains("2 token(s) ahead"));
        assertEquals("Transactional", request.getValue().messageAttributes()
                .get("AWS.SNS.SMS.SMSType").stringValue());
    }

    @Test
    void disabledSmsDoesNotPublish() {
        SnsClient snsClient = mock(SnsClient.class);
        AwsSmsService service = new AwsSmsService(snsClient, credentialsProvider(), false);

        service.sendApproachingTurn("+27821234567", 2, 18);

        assertFalse(service.isReadyToSend());
        verify(snsClient, never()).publish(any(PublishRequest.class));
    }

    @Test
    void missingAwsCredentialsDoNotPublish() {
        SnsClient snsClient = mock(SnsClient.class);
        AwsCredentialsProvider credentialsProvider = mock(AwsCredentialsProvider.class);
        when(credentialsProvider.resolveCredentials()).thenThrow(SdkClientException.create("No credentials"));
        AwsSmsService service = new AwsSmsService(snsClient, credentialsProvider, true);

        service.sendApproachingTurn("+27821234567", 2, 18);

        assertFalse(service.isReadyToSend());
        verify(snsClient, never()).publish(any(PublishRequest.class));
    }

    private AwsCredentialsProvider credentialsProvider() {
        AwsCredentialsProvider credentialsProvider = mock(AwsCredentialsProvider.class);
        when(credentialsProvider.resolveCredentials()).thenReturn(AwsBasicCredentials.create("access", "secret"));
        return credentialsProvider;
    }
}