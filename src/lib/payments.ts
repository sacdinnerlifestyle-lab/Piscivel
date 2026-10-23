import { useEffect, useState } from "react";

/** Armazenamento compartilhado das mensalidades pagas (dashboard + financeiro). */
export const PAYMENTS_STORAGE_KEY = "piscivel.financeiro.pagamentos.v1";
const PAYMENTS_EVENT = "piscivel:pagamentos";

export type PaymentsMap = Record<string, string>;

const pad = (value: number) => String(value).padStart(2, "0");

/** Mês de referência no formato "AAAA-MM". */
export const monthKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

/** Data local no formato "AAAA-MM-DD". */
export const localDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayDay = () => localDay(new Date());

/** Converte o valor salvo (data simples ou ISO antigo) em "AAAA-MM-DD". */
export const dayFromValue = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return localDay(parsed);
};

export const fmtDayBR = (day: string) => {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  if (!year || !month || !dayOfMonth) return day;
  return new Date(year, month - 1, dayOfMonth).toLocaleDateString("pt-BR");
};

/** Chave por piscina + mês de referência ("<poolId>:AAAA-MM"). */
export const billKey = (poolId: string, month: string) => `${poolId}:${month}`;

export function readPayments(): PaymentsMap {
  try {
    const raw = window.localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PaymentsMap;
  } catch {
    return {};
  }
}

export function writePayments(next: PaymentsMap) {
  try {
    window.localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // armazenamento indisponível: mantém apenas na memória
  }
  window.dispatchEvent(new Event(PAYMENTS_EVENT));
}

export function usePayments() {
  const [payments, setPayments] = useState<PaymentsMap>({});

  useEffect(() => {
    const sync = () => setPayments(readPayments());
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === PAYMENTS_STORAGE_KEY) sync();
    };
    window.addEventListener(PAYMENTS_EVENT, sync);
    window.addEventListener("storage", onStorage);
    sync();
    return () => {
      window.removeEventListener(PAYMENTS_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setPaid = (key: string, day: string) => {
    const next = { ...readPayments(), [key]: day };
    writePayments(next);
    setPayments(next);
  };

  const clearPaid = (key: string) => {
    const next = { ...readPayments() };
    delete next[key];
    writePayments(next);
    setPayments(next);
  };

  return { payments, setPaid, clearPaid };
}
