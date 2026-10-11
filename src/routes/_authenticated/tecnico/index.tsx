import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Logo, StatusBadge, SignOutButton, Empty, startOfDay, addDays, fmtTime } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { MapPin, Play, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tecnico/")({
  head: () => ({ meta: [{ title: "Minha rota do dia — Piscivel" }, { name: "description", content: "Visitas do dia do técnico." }, { property: "og:title", content: "Minha rota do dia — Piscivel" }, { property: "og:description", content: "Visitas do dia do técnico." }] }),
  component: Tecnico,
});

function Tecnico() {
  const { data: me } = useQuery(meQuery);
  const { data: mine = [] } = useQuery({
    queryKey: ["my-route", me?.user.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("schedules").select("id, scheduled_at, status, pool:swimming_pools(client:clients(name, address))").eq("technician_id", me!.user.id).gte("scheduled_at", startOfDay().toISOString()).lt("scheduled_at", addDays(startOfDay(), 1).toISOString()).order("scheduled_at")).data ?? [],
  });
  const done = mine.filter((v) => v.status === "concluida").length;
  return (
    <div className="max-w-lg mx-auto min-h-screen p-5">
      <div className="flex justify-between items-center">
        <Logo />
        <div className="flex gap-4 items-center text-muted-foreground">
          {me?.roles.includes("admin") && <Link to="/admin" aria-label="Painel"><LayoutDashboard className="size-5" /></Link>}
          <SignOutButton />
        </div>
      </div>
      <div className="bg-deep text-abyss-foreground rounded-2xl p-5 mt-6">
        <div className="text-sm opacity-75">Olá, {me?.profile?.full_name?.split(" ")[0] || "técnico"}</div>
        <div className="text-2xl font-bold">{mine.length} visitas hoje</div>
        <div className="h-2 bg-abyss-foreground/20 rounded-full mt-4"><div className="h-full bg-aqua rounded-full" style={{ width: `${mine.length ? (done / mine.length) * 100 : 0}%` }} /></div>
      </div>
      <div className="space-y-3 mt-5">
        {mine.length === 0 && <Empty>Nenhuma visita para hoje.</Empty>}
        {mine.map((v) => (
          <div key={v.id} className="glass p-4">
            <div className="flex justify-between items-start gap-2">
              <div><div className="text-sm font-mono text-sky font-semibold">{fmtTime(v.scheduled_at)}</div><div className="font-semibold">{v.pool?.client?.name}</div></div>
              <StatusBadge s={v.status} />
            </div>
            {v.pool?.client?.address && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(v.pool.client.address)}`} className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2"><MapPin className="size-3.5" />{v.pool.client.address}</a>}
            {v.status !== "concluida" && (
              <Link to="/tecnico/visita/$id" params={{ id: v.id }} className="btn-primary w-full py-3 mt-4 flex items-center justify-center gap-2"><Play className="size-4" />{v.status === "em_andamento" ? "Continuar Atendimento" : "Iniciar Atendimento"}</Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
