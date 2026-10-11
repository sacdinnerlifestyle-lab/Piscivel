import { createFileRoute } from "@tanstack/react-router";
import { AdminShell, StatusBadge } from "@/components/Shell";
import { visits, techs } from "@/lib/mock";

export const Route = createFileRoute("/admin/agenda")({
  head: () => ({ meta: [{ title: "Agenda semanal — Piscivel" }, { name: "description", content: "Distribuição das visitas por técnico." }, { property: "og:title", content: "Agenda semanal — Piscivel" }, { property: "og:description", content: "Distribuição das visitas por técnico." }] }),
  component: Agenda,
});

const days = ["Hoje", "Amanhã", "Qua", "Qui", "Sex"];

function Agenda() {
  return (
    <AdminShell title="Agenda da semana">
      <div className="glass p-4 overflow-x-auto">
        <div className="grid min-w-[800px]" style={{ gridTemplateColumns: `160px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => <div key={d} className="text-sm font-semibold p-2 text-center">{d}</div>)}
          {techs.map((t) => (
            <>
              <div key={t} className="p-2 text-sm font-medium border-t flex items-center">{t}</div>
              {days.map((_, i) => (
                <div key={t + i} className="border-t p-1.5 space-y-1.5 min-h-20">
                  {visits.filter((v) => v.tech === t && v.day === i).map((v) => (
                    <div key={v.id} className="bg-ice rounded-lg p-2 text-xs border">
                      <div className="font-semibold">{v.time} · {v.client}</div>
                      <div className="mt-1"><StatusBadge s={v.status} /></div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
