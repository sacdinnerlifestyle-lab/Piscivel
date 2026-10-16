export type Status = "agendada" | "em_andamento" | "concluida";
export const statusLabel: Record<Status, string> = { agendada: "Agendada", em_andamento: "Em andamento", concluida: "Concluída" };
export const params = [
  { key: "ph", label: "pH", min: 7.2, max: 7.6, unit: "", step: 0.1, options: [6.8, 7.0, 7.2, 7.4, 7.6, 7.8, 8.0, 8.2] },
  { key: "free_chlorine", label: "Cloro Livre", min: 1, max: 3, unit: "ppm", step: 0.1, options: [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5] },
  { key: "alkalinity", label: "Alcalinidade Total", min: 80, max: 120, unit: "ppm", step: 1, options: [40, 60, 80, 100, 120, 140, 160, 180] },
  { key: "cyanuric_acid", label: "Ácido Cianúrico", min: 30, max: 50, unit: "ppm", step: 1, options: [0, 20, 30, 40, 50, 70, 100] },
  { key: "calcium_hardness", label: "Dureza Cálcica", min: 200, max: 400, unit: "ppm", step: 1, options: [100, 150, 200, 250, 300, 350, 400, 500] },
  { key: "temperature", label: "Temperatura", min: 20, max: 32, unit: "°C", step: 0.5, options: [18, 20, 22, 24, 26, 28, 30, 32, 34] },
] as const;
export type ParamKey = (typeof params)[number]["key"];
export const inRange = (k: ParamKey, v: number | null | undefined) => {
  if (v == null) return null;
  const p = params.find((x) => x.key === k)!;
  return v >= p.min && v <= p.max;
};
export const chems = ["Cloro granulado", "Clarificante", "Barrilha", "Elevador de alcalinidade", "Elevador de dureza cálcica", "Algicida de manutenção", "Algicida de Choque", "Redutor de pH e Alcalinidade", "Sulfato de alumínio"];
export const chemUnit: Record<string, string> = { "Cloro granulado": "g", "Barrilha": "g", "Elevador de alcalinidade": "g", "Elevador de dureza cálcica": "g", "Sulfato de alumínio": "g", "Clarificante": "ml", "Algicida de manutenção": "ml", "Algicida de Choque": "ml", "Redutor de pH e Alcalinidade": "ml" };
export const tasks = ["Peneiramento", "Escovação", "Aspiração filtrando", "Aspiração drenando", "Limpeza de skimmer/pré-filtro", "Limpeza de borda", "Retrolavagem"];
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
