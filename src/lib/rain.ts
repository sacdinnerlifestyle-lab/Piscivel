const RAIN_TAG = "[chuva]";

/** A visita foi marcada como não realizada por causa da chuva? */
export function isRainVisit(note: string | null | undefined) {
  return typeof note === "string" && note.trim().toLowerCase().startsWith(RAIN_TAG);
}

/** Texto gravado em `schedules.skip_note` ao marcar a visita como não realizada por chuva. */
export function rainNote(date = new Date()) {
  const when = date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${RAIN_TAG} Chuva — visita não realizada em ${when}`;
}

/** Remove o marcador interno antes de mostrar a observação para o usuário. */
export function visitNoteLabel(note: string | null | undefined) {
  if (!note) return "";
  return note.replace(/^\[chuva\]\s*/i, "").trim();
}
