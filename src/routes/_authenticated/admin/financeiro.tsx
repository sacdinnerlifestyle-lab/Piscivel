import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminShell, Empty, inputCls } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { billKey, dayFromValue, fmtDayBR, todayDay, usePayments } from "@/lib/payments";
import { AlertTriangle, CheckCircle2, Clock3, Undo2, Wallet } from "lucide-react";

type PoolRow = {
  id: string;
  name: string | null;
  address: string | null;
  payment_day: number | null;
  monthly_fee: number | null;
  client: { id: string; name: string | null; phone: string | null } | null;
};

type BillStatus = "pago" | "atrasado" | "aberto";

type Bill = {
  key: string;
  clientName: string;
  poolLabel: string;
  amount: number;
  due: Date;
  paidAt: string | null;
  paidDay: string;
  status: BillStatus;
};

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDay = (date: Date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const badgeCls: Record<BillStatus, string> = {
  pago: "bg-success text-primary-foreground",
  atrasado: "bg-destructive text-destructive-foreground",
  aberto: "bg-secondary text-abyss",
};
const badgeLabel: Record<BillStatus, string> = {
  pago: "Pago",
  atrasado: "Atrasado",
  aberto: "Em aberto",
};

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Piscivel" },
      { name: "description", content: "Controle das mensalidades dos clientes." },
      { property: "og:title", content: "Financeiro — Piscivel" },
      { property: "og:description", content: "Controle das mensalidades dos clientes." },
    ],
  }),
  component: Financeiro,
});

