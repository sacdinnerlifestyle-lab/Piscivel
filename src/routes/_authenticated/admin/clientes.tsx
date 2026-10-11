import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AdminShell, Empty, inputCls } from "@/components/Shell";
import { supabase } from "@/integrations/supabase/client";
import { createAccount } from "@/lib/users.functions";
import { poolVolume } from "@/lib/mock";
import { MapPin, Phone, Plus, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  head: () => ({ meta: [{ title: "Clientes e Piscinas — Piscivel" }, { name: "description", content: "Cadastro de clientes e piscinas." }, { property: "og:title", content: "Clientes e Piscinas — Piscivel" }, { property: "og:description", content: "Cadastro de clientes e piscinas." }] }),
  component: Clientes,
});

const clientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(8).max(20),
  address: z.string().trim().min(3).max(255),
  coating: z.string().max(40),
  dimensions: z.string().trim().max(60),
  volume: z.coerce.number().min(0).max(100000),
});

function Clientes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dims, setDims] = useState({ c: "", l: "", p: "" });
  const toNum = (x: string) => parseFloat(x.replace(",", "."));
  const autoVol = poolVolume(toNum(dims.c), toNum(dims.l), toNum(dims.p));
  const [loginFor, setLoginFor] = useState<string | null>(null);
  const create = useServerFn(createAccount);

  const { data: list = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*, swimming_pools(*), profiles(id, email)").order("name")).data ?? [],
  });

  const addClient = useMutation({
    mutationFn: async (v: z.infer<typeof clientSchema>) => {
      const { data: c, error } = await supabase.from("clients").insert({ name: v.name, phone: v.phone.replace(/\D/g, ""), address: v.address }).select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("swimming_pools").insert({ client_id: c.id, coating: v.coating, dimensions: v.dimensions || null, volume_m3: v.volume });
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("Cliente cadastrado"); setOpen(false); setDims({ c: "", l: "", p: "" }); qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e) => toast.error(e.message),
  });

  const addLogin = useMutation({
    mutationFn: (d: { email: string; password: string; full_name: string; client_id: string }) => create({ data: { ...d, role: "cliente" } }),
    onSuccess: () => { toast.success("Login do cliente criado"); setLoginFor(null); qc.invalidateQueries({ queryKey: ["clients"] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AdminShell title="Clientes e Piscinas">
      <button onClick={() => setOpen(!open)} className="btn-primary px-4 py-2.5 mb-5 flex items-center gap-2"><Plus className="size-4" />Novo cliente</button>
      {open && (
        <form className="glass p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={(e) => {
          e.preventDefault();
          const r = clientSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
          if (!r.success || autoVol == null) { toast.error("Confira os campos e as medidas da piscina."); return; }
          addClient.mutate(r.data);
        }}>
          <input name="name" required maxLength={100} placeholder="Nome" className={inputCls} />
          <input name="phone" required maxLength={20} placeholder="WhatsApp com DDD (ex: 11987654321)" className={inputCls} />
          <input name="address" required maxLength={255} placeholder="Endereço" className={inputCls} />
          <select name="coating" className={inputCls}>{["Vinil", "Fibra", "Pastilha", "Azulejo", "Concreto"].map((t) => <option key={t}>{t}</option>)}</select>
          <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            {([["c", "Comprimento (m)"], ["l", "Largura (m)"], ["p", "Profundidade média (m)"]] as const).map(([k, label]) => (
              <label key={k} className="text-xs text-muted-foreground space-y-1">
                <span>{label}</span>
                <input inputMode="decimal" required value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: e.target.value })} placeholder="0,0" className={inputCls} />
              </label>
            ))}
            <div className="rounded-lg bg-aqua text-abyss px-3 py-2.5 font-semibold text-center">
              <div className="text-xs font-medium">Volume calculado</div>
              {autoVol != null ? `${autoVol.toLocaleString("pt-BR")} m³` : "—"}
            </div>
            <input type="hidden" name="dimensions" value={autoVol != null ? `${dims.c} x ${dims.l} x ${dims.p} m` : ""} />
            <input type="hidden" name="volume" value={autoVol ?? ""} />
          </div>
          <button disabled={addClient.isPending} className="btn-primary py-2.5 sm:col-span-2 lg:col-span-3">Salvar</button>
        </form>
      )}
      {list.length === 0 ? <Empty>Nenhum cliente cadastrado ainda.</Empty> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((c) => {
            const pool = c.swimming_pools[0];
            const login = c.profiles[0];
            return (
              <div key={c.id} className="glass p-5">
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2"><Phone className="size-3.5" />{c.phone}</div>
                <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address)}`} className="text-sm text-primary mt-1 flex items-center gap-2"><MapPin className="size-3.5" />{c.address}</a>
                {pool && (
                  <div className="flex flex-wrap gap-2 mt-4 text-xs">
                    <span className="bg-secondary px-2.5 py-1 rounded-full">{pool.coating}</span>
                    {pool.dimensions && <span className="bg-secondary px-2.5 py-1 rounded-full">{pool.dimensions}</span>}
                    <span className="bg-aqua text-abyss px-2.5 py-1 rounded-full font-semibold">{pool.volume_m3} m³</span>
                  </div>
                )}
                <div className="mt-4 pt-3 border-t text-sm">
                  {login ? <span className="text-muted-foreground flex items-center gap-2"><KeyRound className="size-3.5" />Login: {login.email}</span> : loginFor === c.id ? (
                    <form className="space-y-2" onSubmit={(e) => {
                      e.preventDefault(); const f = new FormData(e.currentTarget);
                      addLogin.mutate({ email: String(f.get("email")), password: String(f.get("password")), full_name: c.name, client_id: c.id });
                    }}>
                      <input name="email" type="email" required placeholder="E-mail do cliente" className={inputCls} />
                      <input name="password" type="text" required minLength={8} placeholder="Senha inicial (mín. 8)" className={inputCls} />
                      <div className="flex gap-2"><button disabled={addLogin.isPending} className="btn-primary px-3 py-2 flex-1">Criar login</button><button type="button" onClick={() => setLoginFor(null)} className="px-3 text-muted-foreground">Cancelar</button></div>
                    </form>
                  ) : <button onClick={() => setLoginFor(c.id)} className="text-primary font-medium flex items-center gap-2"><KeyRound className="size-3.5" />Criar login do cliente</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
