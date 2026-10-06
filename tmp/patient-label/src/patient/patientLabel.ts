import JsBarcode from "jsbarcode";
import type { Patient } from "@/shared/api/patients";

// 100 x 65 mm at approximately 300 dpi. Keep the barcode at integer pixel
// widths and preserve its quiet zones in both the preview and PDF.
export function renderPatientLabel(patient: Patient): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 780;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create the label.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.textBaseline = "top";
  ctx.font = "28px Arial";
  ctx.fillText("PATIENT IDENTIFICATION", 48, 40);
  const name = `${patient.firstName} ${patient.lastName}`;
  let lines: string[] = [];
  for (let size = 48; size >= 24; size -= 2) {
    ctx.font = `bold ${size}px Arial`;
    lines = [""];
    for (const character of name) {
      const last = lines.length - 1;
      if (ctx.measureText(lines[last] + character).width > 1104) lines.push(character);
      else lines[last] += character;
    }
    if (lines.length <= 3) break;
  }
  if (lines.length > 3) throw new Error("Patient name is too long for this label.");
  lines.forEach((line, i) => ctx.fillText(line, 48, 100 + i * 54));
  ctx.font = "bold 40px Arial";
  ctx.fillText(`MPI: ${patient.mpiNumber}`, 48, 285);
  ctx.font = "30px Arial";
  ctx.fillText(`Date of birth: ${patient.dateOfBirth}`, 48, 350);
  ctx.fillText(`ID: ${patient.idNumber}`, 48, 400);
  const barcode = document.createElement("canvas");
  JsBarcode(barcode, patient.mpiNumber, {
    format: "CODE128", width: 3, height: 170, margin: 30,
    displayValue: true, fontSize: 30, textMargin: 12,
    background: "#ffffff", lineColor: "#000000",
  });
  // Never shrink bars to fractional pixels to squeeze an unexpected MPI in.
  if (barcode.width > 1104) throw new Error("MPI is too long for this label.");
  ctx.drawImage(barcode, Math.floor((1200 - barcode.width) / 2), 465);
  return canvas;
}

export async function downloadPatientLabel(canvas: HTMLCanvasElement, mpi: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, 10, 100, 65);
  pdf.save(`patient-label-${mpi.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`);
}
