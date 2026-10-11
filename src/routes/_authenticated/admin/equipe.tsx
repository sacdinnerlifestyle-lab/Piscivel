import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell, Empty, inputCls } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { createAccount } from "@/lib/users.functions";
import { techsQuery } from "@/lib/queries";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Piscivel" }, { name: "description", content: "Cadastre técnicos e gestores." }, { property: "og:title", content: "Equipe — Piscivel" }, { property: "og:description", content: "Cadastre técnicos e gestores." }] }),
  component: Equipe,
});

function Equipe() {
  const qc = useQueryClient();
  const create = useServerFn(createAccount);
  const { data: team = [] } = useQuery(techsQuery);
  const m = useMutation({
    mutationFn: (d: { email: string; password: string; full_name: string; role: "tecnico" | "admin" }) => create({ data: d }),
    onSuccess: () => { toast.success("Conta criada. Envie o e-mail e a senha para a pessoa."); qc.invalidateQueries({ queryKey: ["team"] }); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <AdminShell title="Equipe">
      <form className="glass p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3" onSubmit={(e) => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        m.mutate({ full_name: String(f.get("name")), email: String(f.get("email")), password: String(f.get("password")), role: f.get("role") as "tecnico" | "admin" });
        e.currentTarget.reset();
      }}>
        <input name="name" required maxLength={100} placeholder="Nome" className={inputCls} />
        <input name="email" type="email" required placeholder="E-mail" className={inputCls} />
        <input name="password" required minLength={8} placeholder="Senha inicial (mín. 8)" className={inputCls} />
        <select name="role" className={inputCls}><option value="tecnico">Técnico</option><option value="admin">Gestor</option></select>
        <button disabled={m.isPending} className="btn-primary py-2.5 flex items-center justify-center gap-2"><UserPlus className="size-4" />Convidar</button>
      </form>
      {team.length === 0 ? <Empty>Nenhum membro ainda.</Empty> : (
        <div className="glass divide-y">
          {team.map((t) => (
            <div key={t.id} className="p-4 flex items-center gap-4">
              <div className="flex-1"><div className="font-medium">{t.full_name || "—"}</div><div className="text-xs text-muted-foreground">{t.email}</div></div>
              {t.roles.map((r) => <span key={r} className="text-xs bg-secondary px-2.5 py-1 rounded-full">{r === "admin" ? "Gestor" : "Técnico"}</span>)}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
