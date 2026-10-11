import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Shell";
import { clientReports, params } from "@/lib/mock";
import { LogOut, CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/cliente")({
  head: () => ({ meta: [{ title: "Minha piscina — Piscivel" }, { name: "description", content: "Acompanhe semanalmente o tratamento da sua piscina." }, { property: "og:title", content: "Minha piscina — Piscivel" }, { property: "og:description", content: "Acompanhe semanalmente o tratamento da sua piscina." }] }),
  component: Cliente,
});

type Key = "ph" | "cl" | "alk" | "cya";
const inRange = (k: Key, v: number) => { const p = params.find((x) => x.key === k)!; return v >= p.min && v <= p.max; };

function Cliente() {
  const last = clientReports[0]!;
  const balanced = (Object.keys({ ph: 1, cl: 1, alk: 1, cya: 1 }) as Key[]).every((k) => inRange(k, last[k]));
  return (
    <div className="max-w-3xl mx-auto min-h-screen p-5 space-y-5">
      <div className="flex justify-between items-center"><Logo /><Link to="/" className="text-muted-foreground flex items-center gap-2 text-sm"><LogOut className="size-4" />Sair</Link></div>

      <div className="bg-deep text-abyss-foreground rounded-2xl p-6">
        <div className="text-sm opacity-75">Olá, Família Andrade</div>
        <div className="text-2xl font-bold mt-1">Piscina de pastilha · 28 m³</div>
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <span className="flex items-center gap-2">{balanced ? <CheckCircle2 className="size-4 text-aqua" /> : <AlertTriangle className="size-4 text-aqua" />}{balanced ? "Água equilibrada" : "Em correção"}</span>
          <span className="flex items-center gap-2"><CalendarClock className="size-4 text-aqua" />Próxima visita: 16/10 às 09:30</span>
        </div>
      </div>

      <section className="glass p-5">
        <h2 className="font-semibold mb-4">Evolução semanal</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {params.map((p) => (
            <div key={p.key} className="bg-ice rounded-xl p-3 border">
              <div className="text-xs text-muted-foreground">{p.label}</div>
              <div className="text-xl font-bold">{last[p.key as Key]} <span className="text-xs font-normal">{p.unit}</span></div>
              <div className="flex items-end gap-1 h-10 mt-2">
                {[...clientReports].reverse().map((r, i) => (
                  <div key={i} className={`flex-1 rounded-sm ${inRange(p.key as Key, r[p.key as Key]) ? "bg-sky" : "bg-petrol"}`} style={{ height: `${Math.min(100, (r[p.key as Key] / (p.max * 1.2)) * 100)}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Histórico de visitas</h2>
        {clientReports.map((r) => (
          <div key={r.date} className="glass p-5">
            <div className="flex justify-between items-center"><div className="font-semibold">{r.date}</div><span className="text-xs text-muted-foreground">Técnico: {r.tech}</span></div>
            <p className="text-sm mt-1">{r.note}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {params.map((p) => { const v = r[p.key as Key]; const ok = inRange(p.key as Key, v); return (
                <span key={p.key} className={`text-xs px-2.5 py-1 rounded-full font-medium ${ok ? "bg-secondary text-abyss" : "bg-petrol text-primary-foreground"}`}>{p.label}: {v}</span>
              ); })}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
              <div><div className="text-xs text-muted-foreground mb-1">Serviços</div>{r.tasks.join(" · ")}</div>
              <div><div className="text-xs text-muted-foreground mb-1">Produtos aplicados</div>{r.products.join(" · ")}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
