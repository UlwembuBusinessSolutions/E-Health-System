package co.ehealth.platform.pharmacy;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pharmacy_duty_entries")
public class PharmacyDutyEntry {
    @Id @GeneratedValue UUID id;
    @Column(name="facility_id", nullable=false) UUID facilityId;
    @Column(name="staff_id", nullable=false) UUID staffId;
    @Column(name="staff_name", nullable=false, length=210) String staffName;
    @Column(name="duty_type", nullable=false, length=20) String dutyType;
    @Column(name="started_at", nullable=false) Instant startedAt;
    @Column(name="expires_at", nullable=false) Instant expiresAt;
    @Column(name="ended_at") Instant endedAt;
    @Column(nullable=false, length=500) String reason;
    protected PharmacyDutyEntry() {}
    PharmacyDutyEntry(UUID facility, UUID staff, String name, String type, Instant start, Instant expiry, String reason) {
        this.facilityId=facility; this.staffId=staff; this.staffName=name; this.dutyType=type;
        this.startedAt=start; this.expiresAt=expiry; this.reason=reason;
    }
}

