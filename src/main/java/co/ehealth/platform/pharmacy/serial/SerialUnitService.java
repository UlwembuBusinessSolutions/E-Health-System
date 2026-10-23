package co.ehealth.platform.pharmacy.serial;

import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Keeps the serial register in step with the ledger. These methods run in the
// caller's transaction (the receipt or adjustment that moves the quantity),
// so a serial can never be registered without its ledger entry or vice versa.
@Service
public class SerialUnitService {

    private final PharmacySerialUnitRepository serialUnitRepository;

    public SerialUnitService(PharmacySerialUnitRepository serialUnitRepository) {
        this.serialUnitRepository = serialUnitRepository;
    }

    // Registers units that arrived in the ledger entry receivedEntryId.
    // A serial that is already on file for the product — in stock OR removed —
    // is refused: a serial number is a unit's identity for life.
    @Transactional
    public void registerSerials(UUID productId, UUID batchId, Collection<String> serialNumbers,
                                UUID receivedEntryId) {
        List<String> cleanSerials = cleanAndRejectRepeats(serialNumbers);
        serialUnitRepository.findByProductIdAndSerialNumberIn(productId, cleanSerials).stream()
                .findFirst()
                .ifPresent(existing -> {
                    throw new DuplicateSerialException(existing.getSerialNumber());
                });
        serialUnitRepository.saveAll(cleanSerials.stream()
                .map(serial -> new PharmacySerialUnit(productId, batchId, serial, receivedEntryId))
                .toList());
    }

    // Marks the named units as having left stock through ledger entry removedEntryId.
    @Transactional
    public void removeSerials(UUID productId, Collection<String> serialNumbers, UUID removedEntryId) {
        List<String> cleanSerials = cleanAndRejectRepeats(serialNumbers);
        Map<String, PharmacySerialUnit> unitsBySerial = serialUnitRepository
                .findByProductIdAndSerialNumberIn(productId, cleanSerials).stream()
                .collect(Collectors.toMap(PharmacySerialUnit::getSerialNumber, Function.identity()));
        for (String serial : cleanSerials) {
            PharmacySerialUnit unit = unitsBySerial.get(serial);
            if (unit == null || unit.getStatus() != SerialUnitStatus.IN_STOCK) {
                throw new SerialNotInStockException(serial);
            }
            unit.markRemoved(removedEntryId);
        }
        serialUnitRepository.saveAll(unitsBySerial.values());
    }

    // Used when a whole receipt is reversed: every unit still on the shelf
    // that arrived with one of the given ledger entries goes out with the
    // reversal entry paired to it (key = receiving entry, value = reversal entry).
    @Transactional
    public void removeSerialsReceivedWith(Map<UUID, UUID> reversalEntryIdByReceivedEntryId) {
        List<PharmacySerialUnit> unitsStillInStock = serialUnitRepository.findByReceivedEntryIdInAndStatus(
                reversalEntryIdByReceivedEntryId.keySet(), SerialUnitStatus.IN_STOCK);
        unitsStillInStock.forEach(unit ->
                unit.markRemoved(reversalEntryIdByReceivedEntryId.get(unit.getReceivedEntryId())));
        serialUnitRepository.saveAll(unitsStillInStock);
    }

    // Used when a removal is reversed: every unit that left stock through one
    // of the given ledger entries is back on the shelf.
    @Transactional
    public void restoreSerialsRemovedWith(Collection<UUID> removedEntryIds) {
        List<PharmacySerialUnit> removedUnits = serialUnitRepository.findByRemovedEntryIdInAndStatus(
                removedEntryIds, SerialUnitStatus.REMOVED);
        removedUnits.forEach(PharmacySerialUnit::restoreToStock);
        serialUnitRepository.saveAll(removedUnits);
    }

    // The serials of a product still on the shelf, grouped by lot, from one
    // query. Units without a lot are not listed.
    @Transactional(readOnly = true)
    public Map<UUID, List<String>> inStockSerialsByBatch(UUID productId) {
        return serialUnitRepository.findByProductIdAndStatusOrderBySerialNumberAsc(productId, SerialUnitStatus.IN_STOCK)
                .stream()
                .filter(unit -> unit.getBatchId() != null)
                .collect(Collectors.groupingBy(PharmacySerialUnit::getBatchId,
                        Collectors.mapping(PharmacySerialUnit::getSerialNumber, Collectors.toList())));
    }

    private static List<String> cleanAndRejectRepeats(Collection<String> serialNumbers) {
        Set<String> seen = new HashSet<>();
        return serialNumbers.stream().map(serial -> {
            String clean = serial == null ? "" : serial.trim();
            if (clean.isEmpty()) {
                throw new PharmacyValidationException("Serial numbers can't be blank.");
            }
            if (!seen.add(clean)) {
                throw new PharmacyValidationException("Serial number \"" + clean + "\" is listed more than once.");
            }
            return clean;
        }).toList();
    }
}
