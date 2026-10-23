import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell, Empty, StatusBadge, fmtDate, fmtTime } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { signedUrl } from "@/lib/session";
import { visitNoteLabel } from "@/lib/rain";
import { ArrowLeft, MessageCircle, X, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tecnico/$id")({
  head: () => ({ meta: [{ title: "Visitas do técnico — Piscivel" }, { name: "description", content: "Todas as visitas de um técnico e envio de relatórios." }, { property: "og:title", content: "Visitas do técnico — Piscivel" }, { property: "og:description", content: "Todas as visitas de um técnico e envio de relatórios." }] }),
  component: TecnicoVisitas,
});

type Rep = { id?: string; ph: number | null; free_chlorine: number | null; alkalinity: number | null; cyanuric_acid: number | null; calcium_hardness: number | null; temperature: number | null; chemicals: unknown; tasks: string[]; notes: string | null; photo_before: string | null; photo_after: string | null; photo_machine: string | null; photo_note: string | null };
type Preview = { text: string; url: string; before: string | null; after: string | null; machine: string | null; note: string | null; title: string };

function TecnicoVisitas() {
  const { id } = Route.useParams();
  const [filter, setFilter] = useState<"todas" | "concluida" | "pendentes">("todas");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ sid: string; rid: string; f: Record<string, string> } | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const NUMS = [["ph", "pH"], ["free_chlorine", "Cloro livre (ppm)"], ["alkalinity", "Alcalinidade (ppm)"], ["cyanuric_acid", "Ác. cianúrico (ppm)"], ["calcium_hardness", "Dureza cálcica (ppm)"], ["temperature", "Temperatura (°C)"]] as const;
  function startEdit(v: (typeof list)[number]) {
    const r = (Array.isArray(v.report) ? v.report[0] : v.report) as Rep | null;
    if (!r?.id) return;
    const f: Record<string, string> = { notes: r.notes ?? "", time: v.visited_at ? new Date(v.visited_at).toTimeString().slice(0, 5) : "" };
    for (const [k] of NUMS) f[k] = r[k] == null ? "" : String(r[k]);
    setEdit({ sid: v.id, rid: r.id, f });
  }
  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    const upd: Record<string, number | string | null> = { notes: (edit.f["notes"] ?? "").trim() || null };
    for (const [k] of NUMS) { const n = parseFloat((edit.f[k] ?? "").replace(",", ".")); upd[k] = Number.isFinite(n) ? n : null; }
    const { error } = await supabase.from("visit_reports").update(upd as never).eq("id", edit.rid);
    const v = list.find((x) => x.id === edit.sid);
    if (!error && edit.f["time"] && v) {
      const d = new Date(v.visited_at ?? v.scheduled_at); const [h, m] = edit.f["time"].split(":").map(Number); d.setHours(h ?? 0, m ?? 0, 0, 0);
      await supabase.from("schedules").update({ visited_at: d.toISOString() }).eq("id", edit.sid);
    }
    setSaving(false);
    if (error) return alert("Erro ao salvar: " + error.message);
    setEdit(null); qc.invalidateQueries();
  }
  async function remove(v: (typeof list)[number]) {
    const r = (Array.isArray(v.report) ? v.report[0] : v.report) as Rep | null;
    if (!r?.id || !confirm("Remover o relatório desta visita? A visita volta para 'agendada'.")) return;
    const { error } = await supabase.from("visit_reports").delete().eq("id", r.id);
    if (error) return alert("Erro ao remover: " + error.message);
    await supabase.from("schedules").update({ status: "agendada", visited_at: null }).eq("id", v.id);
    qc.invalidateQueries();
  }
  const { data: prof } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => (await supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle()).data,
  });
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["tech-visits", id],
    queryFn: async () => (await supabase.from("schedules").select("id, scheduled_at, visited_at, status, skip_note, pool:swimming_pools(name, client:clients(name, phone)), report:visit_reports(id, ph, free_chlorine, alkalinity, cyanuric_acid, calcium_hardness, temperature, chemicals, tasks, notes, photo_before, photo_after, photo_machine, photo_note)").eq("technician_id", id).order("scheduled_at", { ascending: false }).limit(500)).data ?? [],
  });

  const shown = list.filter((v) => filter === "todas" || (filter === "concluida" ? v.status === "concluida" : v.status !== "concluida"));

  async function open(v: (typeof list)[number]) {
    const r = (Array.isArray(v.report) ? v.report[0] : v.report) as Rep | null;
    if (!r) return;
    setLoadingId(v.id);
    const chem = Object.entries((r.chemicals ?? {}) as Record<string, unknown>).map(([k, q]) => `• ${k}: ${q}`).join("\n");
    const text = [
      `*Relatório da visita — Piscivel*`,
      `Cliente: ${v.pool?.client?.name ?? ""}${v.pool?.name ? ` (${v.pool.name})` : ""}`,
      `Data: ${fmtDate(v.visited_at ?? v.scheduled_at)}${v.visited_at ? ` às ${fmtTime(v.visited_at)}` : ""}`,
      `Técnico: ${prof?.full_name ?? ""}`,
      ``,
      `*Análise da água*`,
      `pH: ${r.ph ?? "—"} | Cloro livre: ${r.free_chlorine ?? "—"} ppm`,
      `Alcalinidade: ${r.alkalinity ?? "—"} ppm | Ác. cianúrico: ${r.cyanuric_acid ?? "—"} ppm`,
      `Dureza cálcica: ${r.calcium_hardness ?? "—"} ppm`,
      `Temperatura: ${r.temperature ?? "—"} °C`,
      chem && `\n*Produtos aplicados*\n${chem}`,
      r.tasks?.length ? `\n*Serviços realizados*\n${r.tasks.map((t) => `✓ ${t}`).join("\n")}` : "",
      r.notes ? `\nObservações: ${r.notes}` : "",
    ].filter(Boolean).join("\n");
    const phone = (v.pool?.client?.phone ?? "").replace(/\D/g, "").replace(/^55/, "");
    const [before, after, machine, note] = await Promise.all([signedUrl(r.photo_before), signedUrl(r.photo_after), signedUrl(r.photo_machine), signedUrl(r.photo_note)]);
    setLoadingId(null);
    setPreview({ text, before, after, machine, note, title: v.pool?.client?.name ?? "Relatório", url: `https://wa.me/55${phone}?text=${encodeURIComponent(text)}` });
  }

  return (
    <AdminShell title={prof?.full_name || "Técnico"}>
      <Link to="/admin/equipe" className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><ArrowLeft className="size-4" />Voltar para equipe</Link>
      <div className="flex gap-2 mb-4">
        {(["todas", "concluida", "pendentes"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-sm px-3 py-1.5 rounded-full ${filter === f ? "btn-primary" : "bg-secondary"}`}>{f === "todas" ? `Todas (${list.length})` : f === "concluida" ? "Concluídas" : "Pendentes"}</button>
        ))}
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : shown.length === 0 ? <Empty>Nenhuma visita encontrada.</Empty> : (
        <div className="glass divide-y">
          {shown.map((v) => {
            const hasReport = Array.isArray(v.report) ? v.report.length > 0 : !!v.report;
            return (
              <div key={v.id} className={`p-4 flex flex-wrap items-center gap-3 ${v.status === "concluida" ? "bg-success/10" : ""}`}>
                <div className="flex-1 min-w-48">
                  <div className="font-medium">{v.pool?.client?.name}{v.pool?.name && <span className="text-muted-foreground font-normal"> · {v.pool.name}</span>}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(v.scheduled_at)}{v.visited_at && ` · visitado às ${fmtTime(v.visited_at)}`}</div>
                  {v.skip_note && <div className="text-xs text-petrol mt-1">{visitNoteLabel(v.skip_note)}</div>}
                </div>
                <StatusBadge s={v.status} />
                {hasReport && <button disabled={loadingId === v.id} onClick={() => open(v)} className="btn-primary text-sm px-3 py-2 flex items-center gap-2"><MessageCircle className="size-4" />{loadingId === v.id ? "Abrindo…" : "Enviar relatório"}</button>}
                {hasReport && <button onClick={() => startEdit(v)} className="bg-secondary text-sm px-3 py-2 rounded-lg flex items-center gap-2"><Pencil className="size-4" />Editar</button>}
                {hasReport && <button onClick={() => remove(v)} className="bg-destructive text-destructive-foreground text-sm px-3 py-2 rounded-lg flex items-center gap-2"><Trash2 className="size-4" />Remover</button>}
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-card text-card-foreground rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">Conferir relatório — {preview.title}</h2>
              <button onClick={() => setPreview(null)} aria-label="Fechar"><X className="size-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["before", "after", "machine"] as const).map((k) => (
                <div key={k}>
                  <div className="text-xs text-muted-foreground mb-1">{k === "before" ? "Antes" : k === "after" ? "Depois" : "Casa de Máquinas"}</div>
                  {preview[k] ? <img src={preview[k]!} alt={k === "before" ? "Antes" : k === "after" ? "Depois" : "Casa de Máquinas"} className="rounded-lg w-full aspect-square object-cover" /> : <div className="rounded-lg aspect-square bg-secondary flex items-center justify-center text-xs text-muted-foreground">Sem foto</div>}
                </div>
              ))}
            </div>
            {preview.note && <div><div className="text-xs text-muted-foreground mb-1">Foto da observação</div><img src={preview.note} alt="Foto da observação" className="rounded-lg max-h-64 object-cover" /></div>}
            <pre className="whitespace-pre-wrap text-sm bg-secondary rounded-lg p-4 font-sans">{preview.text.replace(/\*/g, "")}</pre>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPreview(null)} className="px-4 py-2.5 text-sm text-muted-foreground">Cancelar</button>
              <button onClick={() => { window.open(preview.url, "_blank"); setPreview(null); }} className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2"><MessageCircle className="size-4" />Confirmar e enviar no WhatsApp</button>
            </div>
          </div>
        </div>
      )}
      {edit && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-card text-card-foreground rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center"><h2 className="font-semibold text-lg">Editar visita</h2><button onClick={() => setEdit(null)} aria-label="Fechar"><X className="size-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              {NUMS.map(([k, l]) => (
                <label key={k} className="text-sm"><span className="text-xs text-muted-foreground">{l}</span>
                  <input inputMode="decimal" value={edit.f[k]} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, [k]: e.target.value } })} className="w-full border rounded-lg px-3 py-2 bg-background" /></label>
              ))}
              <label className="text-sm"><span className="text-xs text-muted-foreground">Horário da visita</span>
                <input type="time" value={edit.f["time"]} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, time: e.target.value } })} className="w-full border rounded-lg px-3 py-2 bg-background" /></label>
            </div>
            <label className="text-sm block"><span className="text-xs text-muted-foreground">Observações</span>
              <textarea rows={3} value={edit.f["notes"]} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, notes: e.target.value } })} className="w-full border rounded-lg px-3 py-2 bg-background" /></label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEdit(null)} className="px-4 py-2.5 text-sm text-muted-foreground">Cancelar</button>
              <button disabled={saving} onClick={saveEdit} className="btn-primary px-4 py-2.5 text-sm">{saving ? "Salvando…" : "Salvar alterações"}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
