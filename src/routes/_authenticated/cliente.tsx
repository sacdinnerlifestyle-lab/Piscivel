import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { poolLabel } from "@/components/PoolFields";
import { Logo, SignOutButton, Empty, fmtDate, fmtTime } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { requireRole } from "@/lib/guard";
import { meQuery, signedUrl } from "@/lib/session";
import { params, inRange, type ParamKey } from "@/lib/mock";
import { isRainVisit, visitNoteLabel } from "@/lib/rain";
import { CalendarClock, CheckCircle2, AlertTriangle, CloudRain } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cliente")({
  beforeLoad: ({ context }) => requireRole(context.queryClient, ["cliente"]),
  head: () => ({ meta: [{ title: "Minha piscina — Piscivel" }, { name: "description", content: "Acompanhe semanalmente o tratamento da sua piscina." }, { property: "og:title", content: "Minha piscina — Piscivel" }, { property: "og:description", content: "Acompanhe semanalmente o tratamento da sua piscina." }] }),
  component: Cliente,
});

function Cliente() {
  const { data: me } = useQuery(meQuery);
  const { data } = useQuery({
    queryKey: ["client-portal", me?.profile?.client_id],
    enabled: !!me?.profile?.client_id,
    queryFn: async () => {
      const cid = me!.profile!.client_id!;
      const [{ data: client }, { data: next }, { data: reports }, { data: rainy }] = await Promise.all([
        supabase.from("clients").select("name, swimming_pools(id, name, address, coating, volume_m3, dimensions)").eq("id", cid).order("created_at", { referencedTable: "swimming_pools" }).maybeSingle(),
        supabase.from("schedules").select("scheduled_at, pool_id, skip_note").neq("status", "concluida").gte("scheduled_at", new Date().toISOString()).order("scheduled_at"),
        supabase.from("visit_reports").select("*, schedule:schedules(scheduled_at, visited_at, pool_id, technician:profiles(full_name))").order("created_at", { ascending: false }).limit(60),
        supabase.from("schedules").select("id, scheduled_at, visited_at, skip_note, pool_id").not("skip_note", "is", null).order("scheduled_at", { ascending: false }).limit(40),
      ]);
      const withPhotos = await Promise.all((reports ?? []).map(async (r) => ({ ...r, before: await signedUrl(r.photo_before), after: await signedUrl(r.photo_after), machine: await signedUrl(r.photo_machine) })));
      return { client, next: next ?? [], reports: withPhotos, rainy: rainy ?? [] };
    },
  });

  const pools = data?.client?.swimming_pools ?? [];
  const [sel, setSel] = useState<string | null>(null);
  const pool = pools.find((p) => p.id === sel) ?? pools[0];
  const reports = (data?.reports ?? []).filter((r) => r.schedule?.pool_id === pool?.id).slice(0, 12);
  const rainyVisits = (data?.rainy ?? []).filter((r) => r.pool_id === pool?.id && isRainVisit(r.skip_note)).slice(0, 8);
  const nextVisit = (data?.next ?? []).find((n) => n.pool_id === pool?.id);
  const nextAt = nextVisit?.scheduled_at ?? null;
  const last = reports[0];
  const balanced = last ? params.every((p) => inRange(p.key, last[p.key]) !== false) : null;

  return (
    <div className="max-w-3xl mx-auto min-h-screen p-5 space-y-5">
      <div className="flex justify-between items-center"><Logo /><SignOutButton className="text-muted-foreground" /></div>

      {!me?.profile?.client_id ? <Empty>Sua conta ainda não está vinculada a uma piscina. Fale com a Piscivel.</Empty> : (
        <>
          <div className="bg-deep text-abyss-foreground rounded-2xl p-6">
            <div className="text-sm opacity-75">Olá, {data?.client?.name ?? "…"}</div>
            {pool && <div className="text-2xl font-bold mt-1">{poolLabel(pool, pools.indexOf(pool))}</div>}
            {pool && <div className="text-sm opacity-80 mt-1">{pool.coating} · {pool.dimensions ? `${pool.dimensions} · ` : ""}{pool.volume_m3} m³{pool.address ? ` · ${pool.address}` : ""}</div>}
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              {balanced !== null && <span className="flex items-center gap-2">{balanced ? <CheckCircle2 className="size-4 text-aqua" /> : <AlertTriangle className="size-4 text-aqua" />}{balanced ? "Água equilibrada" : "Em correção"}</span>}
              {nextVisit?.skip_note && <span className="w-full text-xs opacity-90">Aviso do técnico: {visitNoteLabel(nextVisit.skip_note)}</span>}
              <span className="flex items-center gap-2"><CalendarClock className="size-4 text-aqua" />{nextAt ? `Próxima visita: ${fmtDate(nextAt)}` : "Próxima visita a agendar"}</span>
            </div>
          </div>

          {pools.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pools.map((p, i) => (
                <button key={p.id} onClick={() => setSel(p.id)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border ${p.id === pool?.id ? "bg-primary text-primary-foreground" : "bg-ice"}`}>{poolLabel(p, i)}</button>
              ))}
            </div>
          )}

          {rainyVisits.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">Visitas não realizadas por chuva</h2>
              {rainyVisits.map((visit) => (
                <div key={visit.id} className="glass border-sky/50 bg-sky/10 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <CloudRain className="size-4 text-sky" />
                      {fmtDate(visit.visited_at ?? visit.scheduled_at)}
                    </div>
                    <span className="rounded-full bg-sky/20 px-2.5 py-1 text-xs font-semibold text-sky">Não realizada por chuva</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    A visita não foi realizada porque estava chovendo no momento do atendimento. Por isso não houve coleta de parâmetros nem tratamento da água neste dia.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{visitNoteLabel(visit.skip_note)}</p>
                </div>
              ))}
            </section>
          )}

          {reports.length === 0 ? <Empty>Assim que a primeira visita for concluída, o relatório aparece aqui.</Empty> : (
            <>

              <section className="space-y-3">
                <h2 className="font-semibold">Histórico de visitas</h2>
                {reports.map((r) => (
                  <div key={r.id} className="glass border-success/40 bg-success/10 p-5">
                    <div className="flex justify-between items-center"><div className="font-semibold">{fmtDate(r.schedule?.visited_at ?? r.schedule?.scheduled_at ?? r.created_at)}{r.schedule?.visited_at ? ` às ${fmtTime(r.schedule.visited_at)}` : ""}</div><span className="text-xs text-muted-foreground">Técnico: {r.schedule?.technician?.full_name ?? "—"}</span></div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {params.map((p) => { const ok = inRange(p.key, r[p.key]); return (
                        <span key={p.key} className={`text-xs px-2.5 py-1 rounded-full font-medium ${ok === false ? "bg-petrol text-primary-foreground" : "bg-secondary text-abyss"}`}>{p.label}: {r[p.key] ?? "—"}</span>
                      ); })}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
                      <div><div className="text-xs text-muted-foreground mb-1">Serviços</div>{r.tasks.join(" · ") || "—"}</div>
                      <div><div className="text-xs text-muted-foreground mb-1">Produtos aplicados</div>{Object.entries((r.chemicals ?? {}) as Record<string, string>).map(([k, q]) => `${k} ${q}`).join(" · ") || "—"}</div>
                    </div>
                    {(r.before || r.after || r.machine) && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                        {r.before && <figure><img src={r.before} alt="Antes" className="rounded-xl aspect-video object-cover w-full" /><figcaption className="text-xs text-muted-foreground mt-1">Antes</figcaption></figure>}
                        {r.after && <figure><img src={r.after} alt="Depois" className="rounded-xl aspect-video object-cover w-full" /><figcaption className="text-xs text-muted-foreground mt-1">Depois</figcaption></figure>}
                        {r.machine && <figure><img src={r.machine} alt="Casa de Máquinas" className="rounded-xl aspect-video object-cover w-full" /><figcaption className="text-xs text-muted-foreground mt-1">Casa de Máquinas</figcaption></figure>}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
