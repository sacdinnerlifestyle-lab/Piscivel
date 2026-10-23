import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { params, inRange, chems, chemUnit, tasks, type ParamKey } from "@/lib/mock";
import { meQuery } from "@/lib/session";
import { techsQuery } from "@/lib/queries";
import { ArrowLeft, Camera, Check } from "lucide-react";
import { localDateKey, visitTimestamp } from "@/lib/visit-datetime";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tecnico/visita/$id")({
  head: () => ({ meta: [{ title: "Ficha de visita — Piscivel" }, { name: "description", content: "Ficha de registro da visita." }, { property: "og:title", content: "Ficha de visita — Piscivel" }, { property: "og:description", content: "Ficha de registro da visita." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Visita,
});

const photoFields = [
  { formKey: "antes", dbKey: "photo_before", label: "Antes" },
  { formKey: "depois", dbKey: "photo_after", label: "Depois" },
  { formKey: "maquinas", dbKey: "photo_machine", label: "Casa de Máquinas" },
] as const;

/** Recupera só a quantidade de um produto salvo no formato "2 kg". */
function chemQty(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  const first = text.split(/\s+/)[0] ?? "";
  return /^[\d.,]+$/.test(first) ? first : text;
}

function Visita() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: me } = useQuery(meQuery);
  const userId = me?.user.id;
  const { data: isManager = false } = useQuery({
    queryKey: ["manager-role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).some((entry) => entry.role === "admin");
    },
  });
  const { data: team = [] } = useQuery({ ...techsQuery, enabled: isManager });
  const { data: v, isLoading } = useQuery({
    queryKey: ["schedule", id],
    queryFn: async () => (await supabase.from("schedules").select("id, status, technician_id, scheduled_at, visited_at, pool:swimming_pools(name, coating, volume_m3, client:clients(name, phone))").eq("id", id).maybeSingle()).data,
  });
  const { data: existingReport } = useQuery({
    queryKey: ["schedule-report", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_reports")
        .select("ph, free_chlorine, alkalinity, cyanuric_acid, calcium_hardness, temperature, chemicals, tasks, notes, photo_before, photo_after, photo_machine, photo_note")
        .eq("schedule_id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const photoUrls: Record<string, string> = {};
      const paths: Array<[string, string | null]> = [
        ["photo_before", data.photo_before],
        ["photo_after", data.photo_after],
        ["photo_machine", data.photo_machine],
        ["photo_note", data.photo_note],
      ];
      for (const [key, path] of paths) {
        if (!path) continue;
        const { data: signed } = await supabase.storage.from("visit-photos").createSignedUrl(path, 60 * 60);
        if (signed?.signedUrl) photoUrls[key] = signed.signedUrl;
      }

      return { report: data, photoUrls };
    },
  });
  const [vals, setVals] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string[]>([]);
  const [files, setFiles] = useState<{ antes?: File; depois?: File; maquinas?: File; nota?: File }>({});
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [visitTime, setVisitTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [visitDate, setVisitDate] = useState(localDateKey);
  const [datePrefilled, setDatePrefilled] = useState(false);
  const [reportPrefilled, setReportPrefilled] = useState(false);

  useEffect(() => {
    if (v?.status === "agendada") {
      supabase.from("schedules").update({ status: "em_andamento" }).eq("id", id).then(() => qc.invalidateQueries({ queryKey: ["my-route"] }));
    }
  }, [v?.status, id, qc]);

  useEffect(() => {
    if (v?.technician_id) setSelectedTechnicianId(v.technician_id);
  }, [v?.technician_id]);

  // Mantém a data e o horário já registrados na visita.
  useEffect(() => {
    if (!v || datePrefilled) return;
    const source = v.visited_at ?? v.scheduled_at;
    if (!source) return;
    const date = new Date(source);
    if (!Number.isFinite(date.getTime())) return;
    setVisitDate(localDateKey(date));
    setVisitTime(date.toTimeString().slice(0, 5));
    setDatePrefilled(true);
  }, [v, datePrefilled]);

  // Mantém as informações já preenchidas no relatório da visita.
  useEffect(() => {
    const report = existingReport?.report;
    if (!report || reportPrefilled) return;
    const row = report as unknown as Record<string, unknown>;

    const nextVals: Record<string, string> = {};
    for (const p of params) {
      const value = row[p.key];
      if (value !== null && value !== undefined && value !== "") nextVals[p.key] = String(value);
    }
    setVals(nextVals);

    const storedChemicals = row.chemicals;
    if (storedChemicals && typeof storedChemicals === "object" && !Array.isArray(storedChemicals)) {
      const nextUsed: Record<string, string> = {};
      for (const [name, qty] of Object.entries(storedChemicals as Record<string, unknown>)) {
        nextUsed[name] = chemQty(qty);
      }
      setUsed(nextUsed);
    }

    if (Array.isArray(row.tasks)) setDone(row.tasks.filter((task): task is string => typeof task === "string"));
    if (typeof row.notes === "string") setNotes(row.notes);
    setReportPrefilled(true);
  }, [existingReport, reportPrefilled]);

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  if (!v) return <div className="p-10 text-center">Visita não encontrada. <Link to="/tecnico" className="text-primary">Voltar</Link></div>;

  const num = (k: string) => { const n = parseFloat(vals[k] ?? ""); return isNaN(n) ? null : n; };
  const existing = existingReport?.report;
  const photoUrls = existingReport?.photoUrls ?? {};
  const ready = Boolean((files.antes || existing?.photo_before) && (files.depois || existing?.photo_after));
  const client = v.pool?.client;

  const summary = [
    `*Piscivel – Relatório de Visita*`, `Cliente: ${client?.name}`, ...(v.pool?.name ? [`Piscina: ${v.pool.name}`] : []), `Data: ${visitDate.split("-").reverse().join("/")} às ${visitTime}`, ``,
    `*Parâmetros da água*`, ...params.map((p) => { const s = inRange(p.key, num(p.key)); return `• ${p.label}: ${vals[p.key] || "-"} ${p.unit} ${s ? "✅" : s === false ? "⚠️" : ""}`; }),
    ``, `*Produtos aplicados*`, ...Object.entries(used).filter(([, q]) => q).map(([c, q]) => `• ${c}: ${q} ${chemUnit[c] ?? ""}`.trim()), ``,
    `*Serviços realizados*`, ...done.map((t) => `✔ ${t}`), ``, ...(notes.trim() ? [`*Observações*`, notes.trim(), ``] : []), `Sua piscina está cristalina! 💧`,
  ].join("\n");

  async function finish() {
    if (!me) return;
    if (!(files.antes || existing?.photo_before) || !(files.depois || existing?.photo_after)) {
      toast.error("Mantenha ou envie as fotos Antes e Depois.");
      return;
    }
    const technicianId = isManager ? selectedTechnicianId : me.user.id;
    if (isManager && !technicianId) {
      toast.error("Selecione o técnico que realizou a visita.");
      return;
    }
    setSaving(true);
    try {
      const visitedAt = visitTimestamp(visitDate, visitTime);
      const up = async (f: File, k: string) => {
        const path = `${id}/${k}-${Date.now()}.${f.name.split(".").pop() || "jpg"}`;
        const { error } = await supabase.storage.from("visit-photos").upload(path, f, { upsert: true });
        if (error) throw error;
        return path;
      };
      const [before, after, machine, notePhoto] = await Promise.all([
        files.antes ? up(files.antes, "antes") : Promise.resolve(existing?.photo_before ?? null),
        files.depois ? up(files.depois, "depois") : Promise.resolve(existing?.photo_after ?? null),
        files.maquinas ? up(files.maquinas, "maquinas") : Promise.resolve(existing?.photo_machine ?? null),
        files.nota ? up(files.nota, "observacao") : Promise.resolve(existing?.photo_note ?? null),
      ]);
      const { error } = await supabase.from("visit_reports").upsert({
        schedule_id: id, technician_id: technicianId,
        ph: num("ph"), free_chlorine: num("free_chlorine"), alkalinity: num("alkalinity"), cyanuric_acid: num("cyanuric_acid"), calcium_hardness: num("calcium_hardness"), temperature: num("temperature"),
        chemicals: Object.fromEntries(Object.entries(used).filter(([, q]) => q).map(([c, q]) => [c, `${q} ${chemUnit[c] ?? ""}`.trim()])), tasks: done, notes: notes.trim() || null, photo_note: notePhoto,
        photo_before: before, photo_after: after, photo_machine: machine,
      }, { onConflict: "schedule_id" });
      if (error) throw error;
      const scheduleUpdate = isManager
        ? { status: "concluida", visited_at: visitedAt, technician_id: technicianId }
        : { status: "concluida", visited_at: visitedAt };
      const { error: scheduleError } = await supabase.from("schedules").update(scheduleUpdate).eq("id", id);
      if (scheduleError) throw scheduleError;
      toast.success(existing ? "Visita atualizada!" : "Visita encerrada!");
      qc.invalidateQueries();
      if (isManager) nav({ to: "/admin/visitas" });
      else nav({ to: "/tecnico" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setSaving(false); }
  }

  const notePreview = files.nota ? URL.createObjectURL(files.nota) : photoUrls.photo_note;
  const card = "glass p-5 space-y-3";
  return (
    <div className="max-w-lg mx-auto p-5 pb-28 space-y-4">
      <Link to={isManager ? "/admin/visitas" : "/tecnico"} className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Voltar</Link>
      <div><h1 className="text-2xl font-bold">{client?.name}</h1><p className="text-sm text-muted-foreground">{v.pool?.name ? `${v.pool.name} · ` : ""}{v.pool?.coating} · {v.pool?.volume_m3} m³</p></div>

      {existing && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs font-medium text-primary">
          Esta visita já tem relatório. As informações preenchidas estão carregadas abaixo e podem ser alteradas.
        </div>
      )}

      {isManager && (
        <section className={card}>
          <div>
            <h2 className="font-semibold">Técnico que realizou a visita</h2>
            <p className="mt-1 text-xs text-muted-foreground">Selecione o técnico responsável por esta visita.</p>
          </div>
          <select
            value={selectedTechnicianId}
            onChange={(e) => setSelectedTechnicianId(e.target.value)}
            disabled={saving}
            className="w-full rounded-lg border bg-ice px-3 py-2.5 text-sm"
          >
            <option value="">Selecione o técnico</option>
            {team.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.full_name || technician.email}
              </option>
            ))}
          </select>
        </section>
      )}

      <section className={card}>
        <label className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">Data da visita</span>
          <input type="date" required disabled={saving} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="min-w-0 max-w-full rounded-lg border bg-ice px-3 py-2 text-lg font-bold" />
        </label>
        <label className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">Horário da visita</span>
          <input type="time" required disabled={saving} value={visitTime} onChange={(e) => setVisitTime(e.target.value)} className="rounded-lg border bg-ice px-3 py-2 text-lg font-bold" />
        </label>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Parâmetros da água</h2>
        <div className="space-y-3">
          {params.map((p) => { const s = inRange(p.key as ParamKey, num(p.key)); return (
            <div key={p.key} className={`rounded-xl border-2 p-3 bg-ice ${s === true ? "border-sky" : s === false ? "border-petrol" : "border-transparent"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{p.label}</div>
                <input aria-label={p.label} inputMode="decimal" type="number" step={p.step} value={vals[p.key] ?? ""} onChange={(e) => setVals({ ...vals, [p.key]: e.target.value })} className="w-20 bg-transparent text-right text-xl font-bold outline-none" placeholder="—" />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.options.map((o) => { const sel = num(p.key) === o; const ok = o >= p.min && o <= p.max; return (
                  <button type="button" key={o} onClick={() => setVals({ ...vals, [p.key]: String(o) })} className={`min-w-11 px-2.5 py-1.5 rounded-lg text-sm font-semibold border ${sel ? "bg-primary text-primary-foreground border-primary" : ok ? "bg-background" : "bg-background text-muted-foreground"}`}>{String(o).replace(".", ",")}</button>
                ); })}
              </div>
              <div className={`text-[11px] font-medium mt-1.5 ${s === false ? "text-petrol" : "text-sky"}`}>{s === null ? `Ideal ${p.min}–${p.max} ${p.unit}` : s ? "Equilibrado" : "Fora do padrão"}</div>
            </div>
          ); })}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Tratamento químico</h2>
        {chems.map((c) => (
          <div key={c} className="flex items-center gap-3"><span className="flex-1 text-sm">{c}</span>
            <input value={used[c] ?? ""} maxLength={30} onChange={(e) => setUsed({ ...used, [c]: e.target.value })} inputMode="decimal" placeholder="qtd." className="w-20 rounded-lg border bg-ice px-3 py-1.5 text-sm" /><span className="w-6 text-xs text-muted-foreground">{chemUnit[c]}</span></div>
        ))}
      </section>

      <section className={card}>
        <h2 className="font-semibold">Checklist físico</h2>
        {tasks.map((t) => { const on = done.includes(t); return (
          <button key={t} onClick={() => setDone(on ? done.filter((x) => x !== t) : [...done, t])} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm border ${on ? "bg-primary text-primary-foreground" : "bg-ice"}`}>
            <span className={`size-5 grid place-items-center rounded-md border ${on ? "bg-primary-foreground text-primary" : ""}`}>{on && <Check className="size-3.5" />}</span>{t}
          </button>
        ); })}
      </section>

      <section className={card}>
        <h2 className="font-semibold">Fotos <span className="text-xs text-muted-foreground font-normal">(Antes e Depois obrigatórias · câmera ou galeria)</span></h2>
        <div className="grid grid-cols-3 gap-3">
          {photoFields.map(({ formKey, dbKey, label }) => {
            const selected = files[formKey];
            const preview = selected ? URL.createObjectURL(selected) : photoUrls[dbKey];
            return (
              <label key={formKey} className="aspect-square rounded-xl border-2 border-dashed bg-ice grid place-items-center overflow-hidden cursor-pointer">
                {preview ? <img src={preview} alt={label} className="size-full object-cover" /> : <div className="text-center text-sm text-muted-foreground"><Camera className="size-6 mx-auto mb-1 text-sky" />{label}</div>}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles({ ...files, [formKey]: f }); }} />
              </label>
            );
          })}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Observações <span className="text-xs text-muted-foreground font-normal">(algo anormal na piscina?)</span></h2>
        <textarea value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Descreva o que aconteceu…" className="w-full rounded-lg border bg-ice px-3 py-2 text-sm" />
        <label className="flex items-center gap-3 rounded-xl border-2 border-dashed bg-ice p-3 cursor-pointer">
          {notePreview ? <img src={notePreview} alt="Foto da observação" className="size-16 rounded-lg object-cover" /> : <Camera className="size-6 text-sky" />}
          <span className="text-sm text-muted-foreground">{notePreview ? "Trocar foto da observação" : "Adicionar foto da observação (opcional)"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles({ ...files, nota: f }); }} />
        </label>
      </section>

      <div className="fixed bottom-0 inset-x-0 p-4 glass rounded-none">
        <Button onClick={finish} disabled={!ready || !visitDate || !visitTime || (isManager && !selectedTechnicianId) || saving} className="btn-primary h-auto w-full max-w-lg mx-auto py-3.5 flex items-center justify-center gap-2 disabled:opacity-50">
          <Check className="size-5" />{saving ? "Salvando…" : !ready ? "Mantenha ou envie as fotos Antes e Depois" : isManager && !selectedTechnicianId ? "Selecione o técnico" : existing ? "Salvar alterações" : "Encerrar visita"}
        </Button>
      </div>
    </div>
  );
}
