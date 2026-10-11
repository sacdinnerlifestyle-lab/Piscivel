import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Logo, SignOutButton, Empty, fmtDate, fmtTime } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { requireRole } from "@/lib/guard";
import { meQuery, signedUrl } from "@/lib/session";
import { params, inRange, type ParamKey } from "@/lib/mock";
import { CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";

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
      const [{ data: client }, { data: next }, { data: reports }] = await Promise.all([
        supabase.from("clients").select("name, swimming_pools(coating, volume_m3)").eq("id", cid).maybeSingle(),
        supabase.from("schedules").select("scheduled_at").neq("status", "concluida").gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1),
        supabase.from("visit_reports").select("*, schedule:schedules(scheduled_at, technician:profiles(full_name))").order("created_at", { ascending: false }).limit(12),
      ]);
      const withPhotos = await Promise.all((reports ?? []).map(async (r) => ({ ...r, before: await signedUrl(r.photo_before), after: await signedUrl(r.photo_after) })));
      return { client, next: next?.[0]?.scheduled_at ?? null, reports: withPhotos };
    },
  });

  const reports = data?.reports ?? [];
  const last = reports[0];
  const balanced = last ? params.every((p) => inRange(p.key, last[p.key]) !== false) : null;
  const pool = data?.client?.swimming_pools[0];

  return (
    <div className="max-w-3xl mx-auto min-h-screen p-5 space-y-5">
      <div className="flex justify-between items-center"><Logo /><SignOutButton className="text-muted-foreground" /></div>

      {!me?.profile?.client_id ? <Empty>Sua conta ainda não está vinculada a uma piscina. Fale com a Piscivel.</Empty> : (
        <>
          <div className="bg-deep text-abyss-foreground rounded-2xl p-6">
            <div className="text-sm opacity-75">Olá, {data?.client?.name ?? "…"}</div>
            {pool && <div className="text-2xl font-bold mt-1">Piscina de {pool.coating.toLowerCase()} · {pool.volume_m3} m³</div>}
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              {balanced !== null && <span className="flex items-center gap-2">{balanced ? <CheckCircle2 className="size-4 text-aqua" /> : <AlertTriangle className="size-4 text-aqua" />}{balanced ? "Água equilibrada" : "Em correção"}</span>}
              <span className="flex items-center gap-2"><CalendarClock className="size-4 text-aqua" />{data?.next ? `Próxima visita: ${fmtDate(data.next)} às ${fmtTime(data.next)}` : "Próxima visita a agendar"}</span>
            </div>
          </div>

          {reports.length === 0 ? <Empty>Assim que a primeira visita for concluída, o relatório aparece aqui.</Empty> : (
            <>
              <section className="glass p-5">
                <h2 className="font-semibold mb-4">Evolução semanal</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {params.map((p) => (
                    <div key={p.key} className="bg-ice rounded-xl p-3 border">
                      <div className="text-xs text-muted-foreground">{p.label}</div>
                      <div className="text-xl font-bold">{last?.[p.key] ?? "—"} <span className="text-xs font-normal">{p.unit}</span></div>
                      <div className="flex items-end gap-1 h-10 mt-2">
                        {[...reports].reverse().map((r, i) => { const val = Number(r[p.key] ?? 0); return (
                          <div key={i} className={`flex-1 rounded-sm ${inRange(p.key as ParamKey, r[p.key]) === false ? "bg-petrol" : "bg-sky"}`} style={{ height: `${Math.max(5, Math.min(100, (val / (p.max * 1.2)) * 100))}%` }} />
                        ); })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="font-semibold">Histórico de visitas</h2>
                {reports.map((r) => (
                  <div key={r.id} className="glass p-5">
                    <div className="flex justify-between items-center"><div className="font-semibold">{fmtDate(r.schedule?.scheduled_at ?? r.created_at)}</div><span className="text-xs text-muted-foreground">Técnico: {r.schedule?.technician?.full_name ?? "—"}</span></div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {params.map((p) => { const ok = inRange(p.key, r[p.key]); return (
                        <span key={p.key} className={`text-xs px-2.5 py-1 rounded-full font-medium ${ok === false ? "bg-petrol text-primary-foreground" : "bg-secondary text-abyss"}`}>{p.label}: {r[p.key] ?? "—"}</span>
                      ); })}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
                      <div><div className="text-xs text-muted-foreground mb-1">Serviços</div>{r.tasks.join(" · ") || "—"}</div>
                      <div><div className="text-xs text-muted-foreground mb-1">Produtos aplicados</div>{Object.entries((r.chemicals ?? {}) as Record<string, string>).map(([k, q]) => `${k} ${q}`).join(" · ") || "—"}</div>
                    </div>
                    {(r.before || r.after) && (
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        {r.before && <figure><img src={r.before} alt="Antes" className="rounded-xl aspect-video object-cover w-full" /><figcaption className="text-xs text-muted-foreground mt-1">Antes</figcaption></figure>}
                        {r.after && <figure><img src={r.after} alt="Depois" className="rounded-xl aspect-video object-cover w-full" /><figcaption className="text-xs text-muted-foreground mt-1">Depois</figcaption></figure>}
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
