package co.ehealth.platform.patient;

import jakarta.persistence.Embeddable;

@Embeddable
public class NextOfKin {

    private String name;
    private String relationship;
    private String contactNumber;

    protected NextOfKin() {
    }

    public NextOfKin(String name, String relationship, String contactNumber) {
        this.name = name;
        this.relationship = relationship;
        this.contactNumber = contactNumber;
    }

    public String getName() {
        return name;
    }

    public String getRelationship() {
        return relationship;
    }

    public String getContactNumber() {
        return contactNumber;
    }
}