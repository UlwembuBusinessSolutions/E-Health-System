package co.ehealth.platform.core.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

// No explicit access key/secret here — S3Client.builder() with no
// .credentialsProvider() call falls back to the AWS default credential
// chain (an IAM role in production, environment variables or a local
// profile in dev). One fewer secret sitting in app.* config, same
// reasoning as JWT_SECRET and PLATFORM_JWT_SECRET living only in
// environment variables, never here.
@Configuration
public class StorageConfig {

    @Bean
    public S3Client s3Client(@Value("${app.storage.region}") String region) {
        return S3Client.builder().region(Region.of(region)).build();
    }
}
