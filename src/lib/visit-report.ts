import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type VisitReportVisit = {
  id: string;
  scheduled_at: string;
  visited_at: string | null;
  status: string;
  technician?: { full_name: string | null } | null;
  pool?: {
    name: string | null;
    address: string | null;
    client?: { name: string; phone: string } | null;
  } | null;
};

type ReportRecord = {
  ph: number | null;
  free_chlorine: number | null;
  alkalinity: number | null;
  cyanuric_acid: number | null;
  chemicals: unknown;
  tasks: unknown;
  photo_before: string | null;
  photo_after: string | null;
  notes: string | null;
  created_at: string;
  temperature: number | null;
  calcium_hardness: number | null;
  photo_machine: string | null;
  photo_note: string | null;
};

type PhotoKey = "photo_before" | "photo_after" | "photo_machine" | "photo_note";

const safe = (value: string) => value.replace(/[^\x20-\x7E\u00A0-\u00FF–—•]/g, "");
const clean = (value: string) => safe(value).replace(/\s+/g, " ").trim();

async function toJpeg(url: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a foto.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível converter a foto.")), "image/jpeg", 0.8);
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = clean(value).split(" ").filter(Boolean);
  if (!words.length) return ["—"];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(page: PDFPage, value: string, options: { x: number; top: number; width: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; lineGap?: number }) {
  const lineGap = options.lineGap ?? 2;
  const lines = wrapText(value, options.font, options.size, options.width);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.top - options.size - index * (options.size + lineGap),
      size: options.size,
      font: options.font,
      color: options.color,
    });
  });
  return options.top - lines.length * (options.size + lineGap);
}

function drawCard(page: PDFPage, x: number, y: number, width: number, height: number, fill: ReturnType<typeof rgb>, border: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width, height, color: fill, borderColor: border, borderWidth: 0.8 });
}

function drawSectionTitle(page: PDFPage, title: string, x: number, y: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  page.drawText(safe(title.toUpperCase()), { x, y, size: 8, font, color, characterSpacing: 0.5 });
}

function drawField(page: PDFPage, label: string, value: string, x: number, top: number, width: number, font: PDFFont, bold: PDFFont, colors: { label: ReturnType<typeof rgb>; text: ReturnType<typeof rgb> }) {
  page.drawText(safe(label.toUpperCase()), { x, y: top - 8, size: 6.5, font: bold, color: colors.label, characterSpacing: 0.35 });
  drawWrapped(page, value || "—", { x, top: top - 13, width, font, size: 8.5, color: colors.text, lineGap: 1 });
}

function drawList(page: PDFPage, items: string[], x: number, top: number, width: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  let y = top;
  for (const item of items) {
    const lines = wrapText(`• ${item}`, font, 7.2, width);
    for (const line of lines) {
      page.drawText(line, { x, y: y - 7.2, size: 7.2, font, color });
      y -= 9;
    }
  }
  return y;
}

