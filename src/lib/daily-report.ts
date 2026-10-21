import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { params, inRange, type ParamKey } from "@/lib/mock";
import { filterReportVisits } from "@/lib/daily-report-filter";

const safe = (value: string) => value.replace(/[^\x20-\x7E\u00A0-\u00FF–—•]/g, "");
const clean = (value: string) => safe(value).replace(/\s+/g, " ").trim();

async function toJpeg(url: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a foto.");
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
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

export async function loadDailyReportVisits(techId: string, day: string) {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const from = new Date(year, month - 1, date);
  const to = new Date(year, month - 1, date + 1);
  const { data, error } = await supabase
    .from("schedules")
    .select("id, scheduled_at, visited_at, status, skip_note, pool:swimming_pools(name, address, client:clients(id, name, address)), report:visit_reports(*)")
    .eq("technician_id", techId)
    .gte("scheduled_at", from.toISOString())
    .lt("scheduled_at", to.toISOString())
    .order("visited_at");
  if (error) throw error;
  return (data ?? []).map((visit) => ({ ...visit, report: Array.isArray(visit.report) ? visit.report[0] : visit.report }));
}

export async function buildDailyReport(techId: string, techName: string, day: string, client?: { id: string; name: string }) {
  const visits = filterReportVisits(await loadDailyReportVisits(techId, day), client?.id);
  if (!visits.length) return null;

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
    danger: rgb(0.72, 0.12, 0.12),
    success: rgb(0.08, 0.48, 0.3),
  };
  const dateStr = new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR");

  for (const [index, visit] of visits.entries()) {
    const page = pdf.addPage([W, H]);
    const pool = visit.pool;
    const report = visit.report;
    const finished = visit.status === "concluida" && Boolean(report);
    const statusText = finished ? "VISITA CONCLUÍDA" : "VISITA NÃO REALIZADA";
    const statusColor = finished ? colors.success : colors.danger;

    page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: colors.navy });
    page.drawText("PISCIVEL", { x: M, y: H - 27, size: 18, font: bold, color: rgb(1, 1, 1), characterSpacing: 1.2 });
    page.drawText("RELATÓRIO DIÁRIO DE MANUTENÇÃO", { x: M, y: H - 47, size: 8, font, color: rgb(0.78, 0.9, 0.96), characterSpacing: 0.8 });
    page.drawText(`${index + 1} de ${visits.length}`, { x: W - M - 45, y: H - 27, size: 8, font: bold, color: rgb(0.78, 0.9, 0.96) });
    page.drawText(safe(statusText), { x: W - M - 155, y: H - 47, size: 7, font: bold, color: finished ? rgb(0.55, 1, 0.75) : rgb(1, 0.68, 0.68), characterSpacing: 0.35 });

    const metaY = 459;
    const metaH = 52;
    drawCard(page, M, metaY, W - M * 2, metaH, colors.light, colors.border);
    const col = (W - M * 2 - 40) / 3;
    drawField(page, "Cliente", pool?.client?.name ?? "Não informado", M + 14, metaY + metaH - 10, col, font, bold, { label: colors.muted, text: colors.ink });
    drawField(page, "Piscina", pool?.name ?? "Piscina sem nome", M + 14 + col + 20, metaY + metaH - 10, col, font, bold, { label: colors.muted, text: colors.ink });
    drawField(page, "Técnico / data", `${techName} · ${dateStr}`, M + 14 + (col + 20) * 2, metaY + metaH - 10, col, font, bold, { label: colors.muted, text: colors.ink });

    const bodyY = 222;
    const bodyH = 222;
    const leftW = 382;
    const rightX = M + leftW + 12;
    const rightW = W - M - rightX;
    drawCard(page, M, bodyY, leftW, bodyH, rgb(1, 1, 1), colors.border);
    drawCard(page, rightX, bodyY, rightW, bodyH, rgb(1, 1, 1), colors.border);
    drawSectionTitle(page, "Parâmetros da água", M + 14, bodyY + bodyH - 20, bold, colors.blue);

    if (finished && report) {
      const parameterWidth = (leftW - 42) / 3;
      params.forEach((parameter, parameterIndex) => {
        const row = Math.floor(parameterIndex / 3);
        const column = parameterIndex % 3;
        const x = M + 14 + column * (parameterWidth + 7);
        const top = bodyY + bodyH - 44 - row * 47;
        const value = report[parameter.key as ParamKey] as number | null;
        const range = inRange(parameter.key, value);
        const rangeText = range === null ? "" : range ? "Equilibrado" : "Fora do padrão";
        const rangeColor = range === null ? colors.muted : range ? colors.success : colors.danger;
        page.drawText(safe(parameter.label), { x, y: top, size: 7.2, font, color: colors.muted });
        page.drawText(safe(value == null ? "—" : `${value} ${parameter.unit}`), { x, y: top - 15, size: 10, font: bold, color: colors.ink });
        if (rangeText) page.drawText(safe(rangeText), { x, y: top - 27, size: 6.4, font: bold, color: rangeColor });
      });
    } else {
      page.drawText("Não há relatório preenchido para esta visita.", { x: M + 14, y: bodyY + bodyH - 52, size: 9, font: bold, color: statusColor });
      if (visit.skip_note) drawWrapped(page, `Motivo: ${visit.skip_note}`, { x: M + 14, top: bodyY + bodyH - 74, width: leftW - 28, font, size: 8.5, color: colors.muted, lineGap: 2 });
    }

    drawSectionTitle(page, finished ? "Produtos, serviços e observações" : "Informações da visita", rightX + 14, bodyY + bodyH - 20, bold, colors.blue);
    if (finished && report) {
      const products = Object.entries((report.chemicals ?? {}) as Record<string, unknown>).filter(([, quantity]) => quantity !== null && quantity !== "").map(([name, quantity]) => `${name}: ${String(quantity)}`);
      const tasks = Array.isArray(report.tasks) ? (report.tasks as unknown[]).filter((task): task is string => typeof task === "string") : [];
      const half = (rightW - 36) / 2;
      page.drawText("PRODUTOS", { x: rightX + 14, y: bodyY + bodyH - 42, size: 6.5, font: bold, color: colors.muted, characterSpacing: 0.35 });
      drawList(page, products.length ? products : ["Nenhum produto registrado"], rightX + 14, bodyY + bodyH - 52, half, font, colors.ink);
      page.drawText("SERVIÇOS", { x: rightX + 22 + half, y: bodyY + bodyH - 42, size: 6.5, font: bold, color: colors.muted, characterSpacing: 0.35 });
      drawList(page, tasks.length ? tasks : ["Nenhum serviço registrado"], rightX + 22 + half, bodyY + bodyH - 52, half, font, colors.ink);
      page.drawLine({ start: { x: rightX + 14, y: bodyY + 74 }, end: { x: rightX + rightW - 14, y: bodyY + 74 }, thickness: 0.7, color: colors.border });
      page.drawText("OBSERVAÇÕES", { x: rightX + 14, y: bodyY + 58, size: 6.5, font: bold, color: colors.muted, characterSpacing: 0.35 });
      drawWrapped(page, report.notes?.trim() || "Nenhuma observação registrada.", { x: rightX + 14, top: bodyY + 45, width: rightW - 28, font, size: 7.4, color: colors.ink, lineGap: 2 });
    } else {
      drawField(page, "Horário agendado", new Date(visit.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), rightX + 14, bodyY + bodyH - 43, rightW - 28, font, bold, { label: colors.muted, text: colors.ink });
      drawField(page, "Endereço", pool?.address || pool?.client?.address || "Não informado", rightX + 14, bodyY + bodyH - 82, rightW - 28, font, bold, { label: colors.muted, text: colors.ink });
      if (visit.skip_note) drawField(page, "Observação", visit.skip_note, rightX + 14, bodyY + bodyH - 125, rightW - 28, font, bold, { label: colors.muted, text: colors.ink });
    }

    const photoLabels = [
      ["Antes", report?.photo_before],
      ["Depois", report?.photo_after],
      ["Casa de máquinas", report?.photo_machine],
      ["Observação", report?.photo_note],
    ] as const;
    const photoImages: { label: string; image: any | null }[] = [];
    for (const [label, path] of photoLabels) {
      let image: any | null = null;
      if (path) {
        try {
          const { data: signed } = await supabase.storage.from("visit-photos").createSignedUrl(path, 300);
          if (signed?.signedUrl) image = await pdf.embedJpg(await toJpeg(signed.signedUrl));
        } catch {
          image = null;
        }
      }
      photoImages.push({ label, image });
    }
    drawPhotoCards(page, photoImages, M, 32, W - M * 2, 174, font, bold, { border: colors.border, muted: colors.muted, text: colors.ink });
    page.drawText("Documento gerado pelo sistema Piscivel", { x: M, y: 16, size: 6.5, font, color: colors.muted });
    page.drawText(`Visita agendada para ${dateStr}`, { x: W - M - 115, y: 16, size: 6.5, font, color: colors.muted });
  }

  const bytes = await pdf.save();
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    filename: `relatorio-${safe(techName).replace(/\s+/g, "-").toLowerCase()}${client ? `-${safe(client.name).replace(/\s+/g, "-").toLowerCase()}` : ""}-${day}.pdf`,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
