package co.ehealth.platform.pharmacy.stock;

import java.util.UUID;

// How a product must be handled once it is on the shelf, grouped so the
// create path does not grow another four loose parameters. serialTracked is
// frozen after creation like batchTracked; the rest can be edited later.
public record ProductHandling(boolean serialTracked, DrugSchedule schedule, boolean coldChain,
                              UUID preferredSupplierId) {
}