function Financeiro() {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });
  const { payments, setPaid, clearPaid } = usePayments();
  const [statusFilter, setStatusFilter] = useState<"todos" | BillStatus>("todos");
  const [search, setSearch] = useState("");

  const markPaid = (key: string, day?: string) => {
    setPaid(key, day || todayDay());
    toast.success("Mensalidade marcada como paga");
  };

  const changePaidDate = (key: string, day: string) => {
    if (!day) {
      clearPaid(key);
      toast.success("Pagamento desfeito");
      return;
    }
    setPaid(key, day);
    toast.success(`Data do pagamento atualizada para ${fmtDayBR(day)}`);
  };

  const unmark = (key: string) => {
    clearPaid(key);
    toast.success("Pagamento desfeito");
  };

  const { data: pools = [], isLoading, isError } = useQuery({
    queryKey: ["finance-pools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("swimming_pools")
        .select("id, name, address, payment_day, monthly_fee, client:clients(id, name, phone)")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as PoolRow[];
    },
  });

  const bills = useMemo<Bill[]>(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    if (!year || !monthNumber) return [];
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return pools
      .filter((pool) => Number(pool.monthly_fee ?? 0) > 0)
      .map((pool) => {
        const day = Math.min(Math.max(Number(pool.payment_day ?? 5), 1), lastDay);
        const due = new Date(year, monthNumber - 1, day);
        const key = billKey(pool.id, month);
        const paidDay = payments[key] ? dayFromValue(payments[key]) : "";
        const paidAt = paidDay || null;
        const status: BillStatus = paidAt ? "pago" : due.getTime() < today.getTime() ? "atrasado" : "aberto";
        return {
          key,
          clientName: pool.client?.name ?? "Cliente não informado",
          poolLabel: pool.name || pool.address || "Piscina",
          amount: Number(pool.monthly_fee ?? 0),
          due,
          paidAt,
          paidDay,
          status,
        };
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime());
  }, [pools, month, payments]);

  const filtered = bills.filter((bill) => {
    if (statusFilter !== "todos" && bill.status !== statusFilter) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return bill.clientName.toLowerCase().includes(term) || bill.poolLabel.toLowerCase().includes(term);
  });

  const totals = bills.reduce(
    (acc, bill) => {
      acc.previsto += bill.amount;
      if (bill.status === "pago") acc.pago += bill.amount;
      if (bill.status === "atrasado") acc.atrasado += bill.amount;
      if (bill.status === "aberto") acc.aberto += bill.amount;
      return acc;
    },
    { previsto: 0, pago: 0, atrasado: 0, aberto: 0 },
  );

  const counts = {
    pago: bills.filter((bill) => bill.status === "pago").length,
    atrasado: bills.filter((bill) => bill.status === "atrasado").length,
    aberto: bills.filter((bill) => bill.status === "aberto").length,
  };

  const pct = totals.previsto > 0 ? Math.round((totals.pago / totals.previsto) * 100) : 0;
  const semMensalidade = pools.length - bills.length;

  return (
    <AdminShell title="Financeiro">
      <div className="glass flex w-full flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <label htmlFor="finance-month" className="text-xs font-semibold text-muted-foreground">Mês de referência</label>
          <input
            id="finance-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className={`${inputCls} sm:w-56`}
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {pct}% do previsto já recebido · {counts.pago} de {bills.length} mensalidade{bills.length === 1 ? "" : "s"} paga{bills.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass p-4">
          <Wallet className="size-5 text-sky" />
          <div className="mt-3 break-words text-2xl font-bold">{brl(totals.previsto)}</div>
          <div className="text-sm font-medium">Previsto no mês</div>
        </div>
        <div className="glass border-2 border-success/30 p-4">
          <CheckCircle2 className="size-5 text-success" />
          <div className="mt-3 break-words text-2xl font-bold text-success">{brl(totals.pago)}</div>
          <div className="text-sm font-medium">Pago ({counts.pago})</div>
        </div>
        <div className="glass border-2 border-destructive/30 p-4">
          <AlertTriangle className="size-5 text-destructive" />
          <div className="mt-3 break-words text-2xl font-bold text-destructive">{brl(totals.atrasado)}</div>
          <div className="text-sm font-medium">Atrasado ({counts.atrasado})</div>
        </div>
        <div className="glass p-4">
          <Clock3 className="size-5 text-primary" />
          <div className="mt-3 break-words text-2xl font-bold">{brl(totals.aberto)}</div>
          <div className="text-sm font-medium">Em aberto ({counts.aberto})</div>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por cliente ou piscina"
          className={inputCls}
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "todos" | BillStatus)}
          className={`${inputCls} sm:w-48`}
        >
          <option value="todos">Todos</option>
          <option value="atrasado">Atrasados</option>
          <option value="aberto">Em aberto</option>
          <option value="pago">Pagos</option>
        </select>
      </div>

      {isLoading && <div className="mt-4"><Empty>Carregando mensalidades…</Empty></div>}
      {isError && <div className="mt-4"><Empty>Não foi possível carregar as mensalidades. Tente novamente.</Empty></div>}

      {!isLoading && !isError && bills.length === 0 && (
        <div className="mt-4">
          <Empty>
            Nenhuma mensalidade configurada. Em Clientes e Piscinas, informe o valor da mensalidade e o dia de vencimento de cada piscina para
            começar o controle.
          </Empty>
        </div>
      )}

      {!isLoading && !isError && bills.length > 0 && (
        <div className="glass mt-4 overflow-x-auto">
          <div className="hidden min-w-[860px] grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.6fr_1fr_auto] gap-3 border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Cliente</span>
            <span>Piscina</span>
            <span>Vencimento</span>
            <span className="text-right">Valor</span>
            <span>Status</span>
            <span>Pagamento</span>
            <span className="text-right">Ação</span>
          </div>
          <div className="min-w-[860px] divide-y md:min-w-0">
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma mensalidade encontrada com esses filtros.</div>
            )}
            {filtered.map((bill) => (
              <div
                key={bill.key}
                className={`grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.6fr_1fr_auto] md:items-center md:gap-3 ${
                  bill.status === "atrasado" ? "bg-destructive/5" : bill.status === "pago" ? "bg-success/5" : ""
                }`}
              >
                <div className="font-medium text-foreground">{bill.clientName}</div>
                <div className="text-muted-foreground">{bill.poolLabel}</div>
                <div className={bill.status === "atrasado" ? "font-semibold text-destructive" : "text-muted-foreground"}>
                  {fmtDay(bill.due)}
                </div>
                <div className="font-semibold md:text-right">{brl(bill.amount)}</div>
                <div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeCls[bill.status]}`}>{badgeLabel[bill.status]}</span>
                </div>
                <div>
                  <label htmlFor={`paid-${bill.key}`} className="sr-only">Data do pagamento</label>
                  <input
                    id={`paid-${bill.key}`}
                    type="date"
                    value={bill.paidDay}
                    onChange={(event) => changePaidDate(bill.key, event.target.value)}
                    className={`${inputCls} w-full text-xs md:w-40`}
                  />
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {bill.paidDay ? `Pago em ${fmtDayBR(bill.paidDay)}` : "Escolha a data para marcar como pago"}
                  </div>
                </div>
                <div className="md:text-right">
                  {bill.paidAt ? (
                    <button
                      onClick={() => unmark(bill.key)}
                      className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary"
                    >
                      <Undo2 className="size-3.5" />Desfazer
                    </button>
                  ) : (
                    <button
                      onClick={() => markPaid(bill.key)}
                      className="inline-flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      <CheckCircle2 className="size-3.5" />Marcar pago
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && !isError && semMensalidade > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {semMensalidade} piscina{semMensalidade === 1 ? "" : "s"} sem valor de mensalidade cadastrado não entra{semMensalidade === 1 ? "" : "m"} neste controle.
        </p>
      )}
    </AdminShell>
  );
}
