import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildDailyReport, downloadBlob } from "@/lib/daily-report";

const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export function DailyReportButton() {
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState("");
  const [day, setDay] = useState(todayKey);
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
  const gen = async () => {
    const t = techs.find((x) => x.id === tech); if (!t) return;
    setBusy(true); setFile(null);
    try {
      const f = await buildDailyReport(t.id, t.full_name ?? "Técnico", day);
      if (!f) toast.info("Nenhuma visita deste técnico neste dia."); else setFile(f);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao gerar PDF"); } finally { setBusy(false); }
  };
  const close = () => { setOpen(false); setFile(null); };
  return (<>
    <button onClick={() => setOpen(true)} className="btn-primary text-sm px-4 py-2 flex items-center gap-2 mb-6"><FileDown className="size-4" />Baixar relatório do dia</button>
    {open && (
      <div className="fixed inset-0 z-50 bg-foreground/40 grid place-items-center p-4" onClick={close}>
        <div className="bg-background rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between"><h2 className="font-semibold">Relatório do dia</h2><button onClick={close} aria-label="Fechar"><X className="size-5" /></button></div>
          <label className="block text-sm">Técnico
            <select value={tech} onChange={(e) => { setTech(e.target.value); setFile(null); }} className="mt-1 w-full rounded-lg border bg-ice px-3 py-2">
              <option value="">Selecione…</option>
              {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </label>
          <label className="block text-sm">Dia
            <input type="date" value={day} onChange={(e) => { setDay(e.target.value); setFile(null); }} className="mt-1 w-full rounded-lg border bg-ice px-3 py-2" />
          </label>
          {file ? (
            <button onClick={() => downloadBlob(file.blob, file.filename)} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"><FileDown className="size-4" />Baixar PDF</button>
          ) : (
            <button onClick={gen} disabled={!tech || !day || busy} className="btn-primary w-full py-2.5 disabled:opacity-50">{busy ? "Gerando…" : "Gerar PDF"}</button>
          )}
        </div>
      </div>
    )}
  </>);
}
