import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AdminShell, StatusBadge, Empty, startOfDay, addDays, fmtTime } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { inRange, nextDueDate } from "@/lib/mock";
import { CalendarCheck, Droplet, Users, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Piscivel" }, { name: "description", content: "Indicadores do dia da operação Piscivel." }, { property: "og:title", content: "Dashboard — Piscivel" }, { property: "og:description", content: "Indicadores do dia." }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const [showVisits, setShowVisits] = useState(false);
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const from = startOfDay().toISOString(), to = addDays(startOfDay(), 1).toISOString();
      const since = addDays(startOfDay(), -30).toISOString();
      const [today, clients, reports, techs, pools] = await Promise.all([
        supabase.from("schedules").select("id, scheduled_at, visited_at, skip_note, status, technician:profiles(full_name), pool:swimming_pools(name, client:clients(name))").gte("scheduled_at", from).lt("scheduled_at", to).order("scheduled_at"),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("visit_reports").select("ph, free_chlorine, alkalinity, cyanuric_acid, created_at").gte("created_at", since).order("created_at"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "tecnico"),
        supabase.from("swimming_pools").select("id, name, address, payment_day, monthly_fee, client:clients(name, phone)").not("payment_day", "is", null),
      ]);
      const now = startOfDay(), limit = addDays(now, 7);
      const dues = (pools.data ?? []).map((p) => ({ ...p, due: nextDueDate(p.payment_day!, now) })).filter((p) => p.due < limit).sort((a, b) => +a.due - +b.due);
      return { today: today.data ?? [], clients: clients.count ?? 0, reports: reports.data ?? [], techs: techs.count ?? 0, dues };
    },
  });

  useEffect(() => {
    const ch = supabase.channel("dash").on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => qc.invalidateQueries({ queryKey: ["dashboard"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const today = data?.today ?? [];
  const done = today.filter((v) => v.status === "concluida").length;
  const reps = data?.reports ?? [];
  const balanced = reps.filter((r) => inRange("ph", r.ph) && inRange("free_chlorine", r.free_chlorine) && inRange("alkalinity", r.alkalinity) && inRange("cyanuric_acid", r.cyanuric_acid)).length;
  const rate = reps.length ? Math.round((balanced / reps.length) * 100) : 0;
  const lastPh = reps.filter((r) => r.ph != null).slice(-7);

  const stats = [
    { label: "Visitas hoje", value: `${done}/${today.length}`, sub: "concluídas / agendadas", icon: CalendarCheck, action: "visits" as const },
    { label: "Água equilibrada", value: reps.length ? `${rate}%` : "—", sub: "últimos 30 dias", icon: Droplet },
    { label: "Clientes ativos", value: String(data?.clients ?? 0), sub: "cadastrados", icon: Users, to: "/admin/clientes" as const },
    { label: "Técnicos", value: String(data?.techs ?? 0), sub: "na equipe", icon: Activity, to: "/admin/equipe" as const },
  ];
  const pending = today.filter((v) => v.status !== "concluida");
  const finished = today.filter((v) => v.status === "concluida");
  const Row = ({ v }: { v: (typeof today)[number] }) => (
    <div className="py-3 flex items-center gap-4">
      <span className="text-sm font-mono text-muted-foreground w-12">{v.visited_at ? fmtTime(v.visited_at) : "—"}</span>
      <div className="flex-1 min-w-0"><div className="font-medium truncate">{v.pool?.client?.name}{v.pool?.name ? ` · ${v.pool.name}` : ""}</div><div className="text-xs text-muted-foreground">{v.technician?.full_name ?? "Sem técnico"}{v.skip_note ? ` · remarcada: ${v.skip_note}` : ""}</div></div>
      <StatusBadge s={v.status} />
    </div>
  );
  return (
    <AdminShell title="Visão geral de hoje">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const inner = (<>
            <s.icon className="size-5 text-sky" />
            <div className="text-3xl font-bold mt-3">{s.value}</div>
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-xs text-muted-foreground">{s.sub}</div>
          </>);
          const cls = "glass p-5 text-left block transition hover:ring-2 ring-ring";
          if (s.to) return <Link key={s.label} to={s.to} className={cls}>{inner}</Link>;
          if (s.action) return <button key={s.label} onClick={() => setShowVisits((x) => !x)} className={`${cls} ${showVisits ? "ring-2" : ""}`}>{inner}</button>;
          return <div key={s.label} className="glass p-5">{inner}</div>;
        })}
      </div>
      {showVisits && (
        <div className="glass p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Todas as visitas de hoje ({today.length})</h2>
            <button onClick={() => setShowVisits(false)} className="text-sm text-muted-foreground hover:underline">Fechar</button>
          </div>
          {today.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma visita agendada para hoje.</p> : (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-1">A concluir ({pending.length})</h3>
                {pending.length === 0 ? <p className="text-sm text-muted-foreground">Todas concluídas.</p> : <div className="divide-y">{pending.map((v) => <Row key={v.id} v={v} />)}</div>}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">Concluídas ({finished.length})</h3>
                {finished.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma ainda.</p> : <div className="divide-y">{finished.map((v) => <Row key={v.id} v={v} />)}</div>}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="glass p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">Equipes em tempo real</h2>
          {today.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma visita agendada para hoje.</p> : (
            <div className="divide-y">
              {today.map((v) => (
                <div key={v.id} className="py-3 flex items-center gap-4">
                  <span className="text-sm font-mono text-muted-foreground w-12">{v.visited_at ? fmtTime(v.visited_at) : "—"}</span>
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{v.pool?.client?.name}{v.pool?.name ? ` · ${v.pool.name}` : ""}</div><div className="text-xs text-muted-foreground">{v.technician?.full_name ?? "Sem técnico"}{v.skip_note ? ` · remarcada: ${v.skip_note}` : ""}</div></div>
                  <StatusBadge s={v.status} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass p-5">
          <h2 className="font-semibold mb-4">pH das últimas medições</h2>
          {lastPh.length === 0 ? <Empty>Sem medições ainda.</Empty> : (
            <div className="flex items-end gap-2 h-40">
              {lastPh.map((r, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className={`w-full rounded-t-md ${inRange("ph", r.ph) ? "bg-gradient-primary" : "bg-petrol"}`} style={{ height: `${Math.max(5, Math.min(100, (Number(r.ph) - 6.5) * 70))}%` }} />
                  <span className="text-[10px] text-muted-foreground">{r.ph}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="glass p-5 mt-6">
        <h2 className="font-semibold mb-4">Mensalidades que vencem nos próximos 7 dias</h2>
        {(data?.dues ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma mensalidade vencendo esta semana.</p> : (
          <div className="divide-y">
            {data!.dues.map((p) => (
              <div key={p.id} className="py-3 flex items-center gap-4">
                <span className="text-sm font-mono text-muted-foreground w-14">{p.due.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                <div className="flex-1 min-w-0"><div className="font-medium truncate">{p.client?.name}{p.name ? ` · ${p.name}` : ""}</div><div className="text-xs text-muted-foreground">Vence todo dia {p.payment_day}</div></div>
                {p.monthly_fee != null && <span className="font-semibold">{Number(p.monthly_fee).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
