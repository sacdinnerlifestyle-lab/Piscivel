export type Status = "agendada" | "em_andamento" | "concluida";
export const statusLabel: Record<Status, string> = { agendada: "Agendada", em_andamento: "Em andamento", concluida: "Concluída" };
export const params = [
  { key: "ph", label: "pH", min: 7.2, max: 7.6, unit: "", step: 0.1 },
  { key: "free_chlorine", label: "Cloro Livre", min: 1, max: 3, unit: "ppm", step: 0.1 },
  { key: "alkalinity", label: "Alcalinidade Total", min: 80, max: 120, unit: "ppm", step: 1 },
  { key: "cyanuric_acid", label: "Ácido Cianúrico", min: 30, max: 50, unit: "ppm", step: 1 },
  { key: "calcium_hardness", label: "Dureza Cálcica", min: 200, max: 400, unit: "ppm", step: 1 },
  { key: "temperature", label: "Temperatura", min: 20, max: 32, unit: "°C", step: 0.5 },
] as const;
export type ParamKey = (typeof params)[number]["key"];
export const inRange = (k: ParamKey, v: number | null | undefined) => {
  if (v == null) return null;
  const p = params.find((x) => x.key === k)!;
  return v >= p.min && v <= p.max;
};
export const chems = ["Cloro granulado", "Clarificante", "Barrilha", "Elevador de alcalinidade", "Algicida", "Redutor de pH", "Sulfato de alumínio"];
export const tasks = ["Peneiramento", "Escovação", "Aspiração filtrando", "Aspiração drenando", "Limpeza de skimmer/pré-filtro", "Retrolavagem"];
/** Volume em m³ = comprimento × largura × profundidade média (metros), 1 casa decimal. */
export function poolVolume(c: number, l: number, p: number) {
  if (!(c > 0 && l > 0 && p > 0)) return null;
  return Math.round(c * l * p * 10) / 10;
}

/** Gera as datas das visitas recorrentes: dias da semana (0=dom..6=sáb), horário "HH:MM", a partir de `start` por `weeks` semanas. */
export function recurringDates(start: Date, weekdays: number[], time: string, weeks: number) {
  const [h, m] = time.split(":").map(Number);
  const out: Date[] = [];
  const first = new Date(start); first.setHours(0, 0, 0, 0);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(first); d.setDate(first.getDate() + i);
    if (weekdays.includes(d.getDay())) { d.setHours(h ?? 0, m ?? 0, 0, 0); out.push(d); }
  }
  return out;
}

/** Próxima data de vencimento (dia do mês) a partir de `from`; meses curtos usam o último dia. */
export function nextDueDate(day: number, from: Date) {
  const base = new Date(from); base.setHours(0, 0, 0, 0);
  const make = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  let d = make(base.getFullYear(), base.getMonth());
  if (d < base) d = make(base.getFullYear(), base.getMonth() + 1);
  return d;
}
