export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function visitTimestamp(day: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Informe a data e o horário da visita.");
  const date = new Date(`${day}T${time}:00`);
  if (!Number.isFinite(date.getTime()) || localDateKey(date) !== day || date.toTimeString().slice(0, 5) !== time) throw new Error("Informe uma data e um horário válidos.");
  return date.toISOString();
}