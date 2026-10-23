import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { emailToLogin, isEmailLogin, isValidLogin, loginToEmail } from "@/lib/login";
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

type Mode = "login" | "forgot";

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
    const ident = String(f.get("login") ?? "").trim();
    const password = String(f.get("password") ?? "");
    setBusy(true); setMsg(null);
    try {
      if (mode === "forgot") {
        if (!isEmailLogin(ident)) {
          throw new Error("Para recuperar a senha informe seu e-mail. Quem entra com nome de usuário deve pedir a redefinição ao gestor.");
        }
        const { error } = await supabase.auth.resetPasswordForEmail(ident, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMsg("Enviamos um link de recuperação para seu e-mail.");
      } else {
        if (!isValidLogin(ident)) throw new Error("Informe um e-mail válido ou um nome de usuário.");
        const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(ident), password });
        if (error) throw new Error("E-mail/usuário ou senha incorretos.");
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
        <h1 className="text-2xl font-bold mt-8">{mode === "forgot" ? "Recuperar senha" : "Bem-vindo de volta"}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {mode === "forgot" ? "Enviaremos um link para seu e-mail." : "Clientes, técnicos e gestores entram por aqui."}
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <input
            name="login"
            type="text"
            required
            maxLength={255}
            placeholder={mode === "forgot" ? "E-mail" : "E-mail ou nome de usuário"}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className={inp}
          />
          {mode !== "forgot" && <input name="password" type="password" required minLength={1} placeholder="Senha" autoComplete="current-password" className={inp} />}
          {mode === "login" && (
            <div className="flex justify-between text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-primary" />Lembrar-me</label>
              <button type="button" onClick={() => setMode("forgot")} className="text-primary font-medium">Esqueci a senha</button>
            </div>
          )}
          {msg && <p className="text-sm bg-secondary rounded-lg p-3">{msg}</p>}
          <button disabled={busy} className="btn-primary w-full py-3 disabled:opacity-60">
            {busy ? "Aguarde…" : mode === "forgot" ? "Enviar link" : "Entrar"}
          </button>
          {mode !== "login" && (
            <button type="button" onClick={() => setMode("login")} className="w-full text-sm text-muted-foreground">Voltar ao login</button>
          )}
        </form>
        <p className="text-xs text-muted-foreground mt-6 text-center">Logins de clientes e técnicos são criados pelo administrador.</p>
      </div>
    </div>
  );
}

// Mantido para exibição amigável do login do usuário logado.
export function displayLogin(email?: string | null) {
  return emailToLogin(email);
}
