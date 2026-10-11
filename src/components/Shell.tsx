import { Link } from "@tanstack/react-router";
import { Droplets, LayoutDashboard, Users, CalendarDays, ClipboardCheck, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import type { Status } from "@/lib/mock";
import { statusLabel } from "@/lib/mock";

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className={`flex items-center gap-2 font-bold text-xl ${light ? "text-abyss-foreground" : "text-abyss"}`}>
      <span className="bg-gradient-primary grid place-items-center size-9 rounded-xl text-primary-foreground"><Droplets className="size-5" /></span>
      Piscivel
    </div>
  );
}

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/tecnico", label: "Modo Técnico", icon: ClipboardCheck },
] as const;

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-deep text-abyss-foreground md:w-64 md:min-h-screen p-5 flex md:flex-col gap-6 items-center md:items-stretch">
        <Logo light />
        <nav className="flex md:flex-col gap-1 flex-1 overflow-x-auto">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm opacity-75 hover:opacity-100 whitespace-nowrap"
              activeProps={{ className: "bg-primary opacity-100" }}>
              <n.icon className="size-4" /><span className="hidden sm:inline">{n.label}</span>
            </Link>
          ))}
        </nav>
        <Link to="/" className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100"><LogOut className="size-4" /><span className="hidden md:inline">Sair</span></Link>
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
