package co.ehealth.platform.pharmacy.register;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

// The single place a register entry is written. Both manual entries and the
// automatic entry made when a scheduled medicine is dispensed come through
// here, so the same rules hold for each: today must still be open, an
// opening balance can only start an empty register, and nothing may take
// the balance below zero.
@Component
class ScheduleRegisterAppender {

    private final ScheduleRegisterEntryRepository entryRepository;
    private final ScheduleDayCloseRepository dayCloseRepository;
    private final RegisterProductLockRepository productLockRepository;
    private final FacilityBusinessDay businessDay;
    private final Clock clock;

    ScheduleRegisterAppender(ScheduleRegisterEntryRepository entryRepository,
                             ScheduleDayCloseRepository dayCloseRepository,
                             RegisterProductLockRepository productLockRepository, FacilityBusinessDay businessDay,
                             Clock clock) {
        this.entryRepository = entryRepository;
        this.dayCloseRepository = dayCloseRepository;
        this.productLockRepository = productLockRepository;
        this.businessDay = businessDay;
        this.clock = clock;
    }

    @Transactional
    ScheduleRegisterEntry append(RegisterEntryDetails details) {
        requirePositiveQuantity(details.quantity());
        productLockRepository.lockProduct(details.productId());
        requireTodayStillOpen(details.facilityId(), details.productId());
        requireOpeningOnlyOnEmptyRegister(details);

        long balanceBefore = currentBalance(details.facilityId(), details.productId());
        long balanceAfter = details.kind().balanceAfter(balanceBefore, details.quantity());
        if (balanceAfter < 0) {
            throw new RegisterBalanceExceededException(balanceBefore);
        }
        return entryRepository.save(new ScheduleRegisterEntry(details, balanceAfter, clock.instant()));
    }

    long currentBalance(UUID facilityId, UUID productId) {
        return entryRepository.findFirstByFacilityIdAndProductIdOrderBySeqDesc(facilityId, productId)
                .map(ScheduleRegisterEntry::getBalanceAfter)
                .orElse(0L);
    }

    private void requirePositiveQuantity(long quantity) {
        if (quantity <= 0) {
            throw new InvalidRegisterEntryException("Enter a quantity greater than zero.");
        }
    }

    private void requireTodayStillOpen(UUID facilityId, UUID productId) {
        if (dayCloseRepository.existsByFacilityIdAndProductIdAndBusinessDate(facilityId, productId,
                businessDay.today(facilityId))) {
            throw new RegisterDayClosedException(
                    "Today's register for this medicine has been signed off. No more entries can be added today.");
        }
    }

    boolean hasEntries(UUID facilityId, UUID productId) {
        return entryRepository.existsByFacilityIdAndProductId(facilityId, productId);
    }

    private void requireOpeningOnlyOnEmptyRegister(RegisterEntryDetails details) {
        if (details.kind() == RegisterEntryKind.OPENING
                && entryRepository.existsByFacilityIdAndProductId(details.facilityId(), details.productId())) {
            throw new InvalidRegisterEntryException(
                    "An opening balance can only be entered before any other register entry.");
        }
    }
}
