import { renderPlanSvg } from "./plan-svg";
import type { ExportFormat, FloorPlan } from "./types";
import type { DisplayLayers } from "./layers";
import { DEFAULT_DISPLAY_LAYERS } from "./layers";
import type { DisplayUnit } from "./units";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, image.naturalWidth || image.width);
      canvas.height = Math.max(1, image.naturalHeight || image.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not create a drawing context."));
        return;
      }
      ctx.fillStyle = "#efeae1";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      canvas.toBlob((png) => {
        if (!png) {
          reject(new Error("Could not encode PNG."));
          return;
        }
        resolve(png);
      }, "image/png");
    };
    image.onerror = () => {
      reject(new Error("Could not rasterize the floor plan."));
    };
    image.src = url;
  });
}

async function pngToPdfBlob(png: Blob) {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = new Uint8Array(await png.arrayBuffer());
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(bytes);
  const margin = 24;
  const maxW = 792 - margin * 2;
  const maxH = 612 - margin * 2;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const pageW = drawW + margin * 2;
  const pageH = drawH + margin * 2;
  const page = pdf.addPage([pageW, pageH]);
  page.drawImage(image, {
    x: margin,
    y: margin,
    width: drawW,
    height: drawH,
  });
  const output = await pdf.save();
  const copy = Uint8Array.from(output);
  return new Blob([copy], { type: "application/pdf" });
}

export async function downloadPlanExport(
  plan: FloorPlan,
  format: ExportFormat,
  filename: string,
  displayUnit: DisplayUnit = "m",
  layers: DisplayLayers = DEFAULT_DISPLAY_LAYERS,
) {
  const svg = renderPlanSvg(plan, displayUnit, layers);
  if (format === "png") {
    const png = await svgToPngBlob(svg);
    triggerDownload(png, filename);
    return;
  }
  const png = await svgToPngBlob(svg);
  const pdf = await pngToPdfBlob(png);
  triggerDownload(pdf, filename);
}
