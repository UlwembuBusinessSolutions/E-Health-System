package co.ehealth.platform.patient;

import co.ehealth.platform.identity.Gender;
import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// PREG-US-001's "PatientEmployee entity" — one row per person registered at
// this tenant, living in that tenant's own schema like every other clinical
// entity (patients belong to exactly one tenant, same isolation boundary as
// users/staff). No update methods, no delete path anywhere in this class or
// PatientRepository — PREG-US-017 ("patient records to be impossible to
// delete through any interface") is enforced by omission, not a guard
// clause; PREG-US-016 (update demographics) is a separate, later story this
// slice doesn't build.
@Entity
@Table(name = "patients")
public class Patient {

    @Id
    @GeneratedValue
    private UUID id;

    // Assigned once, at construction, from PatientService's own sequence —
    // never settable again. See PatientService.register()'s own why-note on
    // how uniqueness is guaranteed under concurrent registrations.
    @Column(name = "mpi_number", nullable = false, unique = true, length = 20)
    private String mpiNumber;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    // Derived from idNumber at registration (SouthAfricanIdNumber.parse()),
    // not taken directly from the request — PREG-US-003's "DOB/gender
    // auto-derived."
    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Gender gender;

    @Enumerated(EnumType.STRING)
    @Column(name = "citizenship_status", nullable = false, length = 20)
    private CitizenshipStatus citizenshipStatus;

    @Column(name = "id_number", nullable = false, unique = true, length = 13)
    private String idNumber;

    @Column(nullable = false, length = 500)
    private String address;

    @Column(name = "contact_number", nullable = false, length = 20)
    private String contactNumber;

    // Both nullable — not everyone has medical aid, and PREG-US-003 doesn't
    // list it as mandatory the way name/DOB/ID/address/contact are.
    @Column(name = "medical_aid_provider", length = 100)
    private String medicalAidProvider;

    @Column(name = "medical_aid_number", length = 50)
    private String medicalAidNumber;

    @Column(name = "registered_by_user_id")
    private UUID registeredByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @ElementCollection
    @CollectionTable(name = "patient_next_of_kin", joinColumns = @JoinColumn(name = "patient_id"))
    private List<NextOfKin> nextOfKin;

    protected Patient() {
    }

    public Patient(String mpiNumber, String firstName, String lastName, LocalDate dateOfBirth, Gender gender,
                   CitizenshipStatus citizenshipStatus, String idNumber, String address, String contactNumber,
                   String medicalAidProvider, String medicalAidNumber, List<NextOfKin> nextOfKin,
                   UUID registeredByUserId, Instant createdAt) {
        this.mpiNumber = mpiNumber;
        this.firstName = firstName;
        this.lastName = lastName;
        this.dateOfBirth = dateOfBirth;
        this.gender = gender;
        this.citizenshipStatus = citizenshipStatus;
        this.idNumber = idNumber;
        this.address = address;
        this.contactNumber = contactNumber;
        this.medicalAidProvider = medicalAidProvider;
        this.medicalAidNumber = medicalAidNumber;
        this.nextOfKin = List.copyOf(nextOfKin);
        this.registeredByUserId = registeredByUserId;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getMpiNumber() {
        return mpiNumber;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public Gender getGender() {
        return gender;
    }

    public CitizenshipStatus getCitizenshipStatus() {
        return citizenshipStatus;
    }

    public String getIdNumber() {
        return idNumber;
    }

    public String getAddress() {
        return address;
    }

    public String getContactNumber() {
        return contactNumber;
    }

    public String getMedicalAidProvider() {
        return medicalAidProvider;
    }

    public String getMedicalAidNumber() {
        return medicalAidNumber;
    }

    public UUID getRegisteredByUserId() {
        return registeredByUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<NextOfKin> getNextOfKin() {
        return nextOfKin;
    }
}
