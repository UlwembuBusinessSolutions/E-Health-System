import { useCallback, useState } from "react";
import { newReceiptLine, type ReceivableProduct, type ReceiptLineDraft } from "./receiptTypes";

/** The receipt's lines and the few ways they change; keeps the page free of array bookkeeping. */
export function useReceiptLines() {
  const [lines, setLines] = useState<ReceiptLineDraft[]>([]);

  const addProduct = useCallback((product: ReceivableProduct) => {
    setLines((current) => [...current, newReceiptLine(product)]);
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<ReceiptLineDraft>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  }, []);

  return { lines, addProduct, updateLine, removeLine, replaceLines: setLines };
}
