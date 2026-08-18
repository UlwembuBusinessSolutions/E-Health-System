package co.ehealth.platform.facility;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// Full Facility CRUD belongs to Backend 1 per the Phase 1 dev brief's
// ownership split — this slice only needs enough of the entity for staff
// creation to reference a facility_id and for GET /api/v1/facilities to
// list them. No update/deactivate methods here yet; add them alongside
// real facility-management endpoints when that module gets built.
@Entity
@Table(name = "facilities")
public class Facility {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FacilityType type;

    @Column(length = 300)
    private String address;

    @Column(length = 20)
    private String phone;

    @Column(nullable = false, length = 50)
    private String timezone = "Africa/Johannesburg";

    @Column(nullable = false)
    private boolean active = true;

    protected Facility() {
    }

    public Facility(String name, String code, FacilityType type) {
        this.name = name;
        this.code = code;
        this.type = type;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getCode() {
        return code;
    }

    public FacilityType getType() {
        return type;
    }

    public String getAddress() {
        return address;
    }

    public String getPhone() {
        return phone;
    }

    public String getTimezone() {
        return timezone;
    }

    public boolean isActive() {
        return active;
    }
}
