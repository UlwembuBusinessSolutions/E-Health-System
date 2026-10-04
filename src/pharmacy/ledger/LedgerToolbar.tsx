import { FilterChips } from "@/pharmacy/components/FilterChips";
import { SearchInput } from "@/pharmacy/components/SearchInput";
import { DATE_RANGE_OPTIONS, type DateRangeKey } from "./lib/dateRange";

interface LedgerToolbarProps {
  searchLabel: string;
  searchPlaceholder: string;
  onSearch: (query: string) => void;
  range: DateRangeKey;
  onRangeChange: (range: DateRangeKey) => void;
}

// Search box and date-range chips, identical on both tabs. Pressing the active
// chip again clears it, which for a date range simply means "All time".
export function LedgerToolbar({ searchLabel, searchPlaceholder, onSearch, range, onRangeChange }: LedgerToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <SearchInput label={searchLabel} placeholder={searchPlaceholder} onSearch={onSearch} className="w-full sm:max-w-md" />
      <FilterChips
        label="Date range"
        options={DATE_RANGE_OPTIONS}
        value={range}
        onChange={(next) => onRangeChange(next ?? "ALL")}
      />
    </div>
  );
}
