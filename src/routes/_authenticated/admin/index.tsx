import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AdminShell, StatusBadge, Empty, startOfDay, addDays, fmtTime } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { inRange, nextDueDate } from "@/lib/mock";
import { CalendarCheck, Droplet, Users, Activity, FileText } from "lucide-react";

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
      const [today, clients, reports, techs, pools, overdue] = await Promise.all([
        supabase.from("schedules").select("id, scheduled_at, visited_at, skip_note, status, technician_id, technician:profiles(full_name), pool:swimming_pools(name, client:clients(name))").gte("scheduled_at", from).lt("scheduled_at", to).order("scheduled_at"),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("visit_reports").select("ph, free_chlorine, alkalinity, cyanuric_acid, created_at").gte("created_at", since).order("created_at"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "tecnico"),
        supabase.from("swimming_pools").select("id, name, address, payment_day, monthly_fee, last_paid_due, client:clients(name, phone)").not("payment_day", "is", null),
        supabase.from("schedules").select("id, scheduled_at, status, technician:profiles(full_name), pool:swimming_pools(name, client:clients(name))").lt("scheduled_at", from).neq("status", "concluida").order("scheduled_at", { ascending: false }).limit(100),
      ]);
      const now = startOfDay(), limit = addDays(now, 7);
      const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dues = (pools.data ?? []).flatMap((p) => {
        const y = now.getFullYear(), m = now.getMonth();
        const thisMonth = new Date(y, m, Math.min(p.payment_day!, new Date(y, m + 1, 0).getDate()));
        if (thisMonth < now && p.last_paid_due !== key(thisMonth)) return [{ ...p, due: thisMonth, dueKey: key(thisMonth), paid: false, late: true }];
        const due = nextDueDate(p.payment_day!, now);
        if (due >= limit) return [];
        return [{ ...p, due, dueKey: key(due), paid: p.last_paid_due === key(due), late: false }];
      }).sort((a, b) => +a.due - +b.due);
      return { today: today.data ?? [], clients: clients.count ?? 0, reports: reports.data ?? [], techs: techs.count ?? 0, dues, overdue: overdue.data ?? [] };
    },
  });

  useEffect(() => {
    const ch = supabase.channel("dash").on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => qc.invalidateQueries({ queryKey: ["dashboard"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const markPaid = async (id: string, due: string | null) => {
    await supabase.from("swimming_pools").update({ last_paid_due: due }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const [resolved, setResolved] = useState<string[]>([]);
  useEffect(() => { try { setResolved(JSON.parse(localStorage.getItem("piscivel-resolved-overdue") ?? "[]")); } catch { /* ignore */ } }, []);
  const resolve = (id: string) => setResolved((r) => { const n = [...r, id]; localStorage.setItem("piscivel-resolved-overdue", JSON.stringify(n)); return n; });
  const overdue = (data?.overdue ?? []).filter((v) => !resolved.includes(v.id));
  const today = data?.today ?? [];
  const done = today.filter((v) => v.status === "concluida").length;
  const reps = data?.reports ?? [];
  const balanced = reps.filter((r) => inRange("ph", r.ph) && inRange("free_chlorine", r.free_chlorine) && inRange("alkalinity", r.alkalinity) && inRange("cyanuric_acid", r.cyanuric_acid)).length;
  const rate = reps.length ? Math.round((balanced / reps.length) * 100) : 0;

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
      {overdue.length > 0 && (
        <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-5 mb-6">
          <h2 className="font-semibold text-destructive mb-1">Visitas atrasadas não concluídas ({overdue.length})</h2>
          <p className="text-xs text-muted-foreground mb-3">Pergunte ao técnico se foi e esqueceu de marcar, ou por que não foi.</p>
          <div className="divide-y divide-destructive/20">
            {overdue.map((v) => (
              <div key={v.id} className="py-2.5 flex items-center gap-4">
                <span className="text-sm font-mono font-semibold text-destructive w-14">{new Date(v.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                <div className="flex-1 min-w-0"><div className="font-medium truncate">{v.pool?.client?.name}{v.pool?.name ? ` · ${v.pool.name}` : ""}</div><div className="text-xs text-muted-foreground">{v.technician?.full_name ?? "Sem técnico"}</div></div>
                <span className="text-xs font-semibold text-destructive hidden sm:inline">Não feita</span>
                <button onClick={() => resolve(v.id)} className="rounded-lg bg-resolved text-primary-foreground text-xs font-semibold px-3 py-1.5 hover:opacity-90">Resolvido</button>
              </div>
            ))}
          </div>
        </div>
      )}
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
      <div className="mt-6">
        <div className="glass p-5">
          <h2 className="font-semibold mb-4">Equipes em tempo real</h2>
          {today.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma visita agendada para hoje.</p> : (
            <div className="divide-y">
              {today.map((v) => (
                <div key={v.id} className="py-3 flex items-center gap-4">
                  <span className="text-sm font-mono text-muted-foreground w-12">{v.visited_at ? fmtTime(v.visited_at) : "—"}</span>
                  <div className="flex-1 min-w-0"><div className="font-medium truncate">{v.pool?.client?.name}{v.pool?.name ? ` · ${v.pool.name}` : ""}</div><div className="text-xs text-muted-foreground">{v.technician?.full_name ?? "Sem técnico"}{v.skip_note ? ` · remarcada: ${v.skip_note}` : ""}</div></div>
                  <StatusBadge s={v.status} />
                  {v.status === "concluida" && v.technician_id && <Link to="/admin/tecnico/$id" params={{ id: v.technician_id }} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"><FileText className="size-3.5" />Ver relatório</Link>}
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
              <div key={p.id} className={`py-3 px-3 my-1 rounded-lg flex items-center gap-4 ${p.paid ? "bg-resolved/15" : p.late ? "bg-destructive/10" : ""}`}>
                <span className={`text-sm font-mono w-14 ${p.late ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{p.due.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                <div className="flex-1 min-w-0"><div className="font-medium truncate">{p.client?.name}{p.name ? ` · ${p.name}` : ""}</div><div className={`text-xs ${p.late ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{p.late ? "Atrasado" : p.paid ? "Pago" : `Vence todo dia ${p.payment_day}`}</div></div>
                {p.monthly_fee != null && <span className="font-semibold">{Number(p.monthly_fee).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
                <button onClick={() => markPaid(p.id, p.paid ? null : p.dueKey)}
                  className={`rounded-lg text-xs font-semibold px-3 py-1.5 ${p.paid ? "bg-resolved text-primary-foreground" : p.late ? "bg-destructive text-primary-foreground" : "border hover:bg-secondary"}`}>
                  {p.paid ? "Pago ✓" : "Pago"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
