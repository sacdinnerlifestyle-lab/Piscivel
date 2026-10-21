import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CircleAlert, Clock3, Pencil, CheckCircle2, ClipboardList } from "lucide-react";
import { AdminShell, Empty, StatusBadge, addDays, fmtTime, startOfDay } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/visit-datetime";

type VisitFilter = "todas" | "feitas" | "nao-feitas" | "atrasadas";

export const Route = createFileRoute("/_authenticated/admin/visitas")({
  head: () => ({
    meta: [
      { title: "Visitas — Piscivel" },
      { name: "description", content: "Acompanhamento das visitas realizadas, pendentes e atrasadas." },
      { property: "og:title", content: "Visitas — Piscivel" },
      { property: "og:description", content: "Acompanhamento das visitas da operação." },
    ],
  }),
  component: Visitas,
});

function Visitas() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<VisitFilter>("todas");
  const start = addDays(startOfDay(), -90);
  const end = addDays(startOfDay(), 60);

  const { data: visits = [], isLoading, isError } = useQuery({
    queryKey: ["admin-visits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, scheduled_at, visited_at, status, skip_note, technician_id, technician:profiles(full_name), pool:swimming_pools(name, address, client:clients(name, phone))")
        .gte("scheduled_at", start.toISOString())
        .lt("scheduled_at", end.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-visits")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-visits"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const isFinished = (visit: (typeof visits)[number]) => visit.status === "concluida";
  const isLate = (visit: (typeof visits)[number]) => !isFinished(visit) && new Date(visit.scheduled_at).getTime() < Date.now();
  const isPending = (visit: (typeof visits)[number]) => !isFinished(visit) && !isLate(visit);

  const finishedCount = visits.filter(isFinished).length;
  const lateCount = visits.filter(isLate).length;
  const pendingCount = visits.filter(isPending).length;

  const filteredVisits = visits.filter((visit) => {
    if (filter === "feitas") return isFinished(visit);
    if (filter === "atrasadas") return isLate(visit);
    if (filter === "nao-feitas") return isPending(visit);
    return true;
  });

  const groupedVisits = filteredVisits.reduce<Record<string, typeof filteredVisits>>((groups, visit) => {
    const day = localDateKey(new Date(visit.scheduled_at));
    if (!groups[day]) groups[day] = [];
    groups[day].push(visit);
    return groups;
  }, {});

  const dayKeys = Object.keys(groupedVisits).sort();
  const todayKey = localDateKey(startOfDay());
  const yesterdayKey = localDateKey(addDays(startOfDay(), -1));

  const dateTitle = (key: string) => {
    if (key === todayKey) return "Hoje";
    if (key === yesterdayKey) return "Ontem";
    return new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const filters: { id: VisitFilter; label: string; count: number }[] = [
    { id: "todas", label: "Todas", count: visits.length },
    { id: "feitas", label: "Feitas", count: finishedCount },
    { id: "nao-feitas", label: "Não feitas", count: pendingCount },
    { id: "atrasadas", label: "Atrasadas", count: lateCount },
  ];

  return (
    <AdminShell title="Visitas">
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Acompanhe as visitas dos últimos 90 dias e dos próximos 60 dias. As visitas atrasadas podem ser preenchidas pelo botão Editar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="glass p-4">
          <ClipboardList className="size-5 text-sky" />
          <div className="mt-3 text-2xl font-bold">{visits.length}</div>
          <div className="text-sm font-medium">Todas as visitas</div>
        </div>
        <div className="glass p-4">
          <CheckCircle2 className="size-5 text-success" />
          <div className="mt-3 text-2xl font-bold">{finishedCount}</div>
          <div className="text-sm font-medium">Feitas</div>
        </div>
        <div className="glass p-4">
          <Clock3 className="size-5 text-primary" />
          <div className="mt-3 text-2xl font-bold">{pendingCount}</div>
          <div className="text-sm font-medium">Não feitas</div>
        </div>
        <div className="glass border-2 border-destructive/30 p-4">
          <CircleAlert className="size-5 text-destructive" />
          <div className="mt-3 text-2xl font-bold text-destructive">{lateCount}</div>
          <div className="text-sm font-medium">Atrasadas</div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar visitas">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${filter === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-secondary"}`}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {isLoading && <Empty>Carregando visitas…</Empty>}
        {isError && <Empty>Não foi possível carregar as visitas. Tente novamente.</Empty>}
        {!isLoading && !isError && dayKeys.length === 0 && <Empty>Nenhuma visita encontrada para este filtro.</Empty>}

        {!isLoading && !isError && dayKeys.map((day) => (
          <section key={day} className="glass overflow-hidden">
            <div className="border-b bg-secondary/40 px-5 py-4">
              <h2 className="font-semibold capitalize text-foreground">{dateTitle(day)}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {groupedVisits[day].length} visita{groupedVisits[day].length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="divide-y">
              {groupedVisits[day].map((visit) => {
                const finished = isFinished(visit);
                const late = isLate(visit);

                return (
                  <div key={visit.id} className={`flex flex-wrap items-center gap-4 px-5 py-4 ${late ? "bg-destructive/5" : ""}`}>
                    <div className={`w-16 shrink-0 text-sm font-mono font-semibold ${late ? "text-destructive" : "text-muted-foreground"}`}>
                      {fmtTime(visit.scheduled_at)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {visit.pool?.client?.name ?? "Cliente não informado"}
                        {visit.pool?.name ? ` · ${visit.pool.name}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {visit.technician?.full_name ?? "Sem técnico"}
                        {visit.pool?.address ? ` · ${visit.pool.address}` : ""}
                      </div>
                      {visit.skip_note && <div className="mt-1 text-xs text-petrol">Observação: {visit.skip_note}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge s={visit.status} />
                      <span className={`hidden text-xs font-semibold sm:inline ${finished ? "text-success" : late ? "text-destructive" : "text-muted-foreground"}`}>
                        {finished ? "Feita" : late ? "Atrasada" : "Não feita"}
                      </span>
                    </div>
                    {finished && visit.visited_at && <span className="text-xs text-muted-foreground">Realizada às {fmtTime(visit.visited_at)}</span>}
                    {late && (
                      <Link
                        to="/tecnico/visita/$id"
                        params={{ id: visit.id }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground transition hover:opacity-90"
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
