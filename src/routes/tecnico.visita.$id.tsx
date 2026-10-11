import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { visits, params } from "@/lib/mock";
import { ArrowLeft, Camera, Check, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/tecnico/visita/$id")({
  loader: ({ params: p }) => { const v = visits.find((x) => x.id === p.id); if (!v) throw notFound(); return v; },
  head: ({ loaderData }) => ({ meta: [{ title: `Atendimento ${loaderData?.client ?? ""} — Piscivel` }, { name: "description", content: "Ficha de registro da visita." }, { property: "og:title", content: "Ficha de visita — Piscivel" }, { property: "og:description", content: "Ficha de registro da visita." }] }),
  component: Visita,
});

const chems = ["Cloro granulado", "Clarificante", "Barrilha", "Algicida", "Redutor de pH", "Sulfato de alumínio"];
const tasks = ["Peneiramento", "Escovação", "Aspiração ao fundo", "Limpeza de skimmer/pré-filtro", "Retrolavagem"];

function Visita() {
  const v = Route.useLoaderData();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string[]>([]);
  const [photos, setPhotos] = useState<{ antes?: string; depois?: string }>({});
  const ok = (k: string, min: number, max: number) => { const n = parseFloat(vals[k]); return isNaN(n) ? null : n >= min && n <= max; };
  const ready = photos.antes && photos.depois;

  const summary = [
    `*Piscivel – Relatório de Visita*`, `Cliente: ${v.client}`, `Data: ${new Date().toLocaleDateString("pt-BR")}`, ``,
    `*Parâmetros da água*`, ...params.map((p) => `• ${p.label}: ${vals[p.key] || "-"} ${p.unit} ${ok(p.key, p.min, p.max) ? "✅" : ok(p.key, p.min, p.max) === false ? "⚠️" : ""}`),
    ``, `*Produtos aplicados*`, ...(Object.entries(used).filter(([, q]) => q).map(([c, q]) => `• ${c}: ${q}`)), ``,
    `*Serviços realizados*`, ...done.map((t) => `✔ ${t}`), ``, `Sua piscina está cristalina! 💧`,
  ].join("\n");

  const card = "glass p-5 space-y-3";
  return (
    <div className="max-w-lg mx-auto p-5 pb-28 space-y-4">
      <Link to="/tecnico" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Voltar</Link>
      <div><h1 className="text-2xl font-bold">{v.client}</h1><p className="text-sm text-muted-foreground">{v.pool} · {v.volume} m³</p></div>

      <section className={card}>
        <h2 className="font-semibold">Parâmetros da água</h2>
        <div className="grid grid-cols-2 gap-3">
          {params.map((p) => { const s = ok(p.key, p.min, p.max); return (
            <label key={p.key} className={`rounded-xl border-2 p-3 bg-ice ${s === true ? "border-sky" : s === false ? "border-petrol" : "border-transparent"}`}>
              <div className="text-xs text-muted-foreground">{p.label}</div>
              <input inputMode="decimal" type="number" step={p.step} value={vals[p.key] ?? ""} onChange={(e) => setVals({ ...vals, [p.key]: e.target.value })} className="w-full bg-transparent text-xl font-bold outline-none" placeholder="—" />
              <div className={`text-[11px] font-medium ${s === false ? "text-petrol" : "text-sky"}`}>{s === null ? `Ideal ${p.min}–${p.max} ${p.unit}` : s ? "Equilibrado" : "Fora do padrão"}</div>
            </label>
          ); })}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Tratamento químico</h2>
        {chems.map((c) => (
          <div key={c} className="flex items-center gap-3"><span className="flex-1 text-sm">{c}</span>
            <input value={used[c] ?? ""} onChange={(e) => setUsed({ ...used, [c]: e.target.value })} placeholder="qtd." className="w-24 rounded-lg border bg-ice px-3 py-1.5 text-sm" /></div>
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
        <h2 className="font-semibold">Fotos <span className="text-xs text-muted-foreground font-normal">(obrigatórias)</span></h2>
        <div className="grid grid-cols-2 gap-3">
          {(["antes", "depois"] as const).map((k) => (
            <label key={k} className="aspect-square rounded-xl border-2 border-dashed bg-ice grid place-items-center overflow-hidden cursor-pointer">
              {photos[k] ? <img src={photos[k]} alt={k} className="size-full object-cover" /> : <div className="text-center text-sm text-muted-foreground"><Camera className="size-6 mx-auto mb-1 text-sky" />{k === "antes" ? "Antes" : "Depois"}</div>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotos({ ...photos, [k]: URL.createObjectURL(f) }); }} />
            </label>
          ))}
        </div>
      </section>

      <div className="fixed bottom-0 inset-x-0 p-4 glass rounded-none">
        <a aria-disabled={!ready} href={ready ? `https://wa.me/${v.phone}?text=${encodeURIComponent(summary)}` : undefined} target="_blank" rel="noreferrer"
          className={`btn-primary max-w-lg mx-auto py-3.5 flex items-center justify-center gap-2 ${ready ? "" : "opacity-50 pointer-events-none"}`}>
          <MessageCircle className="size-5" />{ready ? "Encerrar e enviar no WhatsApp" : "Adicione as fotos para encerrar"}
        </a>
      </div>
    </div>
  );
}
