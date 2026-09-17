package co.ehealth.platform.facility;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "service_stations")
public class ServiceStation {
    @Id @GeneratedValue private UUID id;
    @Column(name = "facility_id", nullable = false) private UUID facilityId;
    @Column(name = "department_id") private UUID departmentId;
    @Column(nullable = false, length = 200) private String name;
    @Column(name = "counter_label", length = 100) private String counterLabel;
    protected ServiceStation() {}
    public ServiceStation(UUID facilityId, UUID departmentId, String name, String counterLabel) {
        this.facilityId = facilityId; this.departmentId = departmentId; this.name = name; this.counterLabel = counterLabel;
    }
    public UUID getId() { return id; }
    public UUID getFacilityId() { return facilityId; }
    public UUID getDepartmentId() { return departmentId; }
    public String getName() { return name; }
    public String getCounterLabel() { return counterLabel; }
}
