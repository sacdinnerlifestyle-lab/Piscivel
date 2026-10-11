import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell, Empty, StatusBadge, fmtDate, fmtTime } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/tecnico/$id")({
  head: () => ({ meta: [{ title: "Visitas do técnico — Piscivel" }, { name: "description", content: "Todas as visitas de um técnico e envio de relatórios." }, { property: "og:title", content: "Visitas do técnico — Piscivel" }, { property: "og:description", content: "Todas as visitas de um técnico e envio de relatórios." }] }),
  component: TecnicoVisitas,
});

type Rep = { ph: number | null; free_chlorine: number | null; alkalinity: number | null; cyanuric_acid: number | null; chemicals: unknown; tasks: string[]; notes: string | null };

function TecnicoVisitas() {
  const { id } = Route.useParams();
  const [filter, setFilter] = useState<"todas" | "concluida" | "pendentes">("todas");
  const { data: prof } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => (await supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle()).data,
  });
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["tech-visits", id],
    queryFn: async () => (await supabase.from("schedules").select("id, scheduled_at, visited_at, status, skip_note, pool:swimming_pools(name, client:clients(name, phone)), report:visit_reports(ph, free_chlorine, alkalinity, cyanuric_acid, chemicals, tasks, notes)").eq("technician_id", id).order("scheduled_at", { ascending: false }).limit(500)).data ?? [],
  });

  const shown = list.filter((v) => filter === "todas" || (filter === "concluida" ? v.status === "concluida" : v.status !== "concluida"));

  function send(v: (typeof list)[number]) {
    const r = (Array.isArray(v.report) ? v.report[0] : v.report) as Rep | null;
    if (!r) return;
    const chem = Object.entries((r.chemicals ?? {}) as Record<string, unknown>).map(([k, q]) => `• ${k}: ${q}`).join("\n");
    const lines = [
      `*Relatório da visita — Piscivel*`,
      `Cliente: ${v.pool?.client?.name ?? ""}${v.pool?.name ? ` (${v.pool.name})` : ""}`,
      `Data: ${fmtDate(v.visited_at ?? v.scheduled_at)}${v.visited_at ? ` às ${fmtTime(v.visited_at)}` : ""}`,
      `Técnico: ${prof?.full_name ?? ""}`,
      ``,
      `*Análise da água*`,
      `pH: ${r.ph ?? "—"} | Cloro livre: ${r.free_chlorine ?? "—"} ppm`,
      `Alcalinidade: ${r.alkalinity ?? "—"} ppm | Ác. cianúrico: ${r.cyanuric_acid ?? "—"} ppm`,
      chem && `\n*Produtos aplicados*\n${chem}`,
      r.tasks?.length ? `\n*Serviços realizados*\n${r.tasks.map((t) => `✓ ${t}`).join("\n")}` : "",
      r.notes ? `\nObservações: ${r.notes}` : "",
    ].filter(Boolean).join("\n");
    const phone = (v.pool?.client?.phone ?? "").replace(/\D/g, "").replace(/^55/, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(lines)}`, "_blank");
  }

  return (
    <AdminShell title={prof?.full_name || "Técnico"}>
      <Link to="/admin/equipe" className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><ArrowLeft className="size-4" />Voltar para equipe</Link>
      <div className="flex gap-2 mb-4">
        {(["todas", "concluida", "pendentes"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-sm px-3 py-1.5 rounded-full ${filter === f ? "btn-primary" : "bg-secondary"}`}>{f === "todas" ? `Todas (${list.length})` : f === "concluida" ? "Concluídas" : "Pendentes"}</button>
        ))}
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : shown.length === 0 ? <Empty>Nenhuma visita encontrada.</Empty> : (
        <div className="glass divide-y">
          {shown.map((v) => {
            const hasReport = Array.isArray(v.report) ? v.report.length > 0 : !!v.report;
            return (
              <div key={v.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-48">
                  <div className="font-medium">{v.pool?.client?.name}{v.pool?.name && <span className="text-muted-foreground font-normal"> · {v.pool.name}</span>}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(v.scheduled_at)}{v.visited_at && ` · visitado às ${fmtTime(v.visited_at)}`}</div>
                  {v.skip_note && <div className="text-xs text-petrol mt-1">{v.skip_note}</div>}
                </div>
                <StatusBadge s={v.status} />
                {hasReport && <button onClick={() => send(v)} className="btn-primary text-sm px-3 py-2 flex items-center gap-2"><MessageCircle className="size-4" />Enviar relatório</button>}
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
