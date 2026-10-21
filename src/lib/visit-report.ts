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

async function toJpeg(url: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a foto.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível converter a foto.")), "image/jpeg", 0.8));
  return new Uint8Array(await blob.arrayBuffer());
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

export async function buildVisitReportPdf(visit: VisitReportVisit, report: ReportRecord, photoUrls: Partial<Record<PhotoKey, string>>) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595;
  const H = 842;
  const M = 45;
  const blue = rgb(0.05, 0.35, 0.55);
  const gray = rgb(0.4, 0.4, 0.45);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const ensure = (height: number) => {
    if (y - height < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };

  const write = (value: string, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
    const currentFont = options.font ?? font;
    const size = options.size ?? 10;
    const x = options.x ?? M;
    const words = safe(value).split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (currentFont.widthOfTextAtSize(next, size) > W - M - x && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    for (const text of lines) {
      ensure(size + 4);
      page.drawText(text, { x, y: y - size, size, font: currentFont, color: options.color ?? rgb(0.1, 0.1, 0.15) });
      y -= size + 4;
    }
  };

  write("Piscivel – Relatório da visita", { font: bold, size: 20, color: blue });
  write(`Cliente: ${visit.pool?.client?.name ?? "Não informado"}`, { size: 12 });
  write(`Piscina: ${visit.pool?.name ?? "Não informada"}`, { size: 12 });
  if (visit.pool?.address) write(`Endereço: ${visit.pool.address}`, { size: 11, color: gray });
  write(`Técnico: ${visit.technician?.full_name ?? "Não informado"}`, { size: 12 });
  write(`Agendada para: ${dateTime(visit.scheduled_at)}`, { size: 11 });
  write(`Realizada em: ${dateTime(visit.visited_at)}`, { size: 11 });
  write(`Relatório criado em: ${dateTime(report.created_at)}`, { size: 11 });
  y -= 10;

  const parameters = [
    ["pH", report.ph],
    ["Cloro livre", report.free_chlorine],
    ["Alcalinidade", report.alkalinity],
    ["Ácido cianúrico", report.cyanuric_acid],
    ["Dureza cálcica", report.calcium_hardness],
    ["Temperatura", report.temperature],
  ] as const;
  write("Parâmetros da água", { font: bold, size: 13, color: blue });
  for (const [label, value] of parameters) write(`• ${label}: ${value ?? "—"}`, { x: M + 10 });

  const chemicals = report.chemicals && typeof report.chemicals === "object" && !Array.isArray(report.chemicals)
    ? Object.entries(report.chemicals as Record<string, unknown>).filter(([, value]) => value !== null && value !== "")
    : [];
  if (chemicals.length) {
    y -= 5;
    write("Produtos aplicados", { font: bold, size: 13, color: blue });
    for (const [name, quantity] of chemicals) write(`• ${name}: ${String(quantity)}`, { x: M + 10 });
  }

  const tasks = Array.isArray(report.tasks) ? report.tasks.filter((task): task is string => typeof task === "string") : [];
  if (tasks.length) {
    y -= 5;
    write("Serviços realizados", { font: bold, size: 13, color: blue });
    for (const task of tasks) write(`• ${task}`, { x: M + 10 });
  }

  y -= 5;
  write("Observações", { font: bold, size: 13, color: blue });
  write(report.notes?.trim() || "Nenhuma observação registrada.", { x: M + 10 });

  const photos: [string, string | null, PhotoKey][] = [
    ["Antes", report.photo_before, "photo_before"],
    ["Depois", report.photo_after, "photo_after"],
    ["Casa de máquinas", report.photo_machine, "photo_machine"],
    ["Observação", report.photo_note, "photo_note"],
  ];
  for (const [label, path, key] of photos) {
    const url = path ? photoUrls[key] : undefined;
    if (!url) continue;
    try {
      const image = await pdf.embedJpg(await toJpeg(url));
      const maxWidth = 240;
      const maxHeight = 240;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      ensure(image.height * scale + 30);
      write(`Foto – ${label}`, { font: bold, size: 10, color: gray });
      page.drawImage(image, { x: M, y: y - image.height * scale, width: image.width * scale, height: image.height * scale });
      y -= image.height * scale + 12;
    } catch {
      write(`Foto – ${label}: não foi possível carregar`, { size: 9, color: gray });
    }
  }

  const bytes = await pdf.save();
  const client = safe(visit.pool?.client?.name ?? "cliente").replace(/\s+/g, "-").toLowerCase();
  const pool = safe(visit.pool?.name ?? "piscina").replace(/\s+/g, "-").toLowerCase();
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    filename: `relatorio-${client}-${pool}-${visit.id.slice(0, 8)}.pdf`,
  };
}
