package co.ehealth.platform.pharmacy.register;

public enum MedicineSchedule {
    S5, S6;

    // Schedule 6 movements need a second person to confirm them.
    public boolean requiresWitness() {
        return this == S6;
    }
}
