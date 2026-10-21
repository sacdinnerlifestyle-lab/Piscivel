import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CircleAlert, Clock3, Pencil, CheckCircle2, ClipboardList, Eye, X } from "lucide-react";
import { AdminShell, Empty, StatusBadge, addDays, fmtTime, startOfDay } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { localDateKey } from "@/lib/visit-datetime";

type VisitFilter = "todas" | "feitas" | "nao-feitas" | "atrasadas";

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
  const [selectedVisit, setSelectedVisit] = useState<(typeof visits)[number] | null>(null);
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

  const report = reportView?.report;
  const reportTasks = report && Array.isArray(report.tasks)
    ? report.tasks.filter((task): task is string => typeof task === "string")
    : [];
  const reportChemicals = report ? chemicalEntries(report.chemicals) : [];
  const reportPhotos = reportView?.report
    ? reportPhotoFields.filter(({ key }) => Boolean(reportView.photoUrls[key]))
    : [];

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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedVisit(visit)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-background px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10"
                        title="Visualizar relatório"
                      >
                        <Eye className="size-3.5" />
                        <span className="hidden sm:inline">Relatório</span>
                      </button>
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
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {selectedVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visit-report-title"
          onClick={() => setSelectedVisit(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
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

            <div className="overflow-y-auto p-5 sm:p-6">
              {reportLoading && <Empty>Carregando relatório…</Empty>}
              {reportIsError && <Empty>Não foi possível carregar o relatório desta visita.</Empty>}
              {!reportLoading && !reportIsError && !report && (
                <Empty>Esta visita ainda não possui um relatório preenchido.</Empty>
              )}

              {!reportLoading && !reportIsError && report && (
                <div className="space-y-6">
                  <section className="grid gap-4 rounded-xl border bg-secondary/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
