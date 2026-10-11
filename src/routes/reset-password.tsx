import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nova senha — Piscivel" }, { name: "description", content: "Defina uma nova senha para sua conta Piscivel." }, { property: "og:title", content: "Nova senha — Piscivel" }, { property: "og:description", content: "Defina uma nova senha." }] }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-screen grid place-items-center p-5">
      <form className="glass w-full max-w-md p-8 space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        const password = String(new FormData(e.currentTarget).get("password"));
        setBusy(true);
        const { error } = await supabase.auth.updateUser({ password });
        setBusy(false);
        if (error) { toast.error("Link expirado ou inválido. Peça um novo."); return; }
        toast.success("Senha atualizada!");
        nav({ to: "/" });
      }}>
        <Logo />
        <h1 className="text-2xl font-bold pt-4">Defina sua nova senha</h1>
        <input name="password" type="password" required minLength={8} placeholder="Nova senha (mín. 8)" className="w-full rounded-lg border bg-ice px-4 py-3" />
        <button disabled={busy} className="btn-primary w-full py-3">Salvar senha</button>
      </form>
    </div>
  );
}
