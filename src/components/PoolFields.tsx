import { useState } from "react";
import { inputCls } from "@/components/Shell";
import { poolVolume } from "@/lib/mock";

export const coatings = ["Vinil", "Fibra", "Pastilha", "Azulejo", "Concreto"];
const toNum = (x: string) => parseFloat(x.replace(",", "."));

/** Campos de uma piscina (nome, endereço, revestimento, medidas) com volume automático. */
export function usePoolDims(initial?: string | null) {
  const parts = (initial ?? "").replace(/\s*m$/, "").split(" x ");
  const [dims, setDims] = useState(parts.length === 3 ? { c: parts[0]!, l: parts[1]!, p: parts[2]! } : { c: "", l: "", p: "" });
  const volume = poolVolume(toNum(dims.c), toNum(dims.l), toNum(dims.p));
  const dimensions = volume != null ? `${dims.c} x ${dims.l} x ${dims.p} m` : null;
  return { dims, setDims, volume, dimensions, reset: () => setDims({ c: "", l: "", p: "" }) };
}

type PoolInit = { name?: string | null; address?: string | null; coating?: string; payment_day?: number | null; monthly_fee?: number | null };
export function PoolFields({ pool, addressHint, initial }: { pool: ReturnType<typeof usePoolDims>; addressHint?: string; initial?: PoolInit }) {
  const fee = initial?.monthly_fee != null ? String(initial.monthly_fee).replace(".", ",") : "";
  const { dims, setDims, volume } = pool;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <input name="pool_name" defaultValue={initial?.name ?? ""} maxLength={60} placeholder="Nome da piscina (ex: Casa da praia)" className={inputCls} />
      <input name="pool_address" defaultValue={initial?.address ?? ""} maxLength={255} placeholder={addressHint ?? "Endereço da piscina"} className={inputCls} />
      <select name="coating" defaultValue={initial?.coating ?? "Vinil"} className={inputCls}>{coatings.map((t) => <option key={t}>{t}</option>)}</select>
      <label className="text-xs text-muted-foreground space-y-1">
        <span>Dia de vencimento da mensalidade</span>
        <input name="payment_day" defaultValue={initial?.payment_day ?? ""} type="number" min={1} max={31} placeholder="Ex: 10" className={inputCls} />
      </label>
      <label className="text-xs text-muted-foreground space-y-1">
        <span>Valor da mensalidade (R$)</span>
        <input name="monthly_fee" defaultValue={fee} inputMode="decimal" placeholder="Ex: 250,00" className={inputCls} />
      </label>
      <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        {([["c", "Comprimento (m)"], ["l", "Largura (m)"], ["p", "Profundidade média (m)"]] as const).map(([k, label]) => (
          <label key={k} className="text-xs text-muted-foreground space-y-1">
            <span>{label}</span>
            <input inputMode="decimal" required value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: e.target.value })} placeholder="0,0" className={inputCls} />
          </label>
        ))}
        <div className="rounded-lg bg-aqua text-abyss px-3 py-2.5 font-semibold text-center">
          <div className="text-xs font-medium">Volume calculado</div>
          {volume != null ? `${volume.toLocaleString("pt-BR")} m³` : "—"}
        </div>
      </div>
    </div>
  );
}

export const poolLabel = (p: { name?: string | null; address?: string | null } | null | undefined, i?: number) =>
  p?.name || p?.address || (i != null ? `Piscina ${i + 1}` : "Piscina");
