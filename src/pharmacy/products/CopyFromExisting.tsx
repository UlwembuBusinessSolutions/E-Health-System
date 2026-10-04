import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { listProducts, type PharmacyProduct } from "@/shared/api/pharmacyStock";
import { Button } from "@/shared/components/Button";
import { SearchInput } from "../components/SearchInput";
import { describeError } from "../lib/problem";

interface CopyFromExistingProps {
  onPick: (product: PharmacyProduct) => void;
}

// Server-side search, so it works on a catalog of any size; nothing is
// fetched until the user has typed something.
export function CopyFromExisting({ onPick }: CopyFromExistingProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useQuery({
    queryKey: ["pharmacy", "products", "copy-search", query],
    queryFn: () => listProducts({ q: query, size: 8 }),
    enabled: open && query !== "",
    staleTime: 30_000,
  });

  function pick(product: PharmacyProduct) {
    setOpen(false);
    setQuery("");
    onPick(product);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        aria-expanded={open}
        icon={<Copy className="size-4" aria-hidden />}
        onClick={() => setOpen((current) => !current)}
        className="self-start"
      >
        Copy an existing product
      </Button>
      {open && (
        <div className="overflow-hidden rounded-lg border border-border-strong bg-surface-raised">
          <div className="p-2">
            <SearchInput label="Search products to copy" placeholder="Search a product to copy, for example Gloves" onSearch={setQuery} />
          </div>
          {matches.isError && <p role="alert" className="px-4 py-3 text-[13px] text-danger-600">{describeError(matches.error)}</p>}
          {matches.data?.items.length === 0 && <p className="px-4 py-3 text-[13px] text-text-secondary">No product matches.</p>}
          <ul>
            {matches.data?.items.map((product) => (
              <li key={product.id} className="border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => pick(product)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                >
                  <span className="text-[14px] font-semibold text-text-primary">{product.displayName}</span>
                  <span className="font-mono text-[12.5px] text-text-secondary">{product.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
