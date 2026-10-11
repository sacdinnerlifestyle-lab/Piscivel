import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { homeFor, meQuery } from "@/lib/session";

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

type Mode = "login" | "forgot" | "signup";

function Login() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const go = async () => {
    const me = await qc.fetchQuery({ ...meQuery, staleTime: 0 });
    if (!me) return;
    const to = homeFor(me.roles);
    if (to) nav({ to });
    else setMsg("Sua conta ainda não tem acesso liberado. Fale com o administrador.");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password") ?? "");
    setBusy(true); setMsg(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMsg("Enviamos um link de recuperação para seu e-mail.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: String(f.get("name")) } } });
        if (error) throw error;
        setMsg("Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("E-mail ou senha incorretos.");
        await go();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado.");
    } finally { setBusy(false); }
  }

  const inp = "w-full rounded-lg border bg-ice px-4 py-3 outline-none focus:ring-2 ring-ring";
  return (
    <div className="min-h-screen grid place-items-center p-5">
      <div className="glass w-full max-w-md p-8">
        <Logo />
        <h1 className="text-2xl font-bold mt-8">{mode === "forgot" ? "Recuperar senha" : mode === "signup" ? "Primeiro acesso do gestor" : "Bem-vindo de volta"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {mode === "forgot" ? "Enviaremos um link para seu e-mail." : mode === "signup" ? "A primeira conta criada vira administradora." : "Clientes, técnicos e gestores entram por aqui."}
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === "signup" && <input name="name" required maxLength={100} placeholder="Seu nome" className={inp} />}
          <input name="email" type="email" required maxLength={255} placeholder="E-mail" autoComplete="email" className={inp} />
          {mode !== "forgot" && <input name="password" type="password" required minLength={mode === "signup" ? 8 : 1} placeholder="Senha" autoComplete={mode === "signup" ? "new-password" : "current-password"} className={inp} />}
          {mode === "login" && (
            <div className="flex justify-between text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-primary" />Lembrar-me</label>
              <button type="button" onClick={() => setMode("forgot")} className="text-primary font-medium">Esqueci a senha</button>
            </div>
          )}
          {msg && <p className="text-sm bg-secondary rounded-lg p-3">{msg}</p>}
          <button disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">
            {busy ? "Aguarde…" : mode === "forgot" ? "Enviar link" : mode === "signup" ? "Criar conta" : "Entrar"}
          </button>
          {mode !== "login" ? (
            <button type="button" onClick={() => setMode("login")} className="w-full text-sm text-muted-foreground">Voltar ao login</button>
          ) : (
            <button type="button" onClick={() => setMode("signup")} className="w-full text-xs text-muted-foreground">Primeiro acesso do gestor? Criar conta</button>
          )}
        </form>
        <p className="text-xs text-muted-foreground mt-6 text-center">Logins de clientes e técnicos são criados pelo administrador.</p>
      </div>
    </div>
  );
}
