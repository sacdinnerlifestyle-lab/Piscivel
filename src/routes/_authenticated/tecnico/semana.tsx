import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StatusBadge, Empty, startOfDay, addDays, fmtDate } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { isRainVisit, visitNoteLabel } from "@/lib/rain";
import { ArrowLeft, MapPin, FastForward } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tecnico/semana")({
  head: () => ({ meta: [{ title: "Minha semana — Piscivel" }, { name: "description", content: "Próximas visitas do técnico na semana." }, { property: "og:title", content: "Minha semana — Piscivel" }, { property: "og:description", content: "Próximas visitas do técnico na semana." }] }),
  component: Semana,
});

function Semana() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const start = startOfDay();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["my-week", me?.user.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("schedules").select("id, scheduled_at, status, skip_note, original_date, pool:swimming_pools(name, address, client:clients(name, address))").eq("technician_id", me!.user.id).gte("scheduled_at", start.toISOString()).lt("scheduled_at", addDays(start, 7).toISOString()).order("scheduled_at")).data ?? [],
  });

  const advance = useMutation({
    mutationFn: async (v: { id: string; scheduled_at: string; original_date: string | null }) => {
      const today = startOfDay();
      today.setHours(12, 0, 0, 0);
      const { error } = await supabase.from("schedules").update({
        scheduled_at: today.toISOString(),
        original_date: v.original_date ?? v.scheduled_at,
        skip_note: `Visita antecipada de ${fmtDate(v.scheduled_at)} para ${fmtDate(today.toISOString())}`,
      }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Visita antecipada para hoje"); qc.invalidateQueries({ queryKey: ["my-week"] }); qc.invalidateQueries({ queryKey: ["my-route"] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-lg mx-auto min-h-screen p-5 space-y-5">
      <Link to="/tecnico" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Voltar para hoje</Link>
      <div className="bg-deep text-abyss-foreground rounded-2xl p-5">
        <div className="text-sm opacity-75">Próximos 7 dias</div>
        <div className="text-2xl font-bold">{list.length} visitas na semana</div>
      </div>
      {isLoading ? <p className="text-center text-muted-foreground text-sm">Carregando…</p> : list.length === 0 ? <Empty>Nenhuma visita agendada para os próximos dias.</Empty> : days.map((d, i) => {
        const items = list.filter((v) => new Date(v.scheduled_at).toDateString() === d.toDateString());
        if (!items.length) return null;
        return (
          <section key={i} className="space-y-2">
            <h2 className="font-semibold capitalize flex justify-between">
              {i === 0 ? "Hoje" : i === 1 ? "Amanhã" : d.toLocaleDateString("pt-BR", { weekday: "long" })}
              <span className="text-sm text-muted-foreground font-normal">{d.toLocaleDateString("pt-BR")} · {items.length}</span>
            </h2>
            {items.map((v) => {
              const addr = v.pool?.address || v.pool?.client?.address;
              return (
                <div key={v.id} className={`glass p-4 ${v.status === "concluida" ? "border-success/40 bg-success/10" : ""}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold">{v.pool?.client?.name}</div>
                      {v.pool?.name && <div className="text-xs text-muted-foreground">{v.pool.name}</div>}
                    </div>
                    <StatusBadge s={v.status} />
                  </div>
                  {addr && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`} className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2"><MapPin className="size-3.5" />{addr}</a>}
                  {v.skip_note && (
                    <p className={`text-xs mt-2 ${isRainVisit(v.skip_note) ? "text-sky font-semibold" : "text-petrol"}`}>
                      {isRainVisit(v.skip_note) ? "Não realizada por chuva" : `Remarcada: ${visitNoteLabel(v.skip_note)}`}
                    </p>
                  )}
                  {i > 0 && v.status === "agendada" && (
                    <button disabled={advance.isPending} onClick={() => { if (confirm("Antecipar esta visita para hoje?")) advance.mutate(v); }} className="w-full mt-3 py-2.5 text-sm font-semibold text-primary flex items-center justify-center gap-2 border rounded-lg"><FastForward className="size-4" />Antecipar para hoje</button>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
