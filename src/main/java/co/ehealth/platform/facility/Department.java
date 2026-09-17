package co.ehealth.platform.facility;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "departments")
public class Department {
    @Id @GeneratedValue private UUID id;
    @Column(name = "facility_id", nullable = false) private UUID facilityId;
    @Column(nullable = false, length = 200) private String name;
    protected Department() {}
    public Department(UUID facilityId, String name) { this.facilityId = facilityId; this.name = name; }
    public UUID getId() { return id; }
    public UUID getFacilityId() { return facilityId; }
    public String getName() { return name; }
}
