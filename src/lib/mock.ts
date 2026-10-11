export type Status = "agendada" | "em_andamento" | "concluida";
export const statusLabel: Record<Status, string> = { agendada: "Agendada", em_andamento: "Em andamento", concluida: "Concluída" };
export const params = [
  { key: "ph", label: "pH", min: 7.2, max: 7.6, unit: "", step: 0.1 },
  { key: "free_chlorine", label: "Cloro Livre", min: 1, max: 3, unit: "ppm", step: 0.1 },
  { key: "alkalinity", label: "Alcalinidade Total", min: 80, max: 120, unit: "ppm", step: 1 },
  { key: "cyanuric_acid", label: "Ácido Cianúrico", min: 30, max: 50, unit: "ppm", step: 1 },
] as const;
export type ParamKey = (typeof params)[number]["key"];
export const inRange = (k: ParamKey, v: number | null | undefined) => {
  if (v == null) return null;
  const p = params.find((x) => x.key === k)!;
  return v >= p.min && v <= p.max;
};
export const chems = ["Cloro granulado", "Clarificante", "Barrilha", "Algicida", "Redutor de pH", "Sulfato de alumínio"];
export const tasks = ["Peneiramento", "Escovação", "Aspiração ao fundo", "Limpeza de skimmer/pré-filtro", "Retrolavagem"];
