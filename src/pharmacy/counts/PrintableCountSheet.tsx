import type { CountDetail } from "@/shared/api/pharmacyCounts";
import { formatDate } from "../lib/format";
import { PrintArea } from "../components/PrintArea";

// Paper copy for walking the shelves. Deliberately never prints the system
// quantity, so even a non-blind count sheet can be filled in honestly.
export function PrintableCountSheet({ count }: { count: CountDetail }) {
  return (
    <PrintArea className="p-8 text-[12pt]">
      <h1 className="text-[18pt] font-semibold">Stock count sheet {count.reference}</h1>
      <p className="mb-4">
        {count.scopeLabel} &middot; started {formatDate(count.startedAt)} by {count.startedByName}
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left">
            {["Product", "Lot", "Expiry", "Counted"].map((heading) => (
              <th key={heading} className="border-b border-black py-1.5 pr-3">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {count.lines.map((line) => (
            <tr key={line.id}>
              <td className="border-b border-gray-400 py-2 pr-3">
                {line.productName} ({line.productCode})
              </td>
              <td className="border-b border-gray-400 py-2 pr-3">{line.lotNumber}</td>
              <td className="border-b border-gray-400 py-2 pr-3">{line.expiryDate ? formatDate(line.expiryDate) : "—"}</td>
              <td className="w-32 border-b border-gray-400 py-2" />
            </tr>
          ))}
        </tbody>
      </table>
    </PrintArea>
  );
}
