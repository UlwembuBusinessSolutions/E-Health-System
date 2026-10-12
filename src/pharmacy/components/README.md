# Pharmacy shared components

Import from `@/pharmacy/components/<Name>` and `@/pharmacy/lib/<name>`. Do not rebuild any of these per page.

| Component | Key props | Usage |
| --- | --- | --- |
| `Modal` | `open`, `title`, `description?`, `footer?`, `onClose`, `dismissible?` (false while saving), `size?` sm/md/lg. Full-screen sheet below `sm`. | `<Modal open={open} title="Remove stock" onClose={close} footer={<Button>Save</Button>}>…form…</Modal>` |
| `Drawer` | Same as Modal minus `size`. Right-side panel, full width on mobile. | `<Drawer open={open} title="Collection" onClose={close}>…</Drawer>` |
| `ConfirmDialog` | `open`, `title`, `body`, `confirmLabel?`, `cancelLabel?`, `tone?` default/danger, `loading?`, `onConfirm`, `onCancel` | `<ConfirmDialog open={open} tone="danger" title="Reverse receipt?" body="…" loading={m.isPending} onConfirm={m.mutate} onCancel={close} />` |
| `SearchInput` | `label` (aria-label), `placeholder?`, `initialValue?`, `onSearch(q)` (debounced 250 ms, instant on clear), `className?` | `<SearchInput label="Search products" onSearch={setQuery} />` |
| `QuantityInput` | `value`, `onChange`, `label`, `min?` (0), `max?`, `step?` (1), `disabled?`. Typing always works; clamped on blur/buttons/arrow keys. | `<QuantityInput label="Quantity" value={qty} min={1} max={lot.balance} onChange={setQty} />` |
| `ReasonPicker<T>` | `legend`, `options[{value,label,description?}]`, `value: T\|null`, `onChange`, `note`, `onNoteChange`, `otherValue?` ("OTHER"), `minNoteLength?` (3). Chosen `otherValue` reveals a required note. | `<ReasonPicker legend="Why?" options={REASONS} value={reason} onChange={setReason} note={note} onNoteChange={setNote} />` |
| `StockStatusPill` | `status`: `IN_STOCK \| LOW \| OUT \| EXPIRED \| EXPIRING_SOON \| ARCHIVED` (icon + text) | `<StockStatusPill status="LOW" />` |
| `ExpiryText` | `date: string\|null` (`YYYY-MM-DD`), `className?`. Amber within 90 days, red when expired, wording says why. | `<ExpiryText date={lot.expiryDate} />` |
| `EmptyState` | `title`, `description?`, `icon?` (lucide), `action?` | `<EmptyState title="No suppliers yet" action={<Button>Add supplier</Button>} />` |
| `ErrorState` | `message`, `onRetry?`, `retrying?` | `<ErrorState message={describeError(error)} onRetry={() => void query.refetch()} />` |
| `SkeletonRows` | `rows?` (5). Pulses only if motion is allowed. | `{query.isLoading && <SkeletonRows rows={8} />}` |
| `FilterChips<T>` | `label`, `options[{value,label,count?}]`, `value: T\|null`, `onChange(T\|null)` (re-press clears) | `<FilterChips label="Stock status" options={chips} value={status} onChange={setStatus} />` |
| `PageToolbar` | `title?`, `children` (filters, left), `actions?` (right; full-width on mobile) | `<PageToolbar actions={<Button>Receive</Button>}><SearchInput … /></PageToolbar>` |
| `ResponsiveTable<T>` | `label`, `columns[{key,header,cell,role?,align?}]`, `rows`, `getRowKey`, `loading?`, `refreshing?`, `errorMessage?`, `onRetry?`, `empty?`, `renderExpanded?`, `pagination?`. Table at `md`+, cards below: `role:"primary"` = card headline, `"secondary"` = opposite it (status), others = labelled rows. Put interactive controls (expand button, links) inside cells. | `<ResponsiveTable label="Stock" columns={cols} rows={page.items} getRowKey={(r) => r.id} loading={q.isLoading} pagination={{ page, size, totalItems, hasMore, onPageChange: setPage }} />` |
| `PaginationFooter` | Used by `ResponsiveTable`; usable alone. `page` (0-based), `size`, `totalItems`, `hasMore`, `onPageChange` | `<PaginationFooter {...pagination} />` |
| `DialogFrame` | Internal base of Modal/Drawer. Do not use directly. | – |

## lib

| Export | Purpose |
| --- | --- |
| `format.ts`: `formatDate(iso)` -> `30 Sep 2026`, `formatDateTime`, `daysUntil(date)`, `pluralise(n, "box", "boxes?")` | Display formatting |
| `units.ts`: `formatQuantity(90, "TABLET")` -> `90 tablets`, `unitLabel(unit, n?)`, `packsFor(qty, packSize)`, `roundUpToPack(qty, packSize)` | Unit labels (incl. BOX/KIT) and pack maths |
| `useDebouncedValue(value, ms = 250)` | Debounce any value |
| `usePagedQuery({ queryKey, fetchPage, page, size?, enabled? })` | `useQuery` for `{items,page,size,totalItems,hasMore}` with `keepPreviousData` and a 30 s `staleTime` |
| `useMediaQuery(query)` | Live `matchMedia` boolean |
| `problem.ts`: `describeError(error, fallback?)`, `problemCode(error)` | Readable message / 409 `code` (e.g. `DUPLICATE_SUPPLIER`) from an `ApiError` |
