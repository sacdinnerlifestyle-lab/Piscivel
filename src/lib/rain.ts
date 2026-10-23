const RAIN_TAG = "[chuva]";

/** A visita foi marcada como não realizada por causa da chuva? */
export function isRainVisit(note: string | null | undefined) {
  return typeof note === "string" && note.trim().toLowerCase().startsWith(RAIN_TAG);
}

/** A marcação de chuva foi feita pelo botão Chuva intensa (dia inteiro)? */
export function isHeavyRainVisit(note: string | null | undefined) {
  return isRainVisit(note) && /^\[chuva\]\s*chuva intensa/i.test(note!.trim());
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Data no formato DD/MM/AAAA. */
function dayLabel(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Hora no formato HH:MM. */
function timeLabel(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Texto gravado em `schedules.skip_note` ao marcar a visita como não realizada por chuva. */
export function rainNote(date = new Date()) {
  return `${RAIN_TAG} Chuva — visita não realizada em ${dayLabel(date)} às ${timeLabel(date)}`;
}

/**
 * Texto gravado ao marcar o dia inteiro como não realizado por chuva intensa.
 * Registra somente o dia — o relatório de chuva intensa não mostra horário.
 */
export function heavyRainNote(date = new Date()) {
  return `${RAIN_TAG} Chuva intensa — visitas do dia não realizadas em ${dayLabel(date)}`;
}

/** Remove o marcador interno antes de mostrar a observação para o usuário. */
export function visitNoteLabel(note: string | null | undefined) {
  if (!note) return "";
  return note.replace(/^\[chuva\]\s*/i, "").trim();
}
