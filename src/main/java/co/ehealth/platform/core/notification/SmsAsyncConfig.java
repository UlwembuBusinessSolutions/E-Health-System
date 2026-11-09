package co.ehealth.platform.core.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

@Configuration
@EnableScheduling
public class SmsAsyncConfig {

    @Bean(destroyMethod = "close")
    public DefaultCredentialsProvider awsSmsCredentialsProvider() {
        return DefaultCredentialsProvider.create();
    }

    @Bean
    public SnsClient snsClient(@Value("${app.notifications.aws.sms-region}") String region,
                               DefaultCredentialsProvider awsSmsCredentialsProvider) {
        return SnsClient.builder()
                .region(Region.of(region))
                .credentialsProvider(awsSmsCredentialsProvider)
                .build();
    }

    @Bean(name = "smsTaskExecutor")
    public Executor smsTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(250);
        executor.setThreadNamePrefix("sms-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}