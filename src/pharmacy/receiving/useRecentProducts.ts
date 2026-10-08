import { useCallback, useMemo, useState } from "react";
import { readStored, writeStored } from "./localStore";
import type { ReceivableProduct } from "./receiptTypes";

const MAX_RECENT = 6;

function isProductList(value: unknown): value is ReceivableProduct[] {
  return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null && "id" in item);
}

const recentKey = (facilityId: string) => `pharmacy.recentlyReceived.${facilityId}`;

/**
 * Powers the "Often received" chips. There is no server endpoint for it, so
 * it remembers what this browser last posted for the facility.
 */
export function useRecentProducts(facilityId: string) {
  const [revision, setRevision] = useState(0);

  const recent = useMemo(
    () => (facilityId ? (readStored(recentKey(facilityId), isProductList) ?? []) : []),
    // `revision` is the intended trigger, not a value the callback reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facilityId, revision],
  );

  const remember = useCallback(
    (products: ReceivableProduct[]) => {
      const incomingIds = new Set(products.map((product) => product.id));
      const kept = recent.filter((product) => !incomingIds.has(product.id));
      const unique = [...new Map(products.map((product) => [product.id, product])).values()];
      writeStored(recentKey(facilityId), [...unique, ...kept].slice(0, MAX_RECENT));
      setRevision((current) => current + 1);
    },
    [facilityId, recent],
  );

  return { recent, remember };
}
