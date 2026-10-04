// Plain CSV reading and writing, with no dependency on the screens that use it.

const DELIMITERS = [",", "\t", ";"] as const;

// Spreadsheets in some locales save "CSV" with semicolons, and pasting from a
// sheet gives tabs. The delimiter that appears most on the first line wins.
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = DELIMITERS.map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length - 1 }));
  return counts.reduce((best, current) => (current.count > best.count ? current : best)).delimiter;
}

/** Splits CSV / TSV text into rows of cells. Handles quotes, escaped quotes and blank lines. */
export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  function endCell() {
    row.push(cell.trim());
    cell = "";
  }

  function endRow() {
    endCell();
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      endRow();
    } else {
      cell += char;
    }
  }
  endRow();
  return rows;
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Rows of cells -> CSV text (comma separated, CRLF line ends so Excel opens it cleanly). */
export function formatCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/** Saves text as a file through the browser's normal download flow. */
export function downloadTextFile(filename: string, content: string, mimeType = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
