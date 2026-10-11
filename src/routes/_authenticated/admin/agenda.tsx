import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell, StatusBadge, inputCls, startOfDay, addDays, fmtTime } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { techsQuery } from "@/lib/queries";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/agenda")({
  head: () => ({ meta: [{ title: "Agenda semanal — Piscivel" }, { name: "description", content: "Distribuição das visitas por técnico." }, { property: "og:title", content: "Agenda semanal — Piscivel" }, { property: "og:description", content: "Distribuição das visitas por técnico." }] }),
  component: Agenda,
});

function Agenda() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const start = startOfDay();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const { data: team = [] } = useQuery(techsQuery);
  const { data: pools = [] } = useQuery({ queryKey: ["pools"], queryFn: async () => (await supabase.from("swimming_pools").select("id, client:clients(name)")).data ?? [] });
  const { data: sched = [] } = useQuery({
    queryKey: ["agenda"],
    queryFn: async () => (await supabase.from("schedules").select("id, scheduled_at, status, technician_id, pool:swimming_pools(client:clients(name))").gte("scheduled_at", start.toISOString()).lt("scheduled_at", addDays(start, 7).toISOString()).order("scheduled_at")).data ?? [],
  });

  useEffect(() => {
    const ch = supabase.channel("agenda").on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => qc.invalidateQueries({ queryKey: ["agenda"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const add = useMutation({
    mutationFn: async (d: { pool_id: string; technician_id: string; scheduled_at: string }) => { const { error } = await supabase.from("schedules").insert(d); if (error) throw error; },
    onSuccess: () => { toast.success("Visita agendada"); setOpen(false); qc.invalidateQueries({ queryKey: ["agenda"] }); },
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("schedules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda"] }),
  });

  const sameDay = (a: Date, s: string) => new Date(s).toDateString() === a.toDateString();
  const techs = team.filter((t) => t.roles.includes("tecnico") || t.roles.includes("admin"));

  return (
    <AdminShell title="Agenda da semana">
      <button onClick={() => setOpen(!open)} className="btn-primary px-4 py-2.5 mb-5 flex items-center gap-2"><Plus className="size-4" />Agendar visita</button>
      {open && (
        <form className="glass p-5 mb-6 grid sm:grid-cols-4 gap-3" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          add.mutate({ pool_id: String(f.get("pool")), technician_id: String(f.get("tech")), scheduled_at: new Date(String(f.get("when"))).toISOString() });
        }}>
          <select name="pool" required className={inputCls}><option value="">Cliente / piscina</option>{pools.map((p) => <option key={p.id} value={p.id}>{p.client?.name}</option>)}</select>
          <select name="tech" required className={inputCls}><option value="">Técnico</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}</select>
          <input name="when" type="datetime-local" required className={inputCls} />
          <button disabled={add.isPending} className="btn-primary py-2.5">Salvar</button>
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
                        <div className="font-semibold flex justify-between gap-1">{fmtTime(v.scheduled_at)} · {v.pool?.client?.name}
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