function drawPhotoCards(page: PDFPage, photos: { label: string; image: any | null }[], x: number, y: number, width: number, height: number, font: PDFFont, bold: PDFFont, colors: { border: ReturnType<typeof rgb>; muted: ReturnType<typeof rgb>; text: ReturnType<typeof rgb> }) {
  const gap = 8;
  const cardWidth = (width - gap * (photos.length - 1)) / photos.length;
  photos.forEach((photo, index) => {
    const cardX = x + index * (cardWidth + gap);
    drawCard(page, cardX, y, cardWidth, height, rgb(0.98, 0.99, 1), colors.border);
    page.drawText(safe(photo.label), { x: cardX + 8, y: y + height - 16, size: 7.5, font: bold, color: colors.text });
    const imageX = cardX + 8;
    const imageY = y + 8;
    const imageWidth = cardWidth - 16;
    const imageHeight = height - 31;
    if (!photo.image) {
      page.drawText("Sem foto registrada", { x: cardX + 12, y: y + height / 2 - 3, size: 7, font, color: colors.muted });
      return;
    }
    const scale = Math.min(imageWidth / photo.image.width, imageHeight / photo.image.height);
    const renderedWidth = photo.image.width * scale;
    const renderedHeight = photo.image.height * scale;
    page.drawImage(photo.image, {
      x: imageX + (imageWidth - renderedWidth) / 2,
      y: imageY + (imageHeight - renderedHeight) / 2,
      width: renderedWidth,
      height: renderedHeight,
    });
  });
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

export async function buildVisitReportPdf(visit: VisitReportVisit, report: ReportRecord, photoUrls: Partial<Record<PhotoKey, string>>) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 842;
  const H = 595;
  const M = 32;
  const colors = {
    navy: rgb(0.04, 0.18, 0.3),
    blue: rgb(0.05, 0.38, 0.62),
    teal: rgb(0.05, 0.55, 0.55),
    ink: rgb(0.08, 0.12, 0.18),
    muted: rgb(0.38, 0.43, 0.5),
    light: rgb(0.96, 0.98, 1),
    border: rgb(0.82, 0.87, 0.92),
  };
  const page = pdf.addPage([W, H]);
  const finished = visit.status === "concluida";

  page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: colors.navy });
  page.drawText("PISCIVEL", { x: M, y: H - 27, size: 18, font: bold, color: rgb(1, 1, 1), characterSpacing: 1.2 });
  page.drawText("RELATÓRIO COMPLETO DA VISITA", { x: M, y: H - 47, size: 8, font, color: rgb(0.78, 0.9, 0.96), characterSpacing: 0.8 });
  page.drawText(finished ? "VISITA CONCLUÍDA" : "VISITA NÃO CONCLUÍDA", { x: W - M - 130, y: H - 27, size: 7.5, font: bold, color: finished ? rgb(0.55, 1, 0.75) : rgb(1, 0.68, 0.68), characterSpacing: 0.35 });
  page.drawText(`ID ${safe(visit.id.slice(0, 8)).toUpperCase()}`, { x: W - M - 130, y: H - 47, size: 7, font, color: rgb(0.78, 0.9, 0.96) });

  const metaY = 459;
  const metaH = 52;
  drawCard(page, M, metaY, W - M * 2, metaH, colors.light, colors.border);
  const col = (W - M * 2 - 40) / 3;
  drawField(page, "Cliente", visit.pool?.client?.name ?? "Não informado", M + 14, metaY + metaH - 10, col, font, bold, { label: colors.muted, text: colors.ink });
  drawField(page, "Piscina", visit.pool?.name ?? "Piscina sem nome", M + 14 + col + 20, metaY + metaH - 10, col, font, bold, { label: colors.muted, text: colors.ink });
  drawField(page, "Telefone", visit.pool?.client?.phone ?? "Não informado", M + 14 + (col + 20) * 2, metaY + metaH - 10, col, font, bold, { label: colors.muted, text: colors.ink });

  const bodyY = 222;
  const bodyH = 222;
  const leftW = 382;
  const rightX = M + leftW + 12;
  const rightW = W - M - rightX;
  drawCard(page, M, bodyY, leftW, bodyH, rgb(1, 1, 1), colors.border);
  drawCard(page, rightX, bodyY, rightW, bodyH, rgb(1, 1, 1), colors.border);

  drawSectionTitle(page, "Informações da visita", M + 14, bodyY + bodyH - 20, bold, colors.blue);
  const fieldWidth = (leftW - 42) / 2;
  drawField(page, "Técnico", visit.technician?.full_name ?? "Não informado", M + 14, bodyY + bodyH - 38, fieldWidth, font, bold, { label: colors.muted, text: colors.ink });
  drawField(page, "Status", finished ? "Concluída" : "Não concluída", M + 28 + fieldWidth, bodyY + bodyH - 38, fieldWidth, font, bold, { label: colors.muted, text: colors.ink });
  drawField(page, "Agendada para", dateTime(visit.scheduled_at), M + 14, bodyY + bodyH - 82, fieldWidth, font, bold, { label: colors.muted, text: colors.ink });
  drawField(page, "Realizada em", dateTime(visit.visited_at), M + 28 + fieldWidth, bodyY + bodyH - 82, fieldWidth, font, bold, { label: colors.muted, text: colors.ink });
  drawField(page, "Endereço", visit.pool?.address ?? "Não informado", M + 14, bodyY + bodyH - 126, leftW - 28, font, bold, { label: colors.muted, text: colors.ink });
  drawField(page, "Relatório criado em", dateTime(report.created_at), M + 14, bodyY + bodyH - 170, leftW - 28, font, bold, { label: colors.muted, text: colors.ink });

  drawSectionTitle(page, "Parâmetros da água", rightX + 14, bodyY + bodyH - 20, bold, colors.blue);
  const parameters = [
    ["pH", report.ph],
    ["Cloro livre", report.free_chlorine],
    ["Alcalinidade", report.alkalinity],
    ["Ácido cianúrico", report.cyanuric_acid],
    ["Dureza cálcica", report.calcium_hardness],
    ["Temperatura", report.temperature],
  ] as const;
  const parameterWidth = (rightW - 42) / 3;
  parameters.forEach(([label, value], index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const x = rightX + 14 + column * (parameterWidth + 7);
    const top = bodyY + bodyH - 44 - row * 40;
    page.drawText(safe(label), { x, y: top, size: 7.2, font, color: colors.muted });
    page.drawText(safe(value == null ? "—" : String(value)), { x, y: top - 15, size: 10, font: bold, color: colors.ink });
  });
  page.drawLine({ start: { x: rightX + 14, y: bodyY + 124 }, end: { x: rightX + rightW - 14, y: bodyY + 124 }, thickness: 0.7, color: colors.border });

  const products = report.chemicals && typeof report.chemicals === "object" && !Array.isArray(report.chemicals)
    ? Object.entries(report.chemicals as Record<string, unknown>).filter(([, quantity]) => quantity !== null && quantity !== "").map(([name, quantity]) => `${name}: ${String(quantity)}`)
    : [];
  const tasks = Array.isArray(report.tasks) ? report.tasks.filter((task): task is string => typeof task === "string") : [];
  const half = (rightW - 36) / 2;
  page.drawText("PRODUTOS", { x: rightX + 14, y: bodyY + 108, size: 6.5, font: bold, color: colors.muted, characterSpacing: 0.35 });
  drawList(page, products.length ? products : ["Nenhum produto registrado"], rightX + 14, bodyY + 98, half, font, colors.ink);
  page.drawText("SERVIÇOS", { x: rightX + 22 + half, y: bodyY + 108, size: 6.5, font: bold, color: colors.muted, characterSpacing: 0.35 });
  drawList(page, tasks.length ? tasks : ["Nenhum serviço registrado"], rightX + 22 + half, bodyY + 98, half, font, colors.ink);
  page.drawLine({ start: { x: rightX + 14, y: bodyY + 61 }, end: { x: rightX + rightW - 14, y: bodyY + 61 }, thickness: 0.7, color: colors.border });
  page.drawText("OBSERVAÇÕES", { x: rightX + 14, y: bodyY + 46, size: 6.5, font: bold, color: colors.muted, characterSpacing: 0.35 });
  drawWrapped(page, report.notes?.trim() || "Nenhuma observação registrada.", { x: rightX + 14, top: bodyY + 33, width: rightW - 28, font, size: 7.4, color: colors.ink, lineGap: 2 });

  const photoFields: [string, PhotoKey, string | null][] = [
    ["Antes", "photo_before", report.photo_before],
    ["Depois", "photo_after", report.photo_after],
    ["Casa de máquinas", "photo_machine", report.photo_machine],
    ["Observação", "photo_note", report.photo_note],
  ];
  const photos: { label: string; image: any | null }[] = [];
  for (const [label, key, path] of photoFields) {
    let image: any | null = null;
    const url = path ? photoUrls[key] : undefined;
    if (url) {
      try {
        image = await pdf.embedJpg(await toJpeg(url));
      } catch {
        image = null;
      }
    }
    photos.push({ label, image });
  }
  drawPhotoCards(page, photos, M, 32, W - M * 2, 174, font, bold, { border: colors.border, muted: colors.muted, text: colors.ink });
  page.drawText("Documento gerado pelo sistema Piscivel", { x: M, y: 16, size: 6.5, font, color: colors.muted });
  page.drawText("Relatório completo da piscina", { x: W - M - 115, y: 16, size: 6.5, font, color: colors.muted });

  const bytes = await pdf.save();
  const client = safe(visit.pool?.client?.name ?? "cliente").replace(/\s+/g, "-").toLowerCase();
  const pool = safe(visit.pool?.name ?? "piscina").replace(/\s+/g, "-").toLowerCase();
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    filename: `relatorio-${client}-${pool}-${visit.id.slice(0, 8)}.pdf`,
  };
}
