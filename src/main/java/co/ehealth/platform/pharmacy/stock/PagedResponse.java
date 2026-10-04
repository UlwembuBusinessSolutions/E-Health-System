package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

// The pagination envelope every pharmacy list endpoint returns
// (contract section 3): {items, page, size, totalItems, hasMore}.
public record PagedResponse<T>(List<T> items, int page, int size, long totalItems, boolean hasMore) {

    public static <S, T> PagedResponse<T> of(Page<S> page, Function<S, T> toItem) {
        return new PagedResponse<>(page.getContent().stream().map(toItem).toList(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.hasNext());
    }
}
