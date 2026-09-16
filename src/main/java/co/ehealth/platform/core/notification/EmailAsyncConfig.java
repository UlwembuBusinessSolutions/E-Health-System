package co.ehealth.platform.core.notification;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

// Bounded on purpose. The whole point of moving email delivery off the
// request thread (EmailDeliveryWorker) is to stop a slow SMTP server from
// starving Tomcat's own worker threads under load — @Async's default
// executor (SimpleAsyncTaskExecutor) spawns a brand-new, uncapped thread
// per call, which just relocates the same unbounded-resource-under-load
// problem instead of fixing it. CallerRunsPolicy, not the default
// AbortPolicy: if a burst overflows the bounded queue, the send runs on
// whichever thread submitted it (one of this same pool's own threads
// finishing other sends) instead of being silently dropped or throwing —
// backpressure instead of data loss.
@Configuration
@EnableAsync
public class EmailAsyncConfig {

    @Bean(name = "emailTaskExecutor")
    public Executor emailTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("email-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
