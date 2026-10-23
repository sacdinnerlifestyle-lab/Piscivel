import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Droplets, LayoutDashboard, Users, CalendarDays, CalendarCheck, ClipboardCheck, ClipboardList, LogOut, UserCog, Menu, Wallet, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Status } from "@/lib/mock";
import { statusLabel } from "@/lib/mock";
import { supabase } from "@/integrations/supabase/client";

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className={`flex items-center gap-2 font-bold text-xl ${light ? "text-abyss-foreground" : "text-abyss"}`}>
      <span className="bg-gradient-primary grid place-items-center size-9 rounded-xl text-primary-foreground"><Droplets className="size-5" /></span>
      Piscivel
    </div>
  );
}

export function useSignOut() {
  const qc = useQueryClient();
  const nav = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/", replace: true });
  };
}

export function SignOutButton({ className = "" }: { className?: string }) {
  const out = useSignOut();
  return <button onClick={out} className={`flex items-center gap-2 text-sm ${className}`}><LogOut className="size-4" /><span>Sair</span></button>;
}

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/hoje", label: "Hoje", icon: CalendarCheck },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/admin/visitas", label: "Visitas", icon: ClipboardList },
  { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/admin/equipe", label: "Equipe", icon: UserCog },
  { to: "/tecnico", label: "Modo Técnico", icon: ClipboardCheck },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {nav.map((n) => (
        <Link key={n.to} to={n.to} activeOptions={{ exact: true }} onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-base md:text-sm opacity-75 hover:opacity-100 whitespace-nowrap"
          activeProps={{ className: "bg-primary opacity-100" }}>
          <n.icon className="size-5 md:size-4 shrink-0" /><span>{n.label}</span>
        </Link>
      ))}
    </>
  );
}

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen md:flex">
      <header className="md:hidden sticky top-0 z-40 bg-deep text-abyss-foreground px-4 py-3 flex items-center justify-between">
        <Logo light />
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="grid place-items-center size-11 rounded-lg bg-primary/20">
          <Menu className="size-6" />
        </button>
      </header>
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-abyss/60" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85%] bg-deep text-abyss-foreground p-5 flex flex-col gap-6 shadow-xl">
            <div className="flex items-center justify-between">
              <Logo light />
              <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="grid place-items-center size-10 rounded-lg"><X className="size-6" /></button>
            </div>
            <nav className="flex flex-col gap-1 flex-1"><NavLinks onNavigate={() => setOpen(false)} /></nav>
            <SignOutButton className="opacity-80 hover:opacity-100 py-3 text-base" />
          </div>
        </div>
      )}
      <aside className="hidden md:flex bg-deep text-abyss-foreground md:w-64 md:min-h-screen p-5 flex-col gap-6">
        <Logo light />
        <nav className="flex flex-col gap-1 flex-1"><NavLinks /></nav>
        <SignOutButton className="opacity-70 hover:opacity-100" />
      </aside>
      <main className="flex-1 p-5 md:p-10 max-w-7xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function StatusBadge({ s }: { s: Status }) {
  const cls = s === "concluida" ? "bg-success text-primary-foreground" : s === "em_andamento" ? "bg-aqua text-abyss" : "bg-secondary text-abyss";
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{statusLabel[s]}</span>;
}

export const inputCls = "w-full rounded-lg border bg-ice px-3 py-2.5 outline-none focus:ring-2 ring-ring";

export function Empty({ children }: { children: ReactNode }) {
  return <div className="glass p-8 text-center text-muted-foreground text-sm">{children}</div>;
}

export function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export const fmtTime = (s: string) => new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");
