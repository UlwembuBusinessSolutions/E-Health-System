import type { QueueEntry } from "@/shared/api/queue";

type QueueReport = {
  clinicName: string;
  date: string;
  statuses: string[];
  priority?: string;
  search?: string;
  entries: QueueEntry[];
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const LEFT = 42;
const ROW_HEIGHT = 24;
const ROWS_PER_PAGE = 19;

function pdfText(value: string): string {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&");
}

function dateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function makePage(report: QueueReport, pageIndex: number, pageCount: number): string {
  const start = pageIndex * ROWS_PER_PAGE;
  const entries = report.entries.slice(start, start + ROWS_PER_PAGE);
  const commands: string[] = [
    "0.10 0.35 0.30 rg",
    `0 530 ${PAGE_WIDTH} 65 re f`,
    "BT /F2 19 Tf 1 1 1 rg",
    `1 0 0 1 ${LEFT} 563 Tm (${pdfText("Queue register")}) Tj ET`,
    "BT /F1 10 Tf 0.12 0.18 0.20 rg",
    `1 0 0 1 ${LEFT} 510 Tm (${pdfText(report.clinicName)}  |  ${pdfText(dateLabel(report.date))}) Tj ET`,
  ];
  const filters = [
    report.statuses.join(", "),
    ...(report.priority ? [report.priority] : []),
    ...(report.search ? [`Search: ${report.search}`] : []),
    `${report.entries.length} tickets`,
  ].join("  |  ");
  commands.push(`BT /F1 9 Tf 0.36 0.41 0.42 rg 1 0 0 1 ${LEFT} 492 Tm (${pdfText(filters.slice(0, 130))}) Tj ET`);

  const cols = [LEFT, 114, 265, 424, 518, 628, 752];
  const labels = ["TOKEN", "PATIENT", "MPI", "PRIORITY", "STATUS", "ISSUED"];
  commands.push("0.91 0.95 0.94 rg", `42 ${PAGE_HEIGHT - 137} 758 27 re f`);
  labels.forEach((label, index) => {
    commands.push(`BT /F2 8 Tf 0.12 0.24 0.22 rg 1 0 0 1 ${cols[index] + 7} ${PAGE_HEIGHT - 128} Tm (${label}) Tj ET`);
  });

  entries.forEach((entry, index) => {
    const y = PAGE_HEIGHT - 164 - index * ROW_HEIGHT;
    if (index % 2 === 1) commands.push(`0.975 0.982 0.98 rg 42 ${y - 6} 758 ${ROW_HEIGHT} re f`);
    const values = [
      `#${entry.token.tokenNumber}`,
      entry.patientName,
      entry.patientMpi,
      entry.token.priority === "PRIORITY" ? "Priority" : "Standard",
      ({ ISSUED: "Waiting", CALLED: "Called", MISSED: "Missed", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const)[entry.token.status],
      new Date(entry.token.issuedAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }),
    ];
    values.forEach((value, col) => {
      const maxChars = col === 1 ? 24 : col === 2 ? 19 : 16;
      commands.push(`BT /${col === 0 || col === 2 ? "F3" : "F1"} 9 Tf 0.13 0.18 0.20 rg 1 0 0 1 ${cols[col] + 7} ${y} Tm (${pdfText(String(value).slice(0, maxChars))}) Tj ET`);
    });
    commands.push(`0.87 0.90 0.89 RG 0.5 w 42 ${y - 7} m 800 ${y - 7} l S`);
  });

  commands.push("0.42 0.47 0.47 rg", `BT /F1 8 Tf 1 0 0 1 ${LEFT} 22 Tm (${pdfText(`Generated ${new Date().toLocaleString("en-ZA")}`)}) Tj ET`);
  commands.push(`BT /F1 8 Tf 1 0 0 1 748 22 Tm (Page ${pageIndex + 1} of ${pageCount}) Tj ET`);
  return commands.join("\n");
}

function createPdf(report: QueueReport): Blob {
  const pageCount = Math.max(1, Math.ceil(report.entries.length / ROWS_PER_PAGE));
  const objects: string[] = [];
  const addObject = (value: string) => { objects.push(value); return objects.length; };
  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const fontMonoId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const pageIds: number[] = [];

  for (let i = 0; i < pageCount; i += 1) {
    const stream = makePage(report, i, pageCount);
    const streamId = addObject(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontMonoId} 0 R >> >> /Contents ${streamId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  let document = "%PDF-1.4\n%queue-report\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(document).length);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(document).length;
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { document += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  document += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([document], { type: "application/pdf" });
}

export function downloadQueueReportPdf(report: QueueReport): void {
  const link = document.createElement("a");
  const clinic = report.clinicName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "clinic";
  link.href = URL.createObjectURL(createPdf(report));
  link.download = `queue-register-${clinic}-${report.date}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 30_000);
}
