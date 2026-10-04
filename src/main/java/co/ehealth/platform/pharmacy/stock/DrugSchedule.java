package co.ehealth.platform.pharmacy.stock;

// South African medicine schedules that need extra control at the counter.
// Only 5 and 6 are modelled — they are the ones the scheduled-medicine
// register (contract section 1) tracks; lower schedules need no extra rule.
public enum DrugSchedule {
    S5, S6
}
