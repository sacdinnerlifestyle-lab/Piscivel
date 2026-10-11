import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo, StatusBadge } from "@/components/Shell";
import { visits } from "@/lib/mock";
import { MapPin, Play, LogOut } from "lucide-react";

export const Route = createFileRoute("/tecnico/")({
  head: () => ({ meta: [{ title: "Minha rota do dia — Piscivel" }, { name: "description", content: "Visitas do dia do técnico." }, { property: "og:title", content: "Minha rota do dia — Piscivel" }, { property: "og:description", content: "Visitas do dia do técnico." }] }),
  component: Tecnico,
});

function Tecnico() {
  const mine = visits.filter((v) => v.day === 0 && v.tech === "Rafael Lima");
  return (
    <div className="max-w-lg mx-auto min-h-screen p-5">
      <div className="flex justify-between items-center"><Logo /><Link to="/" className="text-muted-foreground"><LogOut className="size-5" /></Link></div>
      <div className="bg-deep text-abyss-foreground rounded-2xl p-5 mt-6">
        <div className="text-sm opacity-75">Olá, Rafael</div>
        <div className="text-2xl font-bold">{mine.length} visitas hoje</div>
        <div className="h-2 bg-abyss-foreground/20 rounded-full mt-4"><div className="h-full bg-aqua rounded-full" style={{ width: `${(mine.filter((v) => v.status === "concluida").length / mine.length) * 100}%` }} /></div>
      </div>
      <div className="space-y-3 mt-5">
        {mine.map((v) => (
          <div key={v.id} className="glass p-4">
            <div className="flex justify-between items-start gap-2">
              <div><div className="text-sm font-mono text-sky font-semibold">{v.time}</div><div className="font-semibold">{v.client}</div></div>
              <StatusBadge s={v.status} />
            </div>
            <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(v.address)}`} className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2"><MapPin className="size-3.5" />{v.address}</a>
            {v.status !== "concluida" && (
              <Link to="/tecnico/visita/$id" params={{ id: v.id }} className="btn-primary w-full py-3 mt-4 flex items-center justify-center gap-2"><Play className="size-4" />Iniciar Atendimento</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
