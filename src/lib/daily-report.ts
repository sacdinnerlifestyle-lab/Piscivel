import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { params, inRange, type ParamKey } from "@/lib/mock";
import { filterReportVisits } from "@/lib/daily-report-filter";

// Standard PDF fonts only support WinAnsi characters.
const safe = (s: string) => s.replace(/[^\x20-\x7E\u00A0-\u00FF–—•]/g, "");

async function toJpeg(url: string) {
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = url; await img.decode();
  const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
  const context = c.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a foto.");
  context.drawImage(img, 0, 0, c.width, c.height);
  const b = await new Promise<Blob>((resolve, reject) => c.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível converter a foto.")), "image/jpeg", 0.8));
  return new Uint8Array(await b.arrayBuffer());
}

export async function loadDailyReportVisits(techId: string, day: string) {
  const [y = 0, m = 1, d = 1] = day.split("-").map(Number);
  const from = new Date(y, m - 1, d), to = new Date(y, m - 1, d + 1);
  const { data, error } = await supabase.from("schedules")
    .select("id, scheduled_at, visited_at, status, skip_note, pool:swimming_pools(name, address, client:clients(id, name, address)), report:visit_reports(*)")
    .eq("technician_id", techId).gte("scheduled_at", from.toISOString()).lt("scheduled_at", to.toISOString()).order("visited_at");
  if (error) throw error;
  return (data ?? []).map((v) => ({ ...v, report: Array.isArray(v.report) ? v.report[0] : v.report }));
}

export async function buildDailyReport(techId: string, techName: string, day: string, client?: { id: string; name: string }) {
  const visits = filterReportVisits(await loadDailyReportVisits(techId, day), client?.id);
  const doneCount = visits.filter((v) => v.status === "concluida").length;
  if (!visits.length) return null;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 45;
  const blue = rgb(0.05, 0.35, 0.55), gray = rgb(0.4, 0.4, 0.45);
  let page: PDFPage = pdf.addPage([W, H]); let yy = H - M;
  const ensure = (h: number) => { if (yy - h < M) { page = pdf.addPage([W, H]); yy = H - M; } };
  const text = (t: string, o: { f?: PDFFont; s?: number; c?: ReturnType<typeof rgb>; x?: number } = {}) => {
    const f = o.f ?? font, s = o.s ?? 10, x = o.x ?? M;
    const words = safe(t).split(" "); let line = "";
    const lines: string[] = [];
    for (const w of words) { const n = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(n, s) > W - M - x) { lines.push(line); line = w; } else line = n; }
    lines.push(line);
    for (const l of lines) { ensure(s + 4); page.drawText(l, { x, y: yy - s, size: s, font: f, color: o.c ?? rgb(0.1, 0.1, 0.15) }); yy -= s + 4; }
  };
  const dateStr = new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR");
  text("Piscivel – Relatório diário", { f: bold, s: 20, c: blue });
  text(`Técnico: ${techName}`, { s: 12 }); text(`Data: ${dateStr}`, { s: 12 });
  text(`Cliente: ${client?.name ?? "Todos os clientes"}`, { s: 12 });
  text(`Visitas: ${doneCount} concluídas de ${visits.length} agendadas`, { s: 12 }); yy -= 10;

  for (const [i, v] of visits.entries()) {
    ensure(60);
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 1, color: blue }); yy -= 8;
    const pool = v.pool;
    text(`${i + 1}. ${pool?.client?.name ?? "Cliente"}${pool?.name ? ` · ${pool.name}` : ""}`, { f: bold, s: 13 });
    const addr = pool?.address || pool?.client?.address; if (addr) text(`Endereço: ${addr}`, { c: gray });
    const r = v.report;
    if (v.status !== "concluida" || !r) {
      text(`Não realizada${v.skip_note ? ` – ${v.skip_note}` : ""}`, { f: bold, c: rgb(0.7, 0.1, 0.1) }); yy -= 8; continue;
    }
    text(`Horário da visita: ${v.visited_at ? new Date(v.visited_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}`);
    yy -= 4; text("Parâmetros da água", { f: bold, c: blue });
    for (const p of params) {
      const val = r[p.key as ParamKey] as number | null; const s = inRange(p.key, val);
      text(`• ${p.label}: ${val ?? "—"} ${p.unit}${s === null ? "" : s ? "  (Equilibrado)" : "  (Fora do padrão)"}`, { x: M + 10 });
    }
    const chem = Object.entries((r.chemicals ?? {}) as Record<string, string>);
    if (chem.length) { yy -= 4; text("Produtos aplicados", { f: bold, c: blue }); chem.forEach(([c, q]) => text(`• ${c}: ${q}`, { x: M + 10 })); }
    const tk = (r.tasks ?? []) as string[];
    if (tk.length) { yy -= 4; text("Serviços realizados", { f: bold, c: blue }); tk.forEach((t) => text(`• ${t}`, { x: M + 10 })); }
    if (r.notes) { yy -= 4; text("Observações", { f: bold, c: blue }); text(r.notes, { x: M + 10 }); }
    const photos = ([["Antes", r.photo_before], ["Depois", r.photo_after], ["Casa de Máquinas", r.photo_machine], ["Observação", r.photo_note]] as const).filter(([, p]) => p) as [string, string][];
    for (const [label, path] of photos) {
      try {
        const { data: s } = await supabase.storage.from("visit-photos").createSignedUrl(path, 300);
        if (!s) continue;
        const jpg = await pdf.embedJpg(await toJpeg(s.signedUrl));
        const maxW = 240, maxH = 240, k = Math.min(maxW / jpg.width, maxH / jpg.height);
        ensure(jpg.height * k + 24);
        text(`Foto – ${label}`, { f: bold, s: 9, c: gray });
        page.drawImage(jpg, { x: M, y: yy - jpg.height * k, width: jpg.width * k, height: jpg.height * k });
        yy -= jpg.height * k + 10;
      } catch { text(`Foto – ${label}: não foi possível carregar`, { c: gray, s: 9 }); }
    }
    yy -= 10;
  }
  const bytes = await pdf.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), filename: `relatorio-${safe(techName).replace(/\s+/g, "-").toLowerCase()}${client ? `-${safe(client.name).replace(/\s+/g, "-").toLowerCase()}` : ""}-${day}.pdf` };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
