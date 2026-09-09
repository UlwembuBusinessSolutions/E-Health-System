package co.ehealth.platform.facility;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

import java.util.UUID;

@Entity
@Table(name = "stations", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"facility_id", "code"})
})
public class Station {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "facility_id", nullable = false)
    private Facility facility;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 30)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "care_service", nullable = false, length = 30)
    private CareService careService;

    @Column(nullable = false)
    private boolean active = true;

    protected Station() {
    }

    public Station(Facility facility, String name, String code) {
        this(facility, name, code, CareService.MEDICAL);
    }

    public Station(Facility facility, String name, String code, CareService careService) {
        this.facility = facility;
        this.name = name;
        this.code = code;
        this.careService = careService;
    }

    public UUID getId() {
        return id;
    }

    public Facility getFacility() {
        return facility;
    }

    public String getName() {
        return name;
    }

    public String getCode() {
        return code;
    }

    public CareService getCareService() {
        return careService;
    }

    public boolean isActive() {
        return active;
    }
}
