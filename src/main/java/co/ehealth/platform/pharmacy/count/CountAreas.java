package co.ehealth.platform.pharmacy.count;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

// Works out which shelf areas a pharmacy can count. An area is a product's
// storage instruction ("Fridge 2-8 C", "Dispensary shelf B"), and an AREA
// count covers every stocked lot whose storage text contains the area label
// (CountStockAccountRepository.findStockedInArea). The lot totals here use
// that same contains rule, so the number shown beside an area is exactly the
// number of lots the count would list.
final class CountAreas {

    record Area(String label, int lotCount) {
    }

    private CountAreas() {
    }

    // storagePerLot holds one entry per stocked lot: its product's storage
    // instruction, or null/blank when the product has none.
    static List<Area> derive(List<String> storagePerLot) {
        return labelsOf(storagePerLot).stream()
                .map(label -> new Area(label, lotsInArea(label, storagePerLot)))
                .toList();
    }

    // Distinct labels ignoring case, in alphabetical order, keeping the
    // spelling first seen.
    private static List<String> labelsOf(List<String> storagePerLot) {
        Map<String, String> labelByLowerCase = new TreeMap<>();
        for (String storage : storagePerLot) {
            if (storage != null && !storage.isBlank()) {
                labelByLowerCase.putIfAbsent(storage.trim().toLowerCase(Locale.ROOT), storage.trim());
            }
        }
        return new ArrayList<>(labelByLowerCase.values());
    }

    private static int lotsInArea(String label, List<String> storagePerLot) {
        String wanted = label.toLowerCase(Locale.ROOT);
        return (int) storagePerLot.stream()
                .filter(storage -> storage != null && storage.toLowerCase(Locale.ROOT).contains(wanted))
                .count();
    }
}
