package co.ehealth.platform.pharmacy.ccmdd;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ccmdd_pickup_points")
public class CcmddPickupPoint {
    @Id @GeneratedValue private UUID id;
    @Column(name="synch_id", nullable=false, unique=true) private String synchId;
    @Column(nullable=false) private String name;
    @Column(nullable=false) private String province = "";
    @Column(nullable=false) private String district = "";
    @Column(nullable=false) private String area = "";
    @Column(nullable=false) private String address = "";
    @Column(name="contact_email") private String contactEmail;
    @Column(nullable=false) private boolean active = true;
    @Column(name="synced_at", nullable=false) private Instant syncedAt;

    protected CcmddPickupPoint() {}
    public CcmddPickupPoint(String synchId) { this.synchId = synchId; }
    public void update(String name, String province, String district, String area, String address,
                       String contactEmail, boolean active, Instant now) {
        this.name = name; this.province = province; this.district = district;
        this.area = area; this.address = address; this.contactEmail = contactEmail;
        this.active = active; this.syncedAt = now;
    }
    public void retire() { active = false; }
    public UUID getId() { return id; }
    public String getSynchId() { return synchId; }
    public String getName() { return name; }
    public String getProvince() { return province; }
    public String getDistrict() { return district; }
    public String getArea() { return area; }
    public String getAddress() { return address; }
    public String getContactEmail() { return contactEmail; }
    public boolean isActive() { return active; }
    public Instant getSyncedAt() { return syncedAt; }
}
