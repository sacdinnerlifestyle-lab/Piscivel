import { createFileRoute } from "@tanstack/react-router";
import { AdminShell, StatusBadge } from "@/components/Shell";
import { visits, techs } from "@/lib/mock";
import { CalendarCheck, Droplet, Users, Activity } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — Piscivel" }, { name: "description", content: "Indicadores do dia da operação Piscivel." }, { property: "og:title", content: "Dashboard — Piscivel" }, { property: "og:description", content: "Indicadores do dia." }] }),
  component: Dashboard,
});

function Dashboard() {
  const today = visits.filter((v) => v.day === 0);
  const done = today.filter((v) => v.status === "concluida").length;
  const stats = [
    { label: "Visitas hoje", value: `${done}/${today.length}`, sub: "concluídas / agendadas", icon: CalendarCheck },
    { label: "Água equilibrada", value: "92%", sub: "últimos 30 dias", icon: Droplet },
    { label: "Clientes ativos", value: "48", sub: "+3 este mês", icon: Users },
    { label: "Técnicos em campo", value: `${techs.length}`, sub: "online agora", icon: Activity },
  ];
  return (
    <AdminShell title="Visão geral de hoje">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass p-5">
            <s.icon className="size-5 text-sky" />
            <div className="text-3xl font-bold mt-3">{s.value}</div>
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-xs text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <div className="glass p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">Equipes em tempo real</h2>
          <div className="divide-y">
            {today.map((v) => (
              <div key={v.id} className="py-3 flex items-center gap-4">
                <span className="text-sm font-mono text-muted-foreground w-12">{v.time}</span>
                <div className="flex-1 min-w-0"><div className="font-medium truncate">{v.client}</div><div className="text-xs text-muted-foreground">{v.tech}</div></div>
                <StatusBadge s={v.status} />
              </div>
            ))}
          </div>
        </div>
        <div className="glass p-5">
          <h2 className="font-semibold mb-4">pH médio (7 dias)</h2>
          <div className="flex items-end gap-2 h-40">
            {[7.3, 7.5, 7.4, 7.8, 7.4, 7.3, 7.5].map((p, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full rounded-t-md ${p > 7.6 ? "bg-petrol" : "bg-gradient-primary"}`} style={{ height: `${(p - 6.8) * 120}%` }} />
                <span className="text-[10px] text-muted-foreground">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
