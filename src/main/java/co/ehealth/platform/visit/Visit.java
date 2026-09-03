package co.ehealth.platform.visit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// PREG-US-019's "Visit entity" — "Entry point to all clinical workflow"
// per the FRS data model. No status field: the only thing that currently
// happens to a visit in this slice is being created and immediately handed
// off to the queue (VisitService.createVisit()'s own why-note) — nothing
// yet transitions it to any other state, so a status column would be
// unused dead weight until a later slice (consultation, visit completion)
// actually needs one.
@Entity
@Table(name = "visits")
public class Visit {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "visit_type", nullable = false, length = 20)
    private VisitType visitType;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_stream", nullable = false, length = 30)
    private ServiceStream serviceStream;

    @Column(name = "visit_datetime", nullable = false)
    private Instant visitDateTime;

    @Column(name = "created_by_user_id")
    private UUID createdByUserId;

    protected Visit() {
    }

    public Visit(UUID patientId, UUID facilityId, VisitType visitType, ServiceStream serviceStream,
                 Instant visitDateTime, UUID createdByUserId) {
        this.patientId = patientId;
        this.facilityId = facilityId;
        this.visitType = visitType;
        this.serviceStream = serviceStream;
        this.visitDateTime = visitDateTime;
        this.createdByUserId = createdByUserId;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public VisitType getVisitType() {
        return visitType;
    }

    public ServiceStream getServiceStream() {
        return serviceStream;
    }

    public Instant getVisitDateTime() {
        return visitDateTime;
    }

    public UUID getCreatedByUserId() {
        return createdByUserId;
    }
}
