package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.PrescriptionItem;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

// Read side of substitutions, split from SubstitutionService so dispensing
// can ask "which product do I actually dispense?" without depending on the
// prescriber-messaging workflow.
@Component
public class SubstitutionLookup {

    private final PrescriptionSubstitutionRepository substitutionRepository;

    public SubstitutionLookup(PrescriptionSubstitutionRepository substitutionRepository) {
        this.substitutionRepository = substitutionRepository;
    }

    // The current (newest) substitution per item, one query for the batch.
    public Map<UUID, PrescriptionSubstitution> latestByItem(Collection<UUID> itemIds) {
        if (itemIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, PrescriptionSubstitution> latest = new LinkedHashMap<>();
        substitutionRepository.findByPrescriptionItemIdInOrderByRequestedAtDesc(itemIds)
                .forEach(substitution -> latest.putIfAbsent(substitution.getPrescriptionItemId(), substitution));
        return latest;
    }

    public UUID dispensingProductId(PrescriptionItem item) {
        PrescriptionSubstitution latest = substitutionRepository
                .findFirstByPrescriptionItemIdOrderByRequestedAtDesc(item.getId()).orElse(null);
        return dispensingProductId(item, latest);
    }

    // The product stock is drawn from: a substitute is never dispensed
    // unless the prescriber approved it, so only an APPROVED latest
    // substitution replaces the confirmed product (null while unmapped).
    // `latest` may be null (no substitution was ever requested).
    public static UUID dispensingProductId(PrescriptionItem item, PrescriptionSubstitution latest) {
        if (latest != null && latest.getStatus() == SubstitutionStatus.APPROVED) {
            return latest.getSubstituteProductId();
        }
        return item.getProductId();
    }
}
