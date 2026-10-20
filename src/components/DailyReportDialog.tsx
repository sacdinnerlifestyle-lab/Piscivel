import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildDailyReport, downloadBlob, loadDailyReportVisits } from "@/lib/daily-report";
import { Button } from "@/components/ui/button";

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function DailyReportButton() {
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState("");
  const [day, setDay] = useState(todayKey);
  const [client, setClient] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ blob: Blob; filename: string } | null>(null);
  const { data: techs = [] } = useQuery({
    queryKey: ["techs-list"], enabled: open,
    queryFn: async () => {
      const { data: r } = await supabase.from("user_roles").select("user_id").eq("role", "tecnico");
      const ids = (r ?? []).map((x) => x.user_id); if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids).order("full_name");
      return data ?? [];
    },
  });
  const { data: visits = [], isFetching: loadingClients, isError: clientsError } = useQuery({
    queryKey: ["daily-report-clients", tech, day],
    enabled: open && !!tech && !!day,
    queryFn: () => loadDailyReportVisits(tech, day),
  });
  const clients = [...new Map(visits.flatMap((visit) => visit.pool?.client ? [[visit.pool.client.id, visit.pool.client] as const] : [])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const gen = async () => {
    const t = techs.find((x) => x.id === tech); if (!t) return;
    setBusy(true); setFile(null);
    try {
      const selectedClient = clients.find((item) => item.id === client);
      if (client && !selectedClient) throw new Error("Selecione um cliente disponível neste dia.");
      const f = await buildDailyReport(t.id, t.full_name ?? "Técnico", day, selectedClient);
      if (!f) toast.info(client ? "Nenhuma visita deste cliente para o técnico e dia selecionados." : "Nenhuma visita deste técnico neste dia."); else setFile(f);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao gerar PDF"); } finally { setBusy(false); }
  };
  const close = () => { if (busy) return; setOpen(false); setFile(null); };
  return (<>
    <Button onClick={() => setOpen(true)} className="btn-primary text-sm px-4 py-2 flex items-center gap-2 mb-6"><FileDown className="size-4" />Baixar relatório do dia</Button>
    {open && (
      <div className="fixed inset-0 z-50 bg-foreground/40 grid place-items-center p-4" onClick={close}>
        <div className="bg-background rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between"><h2 className="font-semibold">Relatório do dia</h2><Button variant="ghost" size="icon" disabled={busy} onClick={close} aria-label="Fechar"><X className="size-5" /></Button></div>
          <label className="block text-sm">Técnico
            <select disabled={busy} value={tech} onChange={(e) => { setTech(e.target.value); setClient(""); setFile(null); }} className="mt-1 w-full rounded-lg border bg-ice px-3 py-2">
              <option value="">Selecione…</option>
              {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </label>
          <label className="block text-sm">Dia
            <input disabled={busy} type="date" value={day} onChange={(e) => { setDay(e.target.value); setClient(""); setFile(null); }} className="mt-1 w-full rounded-lg border bg-ice px-3 py-2" />
          </label>
          <label className="block text-sm">Cliente
            <select value={client} disabled={!tech || !day || busy || loadingClients || clientsError} onChange={(e) => { setClient(e.target.value); setFile(null); }} className="mt-1 w-full rounded-lg border bg-ice px-3 py-2">
              <option value="">Todos os clientes</option>
              {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {loadingClients && <p className="text-sm text-muted-foreground">Carregando clientes…</p>}
          {clientsError && <p className="text-sm text-destructive">Não foi possível carregar os clientes. Tente novamente.</p>}
          {file ? (
            <Button onClick={() => downloadBlob(file.blob, file.filename)} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"><FileDown className="size-4" />Baixar PDF</Button>
          ) : (
            <Button onClick={gen} disabled={!tech || !day || busy || loadingClients || clientsError} className="btn-primary w-full py-2.5 disabled:opacity-50">{busy ? "Gerando…" : "Gerar PDF"}</Button>
          )}
        </div>
      </div>
    )}
  </>);
}
