package co.ehealth.platform.consultation;

import co.ehealth.platform.visit.ServiceStream;
import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "classification_reasons")
public class ClassificationReason {
    @Id @GeneratedValue private UUID id;
    @Enumerated(EnumType.STRING) @Column(name = "service_stream", nullable = false, length = 30)
    private ServiceStream serviceStream;
    @Column(name = "reason_code", nullable = false, length = 60) private String reasonCode;
    @Column(nullable = false, length = 120) private String label;
    @Column(nullable = false) private boolean active;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
    protected ClassificationReason() {}
    public ClassificationReason(ServiceStream stream, String code, String label, int order) {
        this.serviceStream = stream; this.reasonCode = code; this.label = label; this.sortOrder = order; this.active = true;
    }
    public void update(String label, boolean active, int sortOrder) {
        this.label = label; this.active = active; this.sortOrder = sortOrder;
    }
    public UUID getId() { return id; }
    public ServiceStream getServiceStream() { return serviceStream; }
    public String getReasonCode() { return reasonCode; }
    public String getLabel() { return label; }
    public boolean isActive() { return active; }
    public int getSortOrder() { return sortOrder; }
}
