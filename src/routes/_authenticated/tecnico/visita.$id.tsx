import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { params, inRange, chems, chemUnit, tasks, type ParamKey } from "@/lib/mock";
import { meQuery } from "@/lib/session";
import { ArrowLeft, Camera, Check, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tecnico/visita/$id")({
  head: () => ({ meta: [{ title: "Ficha de visita — Piscivel" }, { name: "description", content: "Ficha de registro da visita." }, { property: "og:title", content: "Ficha de visita — Piscivel" }, { property: "og:description", content: "Ficha de registro da visita." }] }),
  component: Visita,
});

function Visita() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: me } = useQuery(meQuery);
  const { data: v, isLoading } = useQuery({
    queryKey: ["schedule", id],
    queryFn: async () => (await supabase.from("schedules").select("id, status, pool:swimming_pools(name, coating, volume_m3, client:clients(name, phone))").eq("id", id).maybeSingle()).data,
  });
  const [vals, setVals] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string[]>([]);
  const [files, setFiles] = useState<{ antes?: File; depois?: File; maquinas?: File; nota?: File }>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [visitTime, setVisitTime] = useState(() => new Date().toTimeString().slice(0, 5));

  useEffect(() => {
    if (v?.status === "agendada") {
      supabase.from("schedules").update({ status: "em_andamento" }).eq("id", id).then(() => qc.invalidateQueries({ queryKey: ["my-route"] }));
    }
  }, [v?.status, id, qc]);

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  if (!v) return <div className="p-10 text-center">Visita não encontrada. <Link to="/tecnico" className="text-primary">Voltar</Link></div>;

  const num = (k: string) => { const n = parseFloat(vals[k] ?? ""); return isNaN(n) ? null : n; };
  const ready = files.antes && files.depois;
  const client = v.pool?.client;

  const summary = [
    `*Piscivel – Relatório de Visita*`, `Cliente: ${client?.name}`, ...(v.pool?.name ? [`Piscina: ${v.pool.name}`] : []), `Data: ${new Date().toLocaleDateString("pt-BR")} às ${visitTime}`, ``,
    `*Parâmetros da água*`, ...params.map((p) => { const s = inRange(p.key, num(p.key)); return `• ${p.label}: ${vals[p.key] || "-"} ${p.unit} ${s ? "✅" : s === false ? "⚠️" : ""}`; }),
    ``, `*Produtos aplicados*`, ...Object.entries(used).filter(([, q]) => q).map(([c, q]) => `• ${c}: ${q} ${chemUnit[c] ?? ""}`.trim()), ``,
    `*Serviços realizados*`, ...done.map((t) => `✔ ${t}`), ``, ...(notes.trim() ? [`*Observações*`, notes.trim(), ``] : []), `Sua piscina está cristalina! 💧`,
  ].join("\n");

  async function finish() {
    if (!ready || !me) return;
    setSaving(true);
    try {
      const up = async (f: File, k: string) => {
        const path = `${id}/${k}-${Date.now()}.${f.name.split(".").pop() || "jpg"}`;
        const { error } = await supabase.storage.from("visit-photos").upload(path, f, { upsert: true });
        if (error) throw error;
        return path;
      };
      const [before, after, machine, notePhoto] = await Promise.all([up(files.antes!, "antes"), up(files.depois!, "depois"), files.maquinas ? up(files.maquinas, "maquinas") : Promise.resolve(null), files.nota ? up(files.nota, "observacao") : Promise.resolve(null)]);
      const { error } = await supabase.from("visit_reports").upsert({
        schedule_id: id, technician_id: me.user.id,
        ph: num("ph"), free_chlorine: num("free_chlorine"), alkalinity: num("alkalinity"), cyanuric_acid: num("cyanuric_acid"), calcium_hardness: num("calcium_hardness"), temperature: num("temperature"),
        chemicals: Object.fromEntries(Object.entries(used).filter(([, q]) => q).map(([c, q]) => [c, `${q} ${chemUnit[c] ?? ""}`.trim()])), tasks: done, notes: notes.trim() || null, photo_note: notePhoto,
        photo_before: before, photo_after: after, photo_machine: machine,
      }, { onConflict: "schedule_id" });
      if (error) throw error;
      const [hh, mm] = visitTime.split(":").map(Number);
      const at = new Date(); at.setHours(hh ?? 0, mm ?? 0, 0, 0);
      await supabase.from("schedules").update({ status: "concluida", visited_at: at.toISOString() }).eq("id", id);
      toast.success("Visita encerrada!");
      qc.invalidateQueries();
      nav({ to: "/tecnico" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setSaving(false); }
  }

  const card = "glass p-5 space-y-3";
  return (
    <div className="max-w-lg mx-auto p-5 pb-28 space-y-4">
      <Link to="/tecnico" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Voltar</Link>
      <div><h1 className="text-2xl font-bold">{client?.name}</h1><p className="text-sm text-muted-foreground">{v.pool?.name ? `${v.pool.name} · ` : ""}{v.pool?.coating} · {v.pool?.volume_m3} m³</p></div>

      <section className={card}>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Horário da visita</span>
          <input type="time" required value={visitTime} onChange={(e) => setVisitTime(e.target.value)} className="rounded-lg border bg-ice px-3 py-2 text-lg font-bold" />
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
          {(["antes", "depois", "maquinas"] as const).map((k) => (
            <label key={k} className="aspect-square rounded-xl border-2 border-dashed bg-ice grid place-items-center overflow-hidden cursor-pointer">
              {files[k] ? <img src={URL.createObjectURL(files[k]!)} alt={k} className="size-full object-cover" /> : <div className="text-center text-sm text-muted-foreground"><Camera className="size-6 mx-auto mb-1 text-sky" />{k === "antes" ? "Antes" : k === "depois" ? "Depois" : "Casa de Máquinas"}</div>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles({ ...files, [k]: f }); }} />
            </label>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Observações <span className="text-xs text-muted-foreground font-normal">(algo anormal na piscina?)</span></h2>
        <textarea value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Descreva o que aconteceu…" className="w-full rounded-lg border bg-ice px-3 py-2 text-sm" />
        <label className="flex items-center gap-3 rounded-xl border-2 border-dashed bg-ice p-3 cursor-pointer">
          {files.nota ? <img src={URL.createObjectURL(files.nota)} alt="Foto da observação" className="size-16 rounded-lg object-cover" /> : <Camera className="size-6 text-sky" />}
          <span className="text-sm text-muted-foreground">{files.nota ? "Trocar foto da observação" : "Adicionar foto da observação (opcional)"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles({ ...files, nota: f }); }} />
        </label>
      </section>

      <div className="fixed bottom-0 inset-x-0 p-4 glass rounded-none">
        <button onClick={finish} disabled={!ready || saving} className="btn-primary w-full max-w-lg mx-auto py-3.5 flex items-center justify-center gap-2 disabled:opacity-50">
          <Check className="size-5" />{saving ? "Salvando…" : ready ? "Encerrar visita" : "Adicione as fotos para encerrar"}
        </button>
      </div>
    </div>
  );
}
