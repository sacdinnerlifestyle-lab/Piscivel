import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  Eye,
  Pencil,
  X,
} from "lucide-react";
import { AdminShell, Empty, StatusBadge, addDays, fmtTime, startOfDay } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/visit-datetime";

const reportPhotoFields = [
  { key: "photo_before", label: "Antes" },
  { key: "photo_after", label: "Depois" },
  { key: "photo_machine", label: "Casa de máquinas" },
  { key: "photo_note", label: "Observação" },
] as const;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function chemicalEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).filter(([, quantity]) => quantity !== null && quantity !== "");
}

function startOfWeek(date = new Date()) {
  const day = startOfDay(date);
  const weekday = day.getDay();
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

function shortDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export const Route = createFileRoute("/_authenticated/admin/visitas")({
  head: () => ({
    meta: [
      { title: "Visitas — Piscivel" },
      { name: "description", content: "Quadro semanal das visitas realizadas, pendentes e atrasadas." },
      { property: "og:title", content: "Visitas — Piscivel" },
      { property: "og:description", content: "Quadro semanal da operação." },
    ],
  }),
  component: Visitas,
});

function Visitas() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const weekEnd = addDays(weekStart, 7);
  const weekKey = localDateKey(weekStart);

  const { data: visits = [], isLoading, isError } = useQuery({
    queryKey: ["admin-visits", weekKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, scheduled_at, visited_at, status, skip_note, technician_id, technician:profiles(full_name), pool:swimming_pools(name, address, client:clients(name, phone))")
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const [selectedVisit, setSelectedVisit] = useState<(typeof visits)[number] | null>(null);

  const {
    data: reportView,
    isLoading: reportLoading,
    isError: reportIsError,
  } = useQuery({
    queryKey: ["visit-report", selectedVisit?.id],
    enabled: !!selectedVisit,
    queryFn: async () => {
      if (!selectedVisit) return null;

      const { data, error } = await supabase
        .from("visit_reports")
        .select("id, schedule_id, technician_id, ph, free_chlorine, alkalinity, cyanuric_acid, chemicals, tasks, photo_before, photo_after, notes, created_at, temperature, calcium_hardness, photo_machine, photo_note")
        .eq("schedule_id", selectedVisit.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const photoUrls: Record<string, string> = {};
      for (const { key } of reportPhotoFields) {
        const path = data[key];
        if (!path) continue;

        const { data: signedPhoto } = await supabase.storage
          .from("visit-photos")
          .createSignedUrl(path, 60 * 60);

        if (signedPhoto?.signedUrl) photoUrls[key] = signedPhoto.signedUrl;
      }

      return { report: data, photoUrls };
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
  const isOverdue = (visit: (typeof visits)[number]) =>
    !isFinished(visit) && new Date(visit.scheduled_at).getTime() < Date.now();

  const finishedCount = visits.filter(isFinished).length;
  const overdueCount = visits.filter(isOverdue).length;
  const pendingCount = visits.length - finishedCount - overdueCount;

  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const todayKey = localDateKey(startOfDay());

  const currentWeekStart = startOfWeek();
  const weekDiff = Math.round((weekStart.getTime() - currentWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const weekLabel =
    weekDiff === 0
      ? "Semana atual"
      : weekDiff === -1
        ? "Semana passada"
        : weekDiff === 1
          ? "Próxima semana"
          : weekDiff < 0
            ? `${Math.abs(weekDiff)} semanas atrás`
            : `Em ${weekDiff} semanas`;

  const report = reportView?.report;
  const reportTasks = report && Array.isArray(report.tasks)
    ? report.tasks.filter((task): task is string => typeof task === "string")
    : [];
  const reportChemicals = report ? chemicalEntries(report.chemicals) : [];
  const reportPhotos = reportView?.report
    ? reportPhotoFields.filter(({ key }) => Boolean(reportView.photoUrls[key]))
    : [];

  const stats = [
    { label: "Visitas na semana", value: visits.length, icon: ClipboardList, tone: "text-sky" },
    { label: "Feitas", value: finishedCount, icon: CheckCircle2, tone: "text-success" },
    { label: "Não feitas", value: pendingCount, icon: Clock3, tone: "text-primary" },
    { label: "Atrasadas", value: overdueCount, icon: CircleAlert, tone: "text-destructive" },
  ];

  return (
    <AdminShell title="Visitas">
      <div className="glass flex w-full min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Semana anterior"
            className="grid size-9 place-items-center rounded-lg border bg-background transition hover:bg-secondary"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground">
              {shortDate(weekStart)} a {shortDate(addDays(weekStart, 6))}
            </div>
            <div className="text-xs text-muted-foreground">{weekLabel}</div>
          </div>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Próxima semana"
            className="grid size-9 place-items-center rounded-lg border bg-background transition hover:bg-secondary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <label htmlFor="week-picker" className="text-xs font-semibold text-muted-foreground sm:whitespace-nowrap">
            Ver semana de
          </label>
          <input
            id="week-picker"
            type="date"
            value={weekKey}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              setWeekStart(startOfWeek(new Date(`${value}T12:00:00`)));
            }}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 ring-ring sm:w-auto"
          />
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek())}
            className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold transition hover:bg-secondary sm:w-auto"
          >
            Semana atual
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.label}
            className={`glass p-4 ${item.label === "Atrasadas" && item.value > 0 ? "border-2 border-destructive/30" : ""}`}
          >
            <item.icon className={`size-5 ${item.tone}`} />
            <div className={`mt-3 text-2xl font-bold ${item.label === "Atrasadas" && item.value > 0 ? "text-destructive" : ""}`}>
              {item.value}
            </div>
            <div className="text-sm font-medium">{item.label}</div>
          </div>
        ))}
      </div>

      {isLoading && <div className="mt-6"><Empty>Carregando visitas…</Empty></div>}
      {isError && <div className="mt-6"><Empty>Não foi possível carregar as visitas. Tente novamente.</Empty></div>}

      {!isLoading && !isError && (
        <div className="mt-6 grid w-full min-w-0 grid-flow-col auto-cols-[minmax(260px,85vw)] snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 sm:auto-cols-[minmax(280px,1fr)] md:grid-flow-row md:auto-cols-auto md:grid-cols-2 md:overflow-visible md:snap-none lg:grid-cols-4 xl:grid-cols-7">
          {days.map((day) => {
            const key = localDateKey(day);
            const dayVisits = visits.filter((visit) => localDateKey(new Date(visit.scheduled_at)) === key);
            const dayOverdue = dayVisits.filter(isOverdue).length;
            const isToday = key === todayKey;

            return (
              <section
                key={key}
                className={`min-w-0 snap-start rounded-2xl border bg-secondary/30 p-2.5 ${isToday ? "ring-2 ring-primary/40" : ""}`}
              >
                <header className="px-1 pb-2">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-primary" : "text-foreground"}`}>
                      {day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">{shortDate(day)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                    <span>{dayVisits.length} visita{dayVisits.length === 1 ? "" : "s"}</span>
                    {dayOverdue > 0 && (
                      <span className="font-semibold text-destructive">
                        · {dayOverdue} atrasada{dayOverdue === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </header>

                <div className="space-y-2">
                  {dayVisits.length === 0 && (
                    <p className="rounded-xl border border-dashed px-2 py-6 text-center text-[11px] text-muted-foreground">
                      Sem visitas
                    </p>
                  )}

                  {dayVisits.map((visit) => {
                    const finished = isFinished(visit);
                    const overdue = isOverdue(visit);

                    return (
                      <article
                        key={visit.id}
                        className={`min-w-0 rounded-xl border p-3 shadow-sm ${overdue ? "border-destructive/60 bg-destructive/10" : finished ? "border-success/40 bg-card" : "bg-card"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-mono text-xs font-semibold ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                            {fmtTime(visit.scheduled_at)}
                          </span>
                          <StatusBadge s={visit.status} />
                        </div>
                        <div className="mt-2 break-words text-sm font-semibold leading-snug">
                          {visit.pool?.client?.name ?? "Cliente não informado"}
                        </div>
                        {visit.pool?.name && <div className="break-words text-xs text-muted-foreground">{visit.pool.name}</div>}
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {visit.technician?.full_name ?? "Sem técnico"}
                        </div>
                        {finished && visit.visited_at && (
                          <div className="mt-1 text-[11px] font-medium text-success">
                            Realizada às {fmtTime(visit.visited_at)}
                          </div>
                        )}
                        {overdue && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-destructive">
                            <CircleAlert className="size-3" />
                            Atrasada — não concluída
                          </div>
                        )}
                        {visit.skip_note && (
                          <div className="mt-1 text-[11px] text-petrol">Obs.: {visit.skip_note}</div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedVisit(visit)}
                            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-background px-2 py-1.5 text-[11px] font-semibold text-primary transition hover:bg-primary/10"
                            title="Visualizar relatório"
                          >
                            <Eye className="size-3" />
                            Relatório
                          </button>
                          {overdue && (
                            <Link
                              to="/tecnico/visita/$id"
                              params={{ id: visit.id }}
                              className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2 py-1.5 text-[11px] font-semibold text-destructive-foreground transition hover:opacity-90"
                            >
                              <Pencil className="size-3" />
                              Editar
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && visits.length === 0 && (
        <div className="mt-4">
          <Empty>Nenhuma visita agendada nesta semana.</Empty>
        </div>
      )}

      {selectedVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visit-report-title"
          onClick={() => setSelectedVisit(null)}
        >
          <div
            className="flex min-h-0 max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:max-h-[92vh]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 id="visit-report-title" className="truncate text-xl font-bold text-foreground">Relatório da visita</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {selectedVisit.pool?.client?.name ?? "Cliente não informado"}
                  {selectedVisit.pool?.name ? ` · ${selectedVisit.pool.name}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVisit(null)}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Fechar relatório"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
              {reportLoading && <Empty>Carregando relatório…</Empty>}
              {reportIsError && <Empty>Não foi possível carregar o relatório desta visita.</Empty>}
              {!reportLoading && !reportIsError && !report && (
                <Empty>Esta visita ainda não possui um relatório preenchido.</Empty>
              )}

              {!reportLoading && !reportIsError && report && (
                <div className="space-y-6">
                  <section className="grid min-w-0 gap-3 rounded-xl border bg-secondary/20 p-3 sm:gap-4 sm:p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</div>
                      <div className="mt-1 font-medium">{selectedVisit.pool?.client?.name ?? "Não informado"}</div>
                      {selectedVisit.pool?.client?.phone && <div className="text-sm text-muted-foreground">{selectedVisit.pool.client.phone}</div>}
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Piscina</div>
                      <div className="mt-1 font-medium">{selectedVisit.pool?.name ?? "Não informada"}</div>
                      {selectedVisit.pool?.address && <div className="text-sm text-muted-foreground">{selectedVisit.pool.address}</div>}
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Técnico</div>
                      <div className="mt-1 font-medium">{selectedVisit.technician?.full_name ?? "Não informado"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</div>
                      <div className="mt-2"><StatusBadge s={selectedVisit.status} /></div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agendada para</div>
                      <div className="mt-1 font-medium">{formatDateTime(selectedVisit.scheduled_at)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Realizada em</div>
                      <div className="mt-1 font-medium">{formatDateTime(selectedVisit.visited_at)}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relatório criado em</div>
                      <div className="mt-1 font-medium">{formatDateTime(report.created_at)}</div>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-3 text-lg font-semibold">Parâmetros da água</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
                      {[
                        { label: "pH", value: report.ph },
                        { label: "Cloro livre", value: report.free_chlorine },
                        { label: "Alcalinidade", value: report.alkalinity },
                        { label: "Ácido cianúrico", value: report.cyanuric_acid },
                        { label: "Dureza cálcica", value: report.calcium_hardness },
                        { label: "Temperatura", value: report.temperature },
                      ].map((metric) => (
                        <div key={metric.label} className="rounded-xl border bg-card p-3">
                          <div className="text-xs text-muted-foreground">{metric.label}</div>
                          <div className="mt-1 text-lg font-bold">{metric.value ?? "—"}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-3 text-lg font-semibold">Produtos aplicados</h3>
                    {reportChemicals.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {reportChemicals.map(([name, quantity]) => (
                          <div key={name} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm">
                            <span className="font-medium">{name}</span>
                            <span className="text-muted-foreground">{String(quantity)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum produto registrado.</p>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-3 text-lg font-semibold">Serviços realizados</h3>
                    {reportTasks.length > 0 ? (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {reportTasks.map((task) => (
                          <li key={task} className="rounded-lg border bg-card px-4 py-3 text-sm">✓ {task}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum serviço registrado.</p>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-3 text-lg font-semibold">Observações</h3>
                    <p className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                      {report.notes?.trim() || "Nenhuma observação registrada."}
                    </p>
                  </section>

                  <section>
                    <h3 className="mb-3 text-lg font-semibold">Fotos da visita</h3>
                    {reportPhotos.length > 0 ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {reportPhotos.map(({ key, label }) => (
                          <figure key={key} className="overflow-hidden rounded-xl border bg-card">
                            <img src={reportView.photoUrls[key]} alt={`Foto ${label.toLowerCase()} da visita`} className="aspect-video w-full object-cover" />
                            <figcaption className="px-4 py-3 text-sm font-medium">{label}</figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma foto disponível.</p>
                    )}
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
