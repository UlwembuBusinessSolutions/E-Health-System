import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ICD10_LABELS, getProductIndications, setProductIndications } from "@/shared/api/indications";

// Lets the pharmacy tag a product with the ICD-10 conditions it is used for (I10, E10.9, E11.9, E10.0 ...),
// so prescribing can "allow for medicines on the stated ICD-10 codes". Saves immediately on each change.

const FORMAT = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;

export function ProductIndications({ productId }: { productId: string }) {
  const client = useQueryClient();
  const key = ["product-indications", productId];
  const query = useQuery({ queryKey: key, queryFn: () => getProductIndications(productId) });
  const [codes, setCodes] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setCodes(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: (next: string[]) => setProductIndications(productId, next),
    onSuccess: (saved) => {
      setCodes(saved);
      client.setQueryData(key, saved);
    },
    onError: () => setError("Could not save. Try again."),
  });

  function change(next: string[]) {
    setError(null);
    setCodes(next);
    save.mutate(next);
  }

  function add(code: string) {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    if (!FORMAT.test(clean)) return setError("Use an ICD-10 code such as I10 or E11.9.");
    if (codes.includes(clean)) return setDraft("");
    setDraft("");
    change([...codes, clean].sort());
  }

  return (
    <fieldset className="space-y-2 rounded-lg border border-border-strong px-3.5 py-3">
      <legend className="px-1 text-[13px] font-medium text-text-primary">Used for (ICD-10)</legend>
      {query.isError && <p role="alert" className="text-[13px] text-danger-600">Could not load the conditions for this product.</p>}
      <div className="flex flex-wrap gap-2">
        {codes.length === 0 && <span className="text-[13px] text-text-secondary">No conditions recorded.</span>}
        {codes.map((code) => (
          <span key={code} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-[12.5px] text-text-primary">
            <span className="font-mono">{code}</span>
            {ICD10_LABELS[code] && <span className="text-text-secondary">{ICD10_LABELS[code]}</span>}
            <button type="button" aria-label={`Remove ${code}`} onClick={() => change(codes.filter((c) => c !== code))} className="ml-1 font-semibold">×</button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.keys(ICD10_LABELS).filter((code) => !codes.includes(code)).map((code) => (
          <button key={code} type="button" onClick={() => add(code)} className="min-h-9 rounded-full border border-border-strong px-3 text-[12.5px] hover:bg-surface-sunken">
            + {code}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(draft);
            }
          }}
          placeholder="Other ICD-10 code"
          aria-label="Other ICD-10 code"
          className="h-10 w-44 rounded-lg border border-border-strong bg-surface-raised px-3 font-mono text-[14px] uppercase"
        />
        <button type="button" onClick={() => add(draft)} className="min-h-10 rounded-lg border border-border-strong px-3 text-[13px] font-semibold">Add</button>
      </div>
      {error && <p role="alert" className="text-[13px] text-danger-600">{error}</p>}
    </fieldset>
  );
}
