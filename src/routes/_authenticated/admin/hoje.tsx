import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock3, Users } from "lucide-react";
import { AdminShell, Empty, StatusBadge, addDays, fmtTime, inputCls, startOfDay } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { techsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin/hoje")({
  head: () => ({
    meta: [
      { title: "Visitas de hoje — Piscivel" },
      { name: "description", content: "Acompanhe as visitas que devem ser realizadas hoje." },
      { property: "og:title", content: "Visitas de hoje — Piscivel" },
      { property: "og:description", content: "Acompanhe as visitas da operação no dia atual." },
    ],
  }),
  component: Hoje,
});

function Hoje() {
  const queryClient = useQueryClient();
  const [selectedTechnician, setSelectedTechnician] = useState("all");
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const todayKey = today.toISOString().slice(0, 10);

  const { data: team = [] } = useQuery(techsQuery);
  const {
    data: visits = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-today-visits", todayKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, scheduled_at, visited_at, status, technician_id, technician:profiles(full_name), pool:swimming_pools(name, client:clients(name))")
        .gte("scheduled_at", today.toISOString())
        .lt("scheduled_at", tomorrow.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-today-visits")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-today-visits"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredVisits = selectedTechnician === "all"
    ? visits
    : visits.filter((visit) => visit.technician_id === selectedTechnician);
  const finishedVisits = filteredVisits.filter((visit) => visit.status === "concluida");
  const pendingVisits = filteredVisits.filter((visit) => visit.status !== "concluida");
  const technicians = team.filter((member) => member.roles.includes("tecnico"));

  return (
    <AdminShell title="Visitas de hoje">
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <CalendarCheck className="size-5" />
            <span className="text-sm font-semibold">Operação do dia</span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-foreground">
            {today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Veja somente as visitas programadas para hoje.</p>
        </div>

        <label className="w-full sm:max-w-xs" htmlFor="technician-filter">
          <span className="mb-1.5 block text-sm font-semibold text-foreground">Filtrar por técnico</span>
          <select
            id="technician-filter"
            value={selectedTechnician}
            onChange={(event) => setSelectedTechnician(event.target.value)}
            className={inputCls}
          >
            <option value="all">Todos os técnicos</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.full_name || technician.email || "Técnico sem nome"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass p-4">
          <CalendarCheck className="size-5 text-sky" />
          <div className="mt-3 text-2xl font-bold">{filteredVisits.length}</div>
          <div className="text-sm font-medium">Visitas de hoje</div>
        </div>
        <div className="glass p-4">
          <Clock3 className="size-5 text-primary" />
          <div className="mt-3 text-2xl font-bold">{pendingVisits.length}</div>
          <div className="text-sm font-medium">A realizar</div>
        </div>
        <div className="glass p-4">
          <CheckCircle2 className="size-5 text-success" />
          <div className="mt-3 text-2xl font-bold">{finishedVisits.length}</div>
          <div className="text-sm font-medium">Concluídas</div>
        </div>
      </div>

      {isLoading && <Empty>Carregando visitas de hoje…</Empty>}
      {isError && <Empty>Não foi possível carregar as visitas de hoje. Tente novamente.</Empty>}

      {!isLoading && !isError && filteredVisits.length === 0 && (
        <Empty>
          <div className="flex flex-col items-center gap-2">
            <Users className="size-8 text-muted-foreground/60" />
            <span>{selectedTechnician === "all" ? "Nenhuma visita agendada para hoje." : "Nenhuma visita deste técnico está agendada para hoje."}</span>
          </div>
        </Empty>
      )}

      {!isLoading && !isError && filteredVisits.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVisits.map((visit) => (
            <article key={visit.id} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Clock3 className="size-4" />
                    {fmtTime(visit.scheduled_at)}
                  </div>
                  <h3 className="mt-3 text-base font-bold text-foreground">
                    {visit.pool?.client?.name ?? "Cliente não informado"}
                  </h3>
                  {visit.pool?.name && <p className="mt-1 text-sm text-muted-foreground">{visit.pool.name}</p>}
                </div>
                <StatusBadge s={visit.status} />
              </div>

              <div className="mt-5 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
                <Users className="size-4 shrink-0" />
                <span>{visit.technician?.full_name ?? "Sem técnico definido"}</span>
              </div>

              {visit.visited_at && (
                <p className="mt-2 text-xs font-medium text-success">
                  Realizada às {fmtTime(visit.visited_at)}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
