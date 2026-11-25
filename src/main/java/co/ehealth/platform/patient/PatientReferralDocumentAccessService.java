package co.ehealth.platform.patient;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
public class PatientReferralDocumentAccessService {

    private static final Duration DOWNLOAD_URL_TTL = Duration.ofMinutes(5);

    private final PatientReferralDocumentRepository documentRepository;
    private final S3Presigner s3Presigner;
    private final String bucketName;

    public PatientReferralDocumentAccessService(PatientReferralDocumentRepository documentRepository,
                                                S3Presigner s3Presigner,
                                                @Value("${app.storage.bucket-name}") String bucketName) {
        this.documentRepository = documentRepository;
        this.s3Presigner = s3Presigner;
        this.bucketName = bucketName;
    }

    public List<PatientReferralDocument> list(UUID referralId) {
        return documentRepository.findByReferralIdOrderByUploadedAtDesc(referralId);
    }

    public String getDownloadUrl(UUID patientId, UUID referralId, UUID documentId) {
        PatientReferralDocument document = documentRepository
                .findByIdAndReferralIdAndPatientId(documentId, referralId, patientId)
                .orElseThrow(PatientReferralNotFoundException::new);
        GetObjectRequest get = GetObjectRequest.builder().bucket(bucketName).key(document.getS3Key())
                .responseContentDisposition("attachment").build();
        return s3Presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(DOWNLOAD_URL_TTL).getObjectRequest(get).build()).url().toString();
    }
}
