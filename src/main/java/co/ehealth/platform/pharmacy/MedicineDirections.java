package co.ehealth.platform.pharmacy;

import jakarta.validation.constraints.Size;

// How a prescribed medicine is to be taken, kept as separate facts so screens can show them in
// columns. The readable sentence the pharmacy and the printout use lives in the line's `dosage`.
public record MedicineDirections(@Size(max = 100) String strengthForm, @Size(max = 100) String dose,
                                 @Size(max = 30) String route, @Size(max = 120) String frequency,
                                 @Size(max = 100) String duration, @Size(max = 20) String quantityUnit,
                                 @Size(max = 500) String instructions) {

    public boolean isEmpty() {
        return strengthForm == null && dose == null && route == null && frequency == null && duration == null
                && quantityUnit == null && instructions == null;
    }
}
