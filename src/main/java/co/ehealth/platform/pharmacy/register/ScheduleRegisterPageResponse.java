package co.ehealth.platform.pharmacy.register;

import org.springframework.data.domain.Page;

import java.util.List;

// The shared paging shape (items, page, size, totalItems, hasMore) plus the
// register's current balance. currentBalance is null when the listing spans
// several products, because a single running balance would be meaningless.
public record ScheduleRegisterPageResponse(Long currentBalance, List<RegisterEntryResponse> items, int page,
                                           int size, long totalItems, boolean hasMore) {

    static ScheduleRegisterPageResponse of(Long currentBalance, List<RegisterEntryResponse> items, Page<?> page) {
        return new ScheduleRegisterPageResponse(currentBalance, items, page.getNumber(), page.getSize(),
                page.getTotalElements(), page.hasNext());
    }
}
