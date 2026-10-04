package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.PrescriptionStatus;

import java.util.List;

// The pharmacist's view of where a prescription is: still to be dispensed
// (QUEUE), stuck waiting for stock (OUT_OF_STOCK), or done (DISPENSED). ALL is
// only a search filter, never the state of a real prescription.
public enum SearchState {
    ALL(List.of(PrescriptionStatus.PENDING, PrescriptionStatus.PARTIALLY_DISPENSED,
            PrescriptionStatus.OUT_OF_STOCK, PrescriptionStatus.DISPENSED)),
    QUEUE(List.of(PrescriptionStatus.PENDING, PrescriptionStatus.PARTIALLY_DISPENSED)),
    OUT_OF_STOCK(List.of(PrescriptionStatus.OUT_OF_STOCK)),
    DISPENSED(List.of(PrescriptionStatus.DISPENSED));

    private final List<PrescriptionStatus> statuses;

    SearchState(List<PrescriptionStatus> statuses) {
        this.statuses = statuses;
    }

    public List<PrescriptionStatus> statuses() {
        return statuses;
    }

    public static SearchState of(PrescriptionStatus status) {
        return switch (status) {
            case PENDING, PARTIALLY_DISPENSED -> QUEUE;
            case OUT_OF_STOCK -> OUT_OF_STOCK;
            case DISPENSED -> DISPENSED;
        };
    }
}
