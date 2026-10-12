package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemNotFoundException;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Component;

import java.util.UUID;

// Row-locks a prescription item before anything changes its dispensed
// quantity, so two pharmacists acting on the same item serialise: the second
// one sees the first one's result instead of both working from the same
// stale "remaining" number. The lock refreshes the entity too — the item may
// already have been read earlier in this transaction (a hand-over checks
// stock first), and that copy could be out of date by the time the lock is
// finally granted.
@Component
public class ItemLock {

    private final PrescriptionItemRepository itemRepository;
    private final EntityManager entityManager;

    public ItemLock(PrescriptionItemRepository itemRepository, EntityManager entityManager) {
        this.itemRepository = itemRepository;
        this.entityManager = entityManager;
    }

    public PrescriptionItem lockOwnedItem(Prescription prescription, UUID itemId) {
        PrescriptionItem item = itemRepository.findById(itemId).orElseThrow(PrescriptionItemNotFoundException::new);
        if (!item.getPrescriptionId().equals(prescription.getId())) {
            throw new PrescriptionItemNotFoundException();
        }
        entityManager.refresh(item, LockModeType.PESSIMISTIC_WRITE);
        return item;
    }
}
