import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell, StatusBadge, inputCls, startOfDay, addDays, fmtTime } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { techsQuery } from "@/lib/queries";
import { Plus, Trash2, Repeat } from "lucide-react";
import { recurringDates } from "@/lib/mock";

export const Route = createFileRoute("/_authenticated/admin/agenda")({
  head: () => ({ meta: [{ title: "Agenda semanal — Piscivel" }, { name: "description", content: "Distribuição das visitas por técnico." }, { property: "og:title", content: "Agenda semanal — Piscivel" }, { property: "og:description", content: "Distribuição das visitas por técnico." }] }),
  component: Agenda,
});

function Agenda() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const start = startOfDay();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const { data: team = [] } = useQuery(techsQuery);
  const { data: pools = [] } = useQuery({ queryKey: ["pools"], queryFn: async () => (await supabase.from("swimming_pools").select("id, name, address, client:clients(name)").order("created_at")).data ?? [] });
  const { data: sched = [] } = useQuery({
    queryKey: ["agenda"],
    queryFn: async () => (await supabase.from("schedules").select("id, scheduled_at, status, technician_id, pool:swimming_pools(name, address, client:clients(name))").gte("scheduled_at", start.toISOString()).lt("scheduled_at", addDays(start, 7).toISOString()).order("scheduled_at")).data ?? [],
  });

  useEffect(() => {
    const ch = supabase.channel("agenda").on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => qc.invalidateQueries({ queryKey: ["agenda"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const add = useMutation({
    mutationFn: async (rows: { pool_id: string; technician_id: string; scheduled_at: string }[]) => { const { error } = await supabase.from("schedules").insert(rows); if (error) throw error; return rows.length; },
    onSuccess: (n) => { toast.success(n > 1 ? `${n} visitas agendadas` : "Visita agendada"); setOpen(false); setBulk(false); setWeekdays([]); qc.invalidateQueries({ queryKey: ["agenda"] }); },
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("schedules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda"] }),
  });

  const sameDay = (a: Date, s: string) => new Date(s).toDateString() === a.toDateString();
  const techs = team.filter((t) => t.roles.includes("tecnico") || t.roles.includes("admin"));
  const poolOptions = pools.map((p) => <option key={p.id} value={p.id}>{p.client?.name}{p.name || p.address ? ` — ${p.name || p.address}` : ""}</option>);
  const techOptions = techs.map((t) => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>);

  return (
    <AdminShell title="Agenda da semana">
      <div className="flex flex-wrap gap-3 mb-5">
        <button onClick={() => { setOpen(!open); setBulk(false); }} className="btn-primary px-4 py-2.5 flex items-center gap-2"><Plus className="size-4" />Agendar visita</button>
        <button onClick={() => { setBulk(!bulk); setOpen(false); }} className="glass px-4 py-2.5 flex items-center gap-2 font-semibold text-primary"><Repeat className="size-4" />Agendar várias (recorrente)</button>
      </div>
      {open && (
        <form className="glass p-5 mb-6 grid sm:grid-cols-4 gap-3" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          add.mutate([{ pool_id: String(f.get("pool")), technician_id: String(f.get("tech")), scheduled_at: new Date(String(f.get("when"))).toISOString() }]);
        }}>
          <select name="pool" required className={inputCls}><option value="">Cliente / piscina</option>{poolOptions}</select>
          <select name="tech" required className={inputCls}><option value="">Técnico</option>{techOptions}</select>
          <input name="when" type="datetime-local" required className={inputCls} />
          <button disabled={add.isPending} className="btn-primary py-2.5">Salvar</button>
        </form>
      )}
      {bulk && (
        <form className="glass p-5 mb-6 space-y-4" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          const poolIds = f.getAll("pools").map(String);
          if (!poolIds.length) { toast.error("Selecione ao menos uma piscina."); return; }
          if (!weekdays.length) { toast.error("Escolha os dias da semana."); return; }
          const dates = recurringDates(new Date(`${f.get("start")}T00:00`), weekdays, String(f.get("time")), Number(f.get("weeks")));
          const rows = poolIds.flatMap((pool_id) => dates.map((d) => ({ pool_id, technician_id: String(f.get("tech")), scheduled_at: d.toISOString() })));
          if (rows.length > 500) { toast.error("Muitas visitas de uma vez (máx. 500). Reduza as semanas."); return; }
          add.mutate(rows);
        }}>
          <div>
            <div className="text-sm font-semibold mb-2">Piscinas</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {pools.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm bg-ice border rounded-lg px-3 py-2">
                  <input type="checkbox" name="pools" value={p.id} className="accent-primary" />
                  {p.client?.name}{p.name || p.address ? ` — ${p.name || p.address}` : ""}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Dias da semana</div>
            <div className="flex flex-wrap gap-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => { const on = weekdays.includes(i); return (
                <button type="button" key={d} onClick={() => setWeekdays(on ? weekdays.filter((x) => x !== i) : [...weekdays, i])} className={`px-4 py-2 rounded-full text-sm font-medium border ${on ? "bg-primary text-primary-foreground" : "bg-ice"}`}>{d}</button>
              ); })}
            </div>
          </div>
          <div className="grid sm:grid-cols-4 gap-3">
            <label className="text-xs text-muted-foreground space-y-1"><span>Técnico</span><select name="tech" required className={inputCls}><option value="">Selecione</option>{techOptions}</select></label>
            <label className="text-xs text-muted-foreground space-y-1"><span>Horário</span><input name="time" type="time" required defaultValue="09:00" className={inputCls} /></label>
            <label className="text-xs text-muted-foreground space-y-1"><span>Começa em</span><input name="start" type="date" required defaultValue={new Date().toLocaleDateString("en-CA")} className={inputCls} /></label>
            <label className="text-xs text-muted-foreground space-y-1"><span>Repetir por</span>
              <select name="weeks" defaultValue="4" className={inputCls}>{[1, 2, 4, 8, 12, 26].map((w) => <option key={w} value={w}>{w} semana{w > 1 ? "s" : ""}</option>)}</select>
            </label>
          </div>
          <button disabled={add.isPending} className="btn-primary py-2.5 w-full">{add.isPending ? "Agendando…" : "Criar visitas"}</button>
        </form>
      )}
      {techs.length === 0 ? <p className="text-sm text-muted-foreground">Cadastre técnicos na aba Equipe para montar a agenda.</p> : (
        <div className="glass p-4 overflow-x-auto">
          <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `160px repeat(${days.length}, 1fr)` }}>
            <div />
            {days.map((d, i) => <div key={i} className="text-sm font-semibold p-2 text-center capitalize">{i === 0 ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })}</div>)}
            {techs.map((t) => (
              <Fragment key={t.id}>
                <div className="p-2 text-sm font-medium border-t flex items-center">{t.full_name || t.email}</div>
                {days.map((d, i) => (
                  <div key={i} className="border-t p-1.5 space-y-1.5 min-h-20">
                    {sched.filter((s) => s.technician_id === t.id && sameDay(d, s.scheduled_at)).map((v) => (
                      <div key={v.id} className="bg-ice rounded-lg p-2 text-xs border group">
                        <div className="font-semibold flex justify-between gap-1">{fmtTime(v.scheduled_at)} · {v.pool?.client?.name}{v.pool?.name ? ` (${v.pool.name})` : ""}
                          {v.status === "agendada" && <button onClick={() => del.mutate(v.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground" aria-label="Remover"><Trash2 className="size-3" /></button>}
                        </div>
                        <div className="mt-1"><StatusBadge s={v.status} /></div>
                      </div>
                    ))}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
