package co.ehealth.platform.pharmacy.register;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;

// End-of-day reconciliation: the pharmacist counts what is physically on
// the shelf, the register says what should be there, and any difference is
// explained before the day is signed off. A signed-off day is locked.
@Service
public class ScheduleDayCloseService {

    static final int MIN_VARIANCE_REASON_LENGTH = 5;

    // close is null while the day is still open.
    public record Reconciliation(UUID facilityId, UUID productId, LocalDate date, DayFigures figures,
                                 ScheduleDayClose close) {
    }

    public record CloseCommand(UUID facilityId, UUID productId, LocalDate date, long countedQuantity,
                               String varianceReason) {
    }

    private final ScheduleRegisterEntryRepository entryRepository;
    private final ScheduleDayCloseRepository dayCloseRepository;
    private final RegisterProductLockRepository productLockRepository;
    private final ScheduledProductLookup scheduledProducts;
    private final FacilityBusinessDay businessDay;
    private final Clock clock;

    public ScheduleDayCloseService(ScheduleRegisterEntryRepository entryRepository,
                                   ScheduleDayCloseRepository dayCloseRepository,
                                   RegisterProductLockRepository productLockRepository,
                                   ScheduledProductLookup scheduledProducts, FacilityBusinessDay businessDay,
                                   Clock clock) {
        this.entryRepository = entryRepository;
        this.dayCloseRepository = dayCloseRepository;
        this.productLockRepository = productLockRepository;
        this.scheduledProducts = scheduledProducts;
        this.businessDay = businessDay;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Reconciliation reconciliationFor(UUID facilityId, UUID productId, LocalDate date) {
        return dayCloseRepository.findByFacilityIdAndProductIdAndBusinessDate(facilityId, productId, date)
                .map(close -> new Reconciliation(facilityId, productId, date, close.figures(), close))
                .orElseGet(() -> new Reconciliation(facilityId, productId, date,
                        figuresFor(facilityId, productId, date), null));
    }

    @Transactional
    public Reconciliation close(CloseCommand command, UUID actorUserId, String actorName) {
        requireValidDate(command);
        requireScheduledProduct(command.productId());
        productLockRepository.lockProduct(command.productId());
        requireNotAlreadyClosed(command);

        DayFigures figures = figuresFor(command.facilityId(), command.productId(), command.date());
        String reason = varianceReasonFor(command.countedQuantity() - figures.expected(), command.varianceReason());
        ScheduleDayClose close = dayCloseRepository.save(new ScheduleDayClose(command.facilityId(),
                command.productId(), command.date(), figures, command.countedQuantity(), reason,
                new RegisterStaff(actorUserId, actorName), clock.instant()));
        return new Reconciliation(command.facilityId(), command.productId(), command.date(), figures, close);
    }

    private void requireValidDate(CloseCommand command) {
        if (command.countedQuantity() < 0) {
            throw new InvalidRegisterEntryException("The counted quantity cannot be negative.");
        }
        if (command.date().isAfter(businessDay.today(command.facilityId()))) {
            throw new InvalidRegisterEntryException("A day cannot be signed off before it has happened.");
        }
    }

    private void requireScheduledProduct(UUID productId) {
        if (scheduledProducts.scheduleOf(productId).isEmpty()) {
            throw new InvalidRegisterEntryException(
                    "This medicine is not a Schedule 5 or 6 product, so it has no register to sign off.");
        }
    }

    private void requireNotAlreadyClosed(CloseCommand command) {
        if (dayCloseRepository.existsByFacilityIdAndProductIdAndBusinessDate(command.facilityId(),
                command.productId(), command.date())) {
            throw new RegisterDayClosedException("This day has already been signed off for this medicine.");
        }
    }

    // A difference of zero needs no explanation; any other difference must
    // be explained in words before the day can be signed.
    private String varianceReasonFor(long variance, String reason) {
        if (variance == 0) {
            return null;
        }
        String trimmed = reason == null ? "" : reason.trim();
        if (trimmed.length() < MIN_VARIANCE_REASON_LENGTH) {
            throw new InvalidRegisterEntryException("The count differs from the register by " + variance
                    + ". Explain the difference (at least " + MIN_VARIANCE_REASON_LENGTH
                    + " characters) before signing off.");
        }
        return trimmed;
    }

    private DayFigures figuresFor(UUID facilityId, UUID productId, LocalDate date) {
        FacilityBusinessDay.Window window = businessDay.windowOf(facilityId, date);
        long balanceBeforeDay = entryRepository
                .findFirstByFacilityIdAndProductIdAndEntryAtLessThanOrderBySeqDesc(facilityId, productId,
                        window.start())
                .map(ScheduleRegisterEntry::getBalanceAfter)
                .orElse(0L);
        var entriesOfDay = entryRepository
                .findByFacilityIdAndProductIdAndEntryAtGreaterThanEqualAndEntryAtLessThanOrderBySeqAsc(
                        facilityId, productId, window.start(), window.end());
        return DayFigures.of(balanceBeforeDay, entriesOfDay);
    }
}
