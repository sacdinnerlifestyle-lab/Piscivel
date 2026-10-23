import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Logo, StatusBadge, SignOutButton, Empty, startOfDay, addDays, fmtTime, fmtDate } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/session";
import { isRainVisit, rainNote } from "@/lib/rain";
import { MapPin, Play, LayoutDashboard, CalendarX, CalendarDays, CloudRain } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tecnico/")({
  head: () => ({ meta: [{ title: "Minha rota do dia — Piscivel" }, { name: "description", content: "Visitas do dia do técnico." }, { property: "og:title", content: "Minha rota do dia — Piscivel" }, { property: "og:description", content: "Visitas do dia do técnico." }] }),
  component: Tecnico,
});

function Tecnico() {
  const qc = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const [skipFor, setSkipFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const { data: mine = [] } = useQuery({
    queryKey: ["my-route", me?.user.id],
    enabled: !!me,
    queryFn: async () => (await supabase.from("schedules").select("id, scheduled_at, visited_at, skip_note, original_date, status, pool:swimming_pools(name, address, client:clients(name, address))").eq("technician_id", me!.user.id).gte("scheduled_at", startOfDay().toISOString()).lt("scheduled_at", addDays(startOfDay(), 1).toISOString()).order("created_at")).data ?? [],
  });

  const skip = useMutation({
    mutationFn: async (v: { id: string; scheduled_at: string; original_date: string | null }) => {
      const text = note.trim();
      if (text.length < 3) throw new Error("Escreva o motivo.");
      const next = addDays(new Date(v.scheduled_at), 1);
      const { error } = await supabase.from("schedules").update({
        scheduled_at: next.toISOString(),
        skip_note: `${text.slice(0, 300)} (não foi possível em ${fmtDate(v.scheduled_at)}, remarcada para ${fmtDate(next.toISOString())})`,
        original_date: v.original_date ?? v.scheduled_at,
        status: "agendada",
      }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Visita remarcada para amanhã"); setSkipFor(null); setNote(""); qc.invalidateQueries({ queryKey: ["my-route"] }); },
    onError: (e) => toast.error(e.message),
  });

  const rain = useMutation({
    mutationFn: async (v: { id: string; note: string | null }) => {
      const { error } = await supabase
        .from("schedules")
        .update({ skip_note: v.note, status: v.note ? "concluida" : "agendada" })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_result, v) => {
      toast.success(v.note ? "Visita marcada como não realizada por chuva" : "Marcação de chuva removida");
      qc.invalidateQueries({ queryKey: ["my-route"] });
    },
    onError: (e) => toast.error(e.message),
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
      <Link to="/tecnico/semana" className="glass mt-4 py-3 flex items-center justify-center gap-2 font-semibold text-primary"><CalendarDays className="size-4" />Ver minhas visitas da semana</Link>
      <div className="space-y-3 mt-5">
        {mine.length === 0 && <Empty>Nenhuma visita para hoje.</Empty>}
        {mine.map((v) => {
          const addr = v.pool?.address || v.pool?.client?.address;
          return (
            <div key={v.id} className={`glass p-4 ${v.status === "concluida" ? "border-success/40 bg-success/10" : ""}`}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  {v.visited_at && <div className="text-sm font-mono text-sky font-semibold">{fmtTime(v.visited_at)}</div>}
                  <div className="font-semibold">{v.pool?.client?.name}</div>
                  {v.pool?.name && <div className="text-xs text-muted-foreground">{v.pool.name}</div>}
                </div>
                <StatusBadge s={v.status} />
              </div>
              {addr && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`} className="text-sm text-muted-foreground flex items-center gap-1.5 mt-2"><MapPin className="size-3.5" />{addr}</a>}
              {isRainVisit(v.skip_note) ? (
                <p className="text-xs text-sky font-semibold mt-2 flex items-center gap-1.5"><CloudRain className="size-3.5" />Não realizada por chuva</p>
              ) : v.skip_note ? (
                <p className="text-xs text-petrol mt-2">Remarcada: {v.skip_note}</p>
              ) : null}
              {(v.status !== "concluida" || isRainVisit(v.skip_note)) && (
                <>
                  <Link to="/tecnico/visita/$id" params={{ id: v.id }} className="btn-primary w-full py-3 mt-4 flex items-center justify-center gap-2"><Play className="size-4" />{v.status === "em_andamento" ? "Continuar Atendimento" : "Iniciar Atendimento"}</Link>
                  {skipFor === v.id ? (
                    <div className="mt-3 space-y-2">
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} placeholder="Por que não foi possível ir hoje? (o cliente verá este aviso)" className="w-full rounded-lg border bg-ice px-3 py-2 text-sm" />
                      <div className="flex gap-2">
                        <button disabled={skip.isPending} onClick={() => skip.mutate(v)} className="btn-primary flex-1 py-2.5 text-sm">Remarcar para amanhã</button>
                        <button onClick={() => { setSkipFor(null); setNote(""); }} className="px-3 text-sm text-muted-foreground">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setSkipFor(v.id); setNote(""); }} className="w-full mt-2 py-2.5 text-sm text-muted-foreground flex items-center justify-center gap-2"><CalendarX className="size-4" />Não consegui ir hoje</button>
                  )}
                  <button
                    onClick={() => rain.mutate({ id: v.id, note: isRainVisit(v.skip_note) ? null : rainNote(new Date()) })}
                    disabled={rain.isPending}
                    className={`w-full mt-2 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 border rounded-lg text-sky disabled:opacity-60 ${isRainVisit(v.skip_note) ? "border-sky bg-sky/10" : ""}`}
                  >
                    <CloudRain className="size-4" />
                    {isRainVisit(v.skip_note) ? "Desfazer chuva" : "Chuva"}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
