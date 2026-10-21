import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty, StatusBadge } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { buildVisitReportPdf } from "@/lib/visit-report";
import { downloadBlob } from "@/lib/daily-report";

type VisitReportVisit = {
  id: string;
  scheduled_at: string;
  visited_at: string | null;
  status: string;
  technician?: { full_name: string | null } | null;
  pool?: {
    name: string | null;
    address: string | null;
    client?: { name: string; phone: string } | null;
  } | null;
};

type ReportRecord = {
  id: string;
  schedule_id: string;
  technician_id: string | null;
  ph: number | null;
  free_chlorine: number | null;
  alkalinity: number | null;
  cyanuric_acid: number | null;
  chemicals: unknown;
  tasks: unknown;
  photo_before: string | null;
  photo_after: string | null;
  notes: string | null;
  created_at: string;
  temperature: number | null;
  calcium_hardness: number | null;
  photo_machine: string | null;
  photo_note: string | null;
};

type PhotoKey = "photo_before" | "photo_after" | "photo_machine" | "photo_note";

const photoFields: { key: PhotoKey; label: string }[] = [
  { key: "photo_before", label: "Antes" },
  { key: "photo_after", label: "Depois" },
  { key: "photo_machine", label: "Casa de máquinas" },
  { key: "photo_note", label: "Observação" },
];

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

export function VisitReportDialog({ visit, onClose }: { visit: VisitReportVisit; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-visit-report", visit.id],
    queryFn: async () => {
      const { data: report, error } = await supabase
        .from("visit_reports")
        .select("id, schedule_id, technician_id, ph, free_chlorine, alkalinity, cyanuric_acid, chemicals, tasks, photo_before, photo_after, notes, created_at, temperature, calcium_hardness, photo_machine, photo_note")
        .eq("schedule_id", visit.id)
        .maybeSingle();

      if (error) throw error;
      if (!report) return null;

      const photoUrls: Partial<Record<PhotoKey, string>> = {};
      for (const { key } of photoFields) {
        const path = report[key];
        if (!path) continue;
        const { data: signedPhoto } = await supabase.storage.from("visit-photos").createSignedUrl(path, 60 * 60);
        if (signedPhoto?.signedUrl) photoUrls[key] = signedPhoto.signedUrl;
      }

      return { report: report as ReportRecord, photoUrls };
    },
  });

  const report = data?.report;
  const reportTasks = report && Array.isArray(report.tasks)
    ? report.tasks.filter((task): task is string => typeof task === "string")
    : [];
  const reportChemicals = report ? chemicalEntries(report.chemicals) : [];
  const reportPhotos = data
    ? photoFields.filter(({ key }) => Boolean(data.photoUrls[key]))
    : [];

  const handleDownload = async () => {
    if (!report || !data) return;
    setDownloading(true);
    try {
      const file = await buildVisitReportPdf(visit, report, data.photoUrls);
      downloadBlob(file.blob, file.filename);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" role="dialog" aria-modal="true" aria-labelledby="dashboard-visit-report-title" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="dashboard-visit-report-title" className="truncate text-xl font-bold text-foreground">Relatório da visita</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {visit.pool?.client?.name ?? "Cliente não informado"}
              {visit.pool?.name ? ` · ${visit.pool.name}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {report && <Button type="button" onClick={handleDownload} disabled={downloading} className="flex items-center gap-2 text-xs sm:text-sm"><Download className="size-4" />{downloading ? "Gerando PDF…" : "Baixar PDF"}</Button>}
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Fechar relatório"><X className="size-5" /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {isLoading && <Empty>Carregando relatório…</Empty>}
          {isError && <Empty>Não foi possível carregar o relatório desta visita.</Empty>}
          {!isLoading && !isError && !report && <Empty>Esta visita ainda não possui um relatório preenchido.</Empty>}

          {!isLoading && !isError && report && data && (
            <div className="space-y-6">
              <section className="grid gap-4 rounded-xl border bg-secondary/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</div><div className="mt-1 font-medium">{visit.pool?.client?.name ?? "Não informado"}</div>{visit.pool?.client?.phone && <div className="text-sm text-muted-foreground">{visit.pool.client.phone}</div>}</div>
                <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Piscina</div><div className="mt-1 font-medium">{visit.pool?.name ?? "Não informada"}</div>{visit.pool?.address && <div className="text-sm text-muted-foreground">{visit.pool.address}</div>}</div>
                <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Técnico</div><div className="mt-1 font-medium">{visit.technician?.full_name ?? "Não informado"}</div></div>
                <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</div><div className="mt-2"><StatusBadge s={visit.status as never} /></div></div>
                <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agendada para</div><div className="mt-1 font-medium">{formatDateTime(visit.scheduled_at)}</div></div>
                <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Realizada em</div><div className="mt-1 font-medium">{formatDateTime(visit.visited_at)}</div></div>
                <div className="sm:col-span-2"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relatório criado em</div><div className="mt-1 font-medium">{formatDateTime(report.created_at)}</div></div>
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
                  ].map((metric) => <div key={metric.label} className="rounded-xl border bg-card p-3"><div className="text-xs text-muted-foreground">{metric.label}</div><div className="mt-1 text-lg font-bold">{metric.value ?? "—"}</div></div>)}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold">Produtos aplicados</h3>
                {reportChemicals.length > 0 ? <div className="grid gap-2 sm:grid-cols-2">{reportChemicals.map(([name, quantity]) => <div key={name} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm"><span className="font-medium">{name}</span><span className="text-muted-foreground">{String(quantity)}</span></div>)}</div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum produto registrado.</p>}
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold">Serviços realizados</h3>
                {reportTasks.length > 0 ? <ul className="grid gap-2 sm:grid-cols-2">{reportTasks.map((task) => <li key={task} className="rounded-lg border bg-card px-4 py-3 text-sm">✓ {task}</li>)}</ul> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhum serviço registrado.</p>}
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold">Observações</h3>
                <p className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm text-muted-foreground">{report.notes?.trim() || "Nenhuma observação registrada."}</p>
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold">Fotos da visita</h3>
                {reportPhotos.length > 0 ? <div className="grid gap-4 sm:grid-cols-2">{reportPhotos.map(({ key, label }) => <figure key={key} className="overflow-hidden rounded-xl border bg-card"><img src={data.photoUrls[key]} alt={`Foto ${label.toLowerCase()} da visita`} className="aspect-video w-full object-cover" /><figcaption className="px-4 py-3 text-sm font-medium">{label}</figcaption></figure>)}</div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma foto disponível.</p>}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
