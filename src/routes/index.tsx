import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/Shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Piscivel — Gestão de manutenção de piscinas" },
      { name: "description", content: "Rotas, checklists e qualidade da água das piscinas dos seus clientes em um só lugar." },
      { property: "og:title", content: "Piscivel — Gestão de manutenção de piscinas" },
      { property: "og:description", content: "Rotas, checklists e qualidade da água em um só lugar." },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [role, setRole] = useState<"admin" | "tecnico">("admin");
  const [forgot, setForgot] = useState(false);
  return (
    <div className="min-h-screen grid place-items-center p-5">
      <div className="glass w-full max-w-md p-8">
        <Logo />
        <h1 className="text-2xl font-bold mt-8">{forgot ? "Recuperar senha" : "Bem-vindo de volta"}</h1>
        <p className="text-muted-foreground text-sm mt-1">{forgot ? "Enviaremos um link para seu e-mail." : "Acesse sua rota de hoje."}</p>
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); if (forgot) return setForgot(false); nav({ to: role === "admin" ? "/admin" : "/tecnico" }); }}>
          <input type="email" required placeholder="E-mail" defaultValue="gestor@piscivel.com" className="w-full rounded-lg border bg-ice px-4 py-3 outline-none focus:ring-2 ring-ring" />
          {!forgot && <input type="password" required placeholder="Senha" defaultValue="demo1234" className="w-full rounded-lg border bg-ice px-4 py-3 outline-none focus:ring-2 ring-ring" />}
          {!forgot && (
            <>
              <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-lg text-sm">
                {(["admin", "tecnico"] as const).map((r) => (
                  <button type="button" key={r} onClick={() => setRole(r)} className={`py-2 rounded-md font-medium ${role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{r === "admin" ? "Administrador" : "Técnico"}</button>
                ))}
              </div>
              <div className="flex justify-between text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-primary" />Lembrar-me</label>
                <button type="button" onClick={() => setForgot(true)} className="text-primary font-medium">Esqueci a senha</button>
              </div>
            </>
          )}
          <button className="btn-primary w-full py-3">{forgot ? "Enviar link" : "Entrar"}</button>
          {forgot && <button type="button" onClick={() => setForgot(false)} className="w-full text-sm text-muted-foreground">Voltar</button>}
        </form>
        <p className="text-xs text-muted-foreground mt-6 text-center">Contas de técnicos são criadas pelo administrador.</p>
      </div>
    </div>
  );
}
