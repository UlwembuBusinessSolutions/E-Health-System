package co.ehealth.platform.pharmacy;

import java.util.List;

public class DuplicateSupplyException extends InvalidDispenseException {
    private final List<PrescriptionSafetyService.SupplyWarning> warnings;
    public DuplicateSupplyException(List<PrescriptionSafetyService.SupplyWarning> warnings) {
        super("Potential duplicate dispensing: review the prior supply and acknowledge the warning or decline to dispense.");
        this.warnings = List.copyOf(warnings);
    }
    public List<PrescriptionSafetyService.SupplyWarning> getWarnings() { return warnings; }
}
