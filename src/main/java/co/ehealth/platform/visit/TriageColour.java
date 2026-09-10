package co.ehealth.platform.visit;

public enum TriageColour {
    RED("Immediate", null),
    ORANGE("10 minutes", 10),
    YELLOW("60 minutes", 60),
    GREEN("4 hours", 240),
    BLUE("Deceased", null);

    private final String sla;
    private final Integer slaMinutes;

    TriageColour(String sla, Integer slaMinutes) {
        this.sla = sla;
        this.slaMinutes = slaMinutes;
    }

    public String getSla() {
        return sla;
    }

    public Integer getSlaMinutes() {
        return slaMinutes;
    }
}
