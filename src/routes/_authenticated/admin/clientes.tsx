import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AdminShell, Empty, inputCls } from "@/components/Shell";
import { PoolFields, usePoolDims, poolLabel } from "@/components/PoolFields";
import { supabase } from "@/integrations/supabase/client";
import { emailToLogin, isValidLogin } from "@/lib/login";
import { createAccount, updateAccount } from "@/lib/users.functions";
import { MapPin, Phone, Plus, KeyRound, Waves, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  head: () => ({ meta: [{ title: "Clientes e Piscinas — Piscivel" }, { name: "description", content: "Cadastro de clientes e piscinas." }, { property: "og:title", content: "Clientes e Piscinas — Piscivel" }, { property: "og:description", content: "Cadastro de clientes e piscinas." }] }),
  component: Clientes,
});

const clientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(8).max(20),
  address: z.string().trim().min(3).max(255),
});
const poolSchema = z.object({
  pool_name: z.string().trim().max(60).optional().default(""),
  pool_address: z.string().trim().max(255).optional().default(""),
  coating: z.string().max(40),
});

type PoolInput = { client_id: string; name: string | null; address: string | null; coating: string; dimensions: string | null; volume_m3: number; payment_day: number | null; monthly_fee: number | null };

const loginHint = "Pode ser um nome de usuário (ex: joao.silva), sem precisar de e-mail.";

function Clientes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [poolFor, setPoolFor] = useState<string | null>(null);
  const [loginFor, setLoginFor] = useState<string | null>(null);
  const [editLoginFor, setEditLoginFor] = useState<string | null>(null);
  const newPool = usePoolDims();
  const extraPool = usePoolDims();
  const create = useServerFn(createAccount);
  const updateAcc = useServerFn(updateAccount);
  const [editClient, setEditClient] = useState<string | null>(null);
  const [editPool, setEditPool] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries();

  const { data: list = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*, swimming_pools(*), profiles(id, email)").order("name").order("created_at", { referencedTable: "swimming_pools" })).data ?? [],
  });

  const insertPool = async (p: PoolInput) => { const { error } = await supabase.from("swimming_pools").insert(p); if (error) throw error; };

  const addClient = useMutation({
    mutationFn: async (v: { c: z.infer<typeof clientSchema>; p: Omit<PoolInput, "client_id"> }) => {
      const { data: c, error } = await supabase.from("clients").insert({ name: v.c.name, phone: v.c.phone.replace(/\D/g, ""), address: v.c.address }).select().single();
      if (error) throw error;
      await insertPool({ ...v.p, client_id: c.id });
    },
    onSuccess: () => { toast.success("Cliente cadastrado"); setOpen(false); newPool.reset(); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const addPool = useMutation({
    mutationFn: insertPool,
    onSuccess: () => { toast.success("Piscina adicionada"); setPoolFor(null); extraPool.reset(); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const delPool = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("swimming_pools").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Piscina removida"); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const updClient = useMutation({
    mutationFn: async (v: { id: string; c: z.infer<typeof clientSchema> }) => {
      const { error } = await supabase.from("clients").update({ name: v.c.name, phone: v.c.phone.replace(/\D/g, ""), address: v.c.address }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cliente atualizado"); setEditClient(null); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const updPool = useMutation({
    mutationFn: async (v: { id: string; p: Omit<PoolInput, "client_id"> }) => {
      const { error } = await supabase.from("swimming_pools").update(v.p).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Piscina atualizada"); setEditPool(null); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const addLogin = useMutation({
    mutationFn: (d: { email: string; password: string; full_name: string; client_id: string }) => create({ data: { ...d, role: "cliente" } }),
    onSuccess: () => { toast.success("Login do cliente criado"); setLoginFor(null); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const updLogin = useMutation({
    mutationFn: (d: { id: string; email: string; password?: string }) => updateAcc({ data: d }),
    onSuccess: () => { toast.success("Login do cliente atualizado"); setEditLoginFor(null); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const readPool = (f: FormData, dims: ReturnType<typeof usePoolDims>) => {
    const r = poolSchema.safeParse(Object.fromEntries(f));
    if (!r.success || dims.volume == null) return null;
    const day = parseInt(String(f.get("payment_day") ?? ""), 10);
    const fee = parseFloat(String(f.get("monthly_fee") ?? "").replace(/\./g, "").replace(",", "."));
    return {
      name: r.data.pool_name || null, address: r.data.pool_address || null, coating: r.data.coating, dimensions: dims.dimensions, volume_m3: dims.volume,
      payment_day: day >= 1 && day <= 31 ? day : null, monthly_fee: fee > 0 ? fee : null,
    };
  };

  return (
    <AdminShell title="Clientes e Piscinas">
      <button onClick={() => setOpen(!open)} className="btn-primary px-4 py-2.5 mb-5 flex items-center gap-2"><Plus className="size-4" />Novo cliente</button>
      {open && (
        <form className="glass p-5 mb-6 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const c = clientSchema.safeParse(Object.fromEntries(f));
          const p = readPool(f, newPool);
          if (!c.success || !p) { toast.error("Confira os campos e as medidas da piscina."); return; }
          addClient.mutate({ c: c.data, p });
        }}>
          <div className="grid sm:grid-cols-3 gap-3">
            <input name="name" required maxLength={100} placeholder="Nome" className={inputCls} />
            <input name="phone" required maxLength={20} placeholder="WhatsApp com DDD (ex: 11987654321)" className={inputCls} />
            <input name="address" required maxLength={255} placeholder="Endereço principal" className={inputCls} />
          </div>
          <div className="text-sm font-semibold flex items-center gap-2"><Waves className="size-4 text-sky" />Primeira piscina</div>
          <PoolFields pool={newPool} addressHint="Endereço da piscina (se diferente)" />
          <button disabled={addClient.isPending} className="btn-primary py-2.5 w-full">Salvar</button>
        </form>
      )}
      {list.length === 0 ? <Empty>Nenhum cliente cadastrado ainda.</Empty> : (
        <div className="grid lg:grid-cols-2 gap-4">
          {list.map((c) => {
            const login = c.profiles[0];
            return (
              <div key={c.id} className="glass p-5">
                {editClient === c.id ? (
                  <form className="space-y-2" onSubmit={(e) => {
                    e.preventDefault();
                    const r = clientSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
                    if (!r.success) { toast.error("Confira os campos."); return; }
                    updClient.mutate({ id: c.id, c: r.data });
                  }}>
                    <input name="name" required maxLength={100} defaultValue={c.name} placeholder="Nome" className={inputCls} />
                    <input name="phone" required maxLength={20} defaultValue={c.phone} placeholder="WhatsApp com DDD" className={inputCls} />
                    <input name="address" required maxLength={255} defaultValue={c.address} placeholder="Endereço principal" className={inputCls} />
                    <div className="flex gap-2"><button disabled={updClient.isPending} className="btn-primary px-3 py-2 flex-1">Salvar alterações</button><button type="button" onClick={() => setEditClient(null)} className="px-3 text-muted-foreground">Cancelar</button></div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">{c.name}</div>
                      <button onClick={() => setEditClient(c.id)} className="text-sm text-primary font-medium flex items-center gap-1"><Pencil className="size-3.5" />Editar</button>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2"><Phone className="size-3.5" />{c.phone}</div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2"><MapPin className="size-3.5" />{c.address}</div>
                  </>
                )}

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">{c.swimming_pools.length} piscina(s)</div>
                  {c.swimming_pools.map((p, i) => editPool === p.id ? (
                    <EditPool key={p.id} pool={p} pending={updPool.isPending} readPool={readPool} onCancel={() => setEditPool(null)} onSave={(v) => updPool.mutate({ id: p.id, p: v })} />
                  ) : (
                    <div key={p.id} className="bg-ice rounded-lg border p-3 text-sm flex gap-3 items-start">
                      <Waves className="size-4 text-sky mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{poolLabel(p, i)}</div>
                        <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.address || c.address)}`} className="text-xs text-primary truncate block">{p.address || c.address}</a>
                        <div className="flex flex-wrap gap-1.5 mt-1.5 text-xs">
                          <span className="bg-secondary px-2 py-0.5 rounded-full">{p.coating}</span>
                          {p.dimensions && <span className="bg-secondary px-2 py-0.5 rounded-full">{p.dimensions}</span>}
                          <span className="bg-aqua text-abyss px-2 py-0.5 rounded-full font-semibold">{p.volume_m3} m³</span>
                          {p.payment_day && <span className="bg-secondary px-2 py-0.5 rounded-full">Vence dia {p.payment_day}{p.monthly_fee ? ` · ${Number(p.monthly_fee).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}</span>}
                        </div>
                      </div>
                      <button aria-label="Editar piscina" className="text-muted-foreground hover:text-primary" onClick={() => setEditPool(p.id)}><Pencil className="size-4" /></button>
                      {c.swimming_pools.length > 1 && (
                        <button aria-label="Remover piscina" className="text-muted-foreground hover:text-destructive" onClick={() => { if (confirm("Remover esta piscina e o histórico dela?")) delPool.mutate(p.id); }}><Trash2 className="size-4" /></button>
                      )}
                    </div>
                  ))}
                  {poolFor === c.id ? (
                    <form className="border rounded-lg p-3 space-y-3" onSubmit={(e) => {
                      e.preventDefault();
                      const p = readPool(new FormData(e.currentTarget), extraPool);
                      if (!p) { toast.error("Preencha as medidas da piscina."); return; }
                      addPool.mutate({ ...p, client_id: c.id });
                    }}>
                      <PoolFields pool={extraPool} />
                      <div className="flex gap-2"><button disabled={addPool.isPending} className="btn-primary px-3 py-2 flex-1">Adicionar piscina</button><button type="button" onClick={() => setPoolFor(null)} className="px-3 text-muted-foreground">Cancelar</button></div>
                    </form>
                  ) : (
                    <button onClick={() => { extraPool.reset(); setPoolFor(c.id); }} className="text-sm text-primary font-medium flex items-center gap-2"><Plus className="size-3.5" />Adicionar outra piscina</button>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t text-sm">
                  {login && editLoginFor === c.id ? (
                    <form className="space-y-2" onSubmit={(e) => {
                      e.preventDefault();
                      if (!login) return;
                      const f = new FormData(e.currentTarget);
                      const ident = String(f.get("email") ?? "").trim();
                      const password = String(f.get("password") ?? "").trim();
                      if (!isValidLogin(ident)) { toast.error("Informe um usuário (3 a 40 caracteres, sem espaços) ou um e-mail válido."); return; }
                      if (password && password.length < 8) { toast.error("A senha precisa ter ao menos 8 caracteres."); return; }
                      updLogin.mutate({ id: login.id, email: ident, ...(password ? { password } : {}) });
                    }}>
                      <input name="email" type="text" required minLength={3} maxLength={255} defaultValue={emailToLogin(login.email)} placeholder="Usuário ou e-mail do cliente" autoCapitalize="none" spellCheck={false} className={inputCls} />
                      <input name="password" type="text" minLength={8} placeholder="Nova senha (deixe vazio para manter)" className={inputCls} />
                      <p className="text-xs text-muted-foreground">{loginHint}</p>
                      <div className="flex gap-2"><button disabled={updLogin.isPending} className="btn-primary px-3 py-2 flex-1">Salvar login</button><button type="button" onClick={() => setEditLoginFor(null)} className="px-3 text-muted-foreground">Cancelar</button></div>
                    </form>
                  ) : login ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-2"><KeyRound className="size-3.5" />Login: {emailToLogin(login.email)}</span>
                      <button onClick={() => setEditLoginFor(c.id)} className="text-primary font-medium flex items-center gap-1"><Pencil className="size-3.5" />Editar login</button>
                    </div>
                  ) : loginFor === c.id ? (
                    <form className="space-y-2" onSubmit={(e) => {
                      e.preventDefault(); const f = new FormData(e.currentTarget);
                      const ident = String(f.get("email") ?? "").trim();
                      if (!isValidLogin(ident)) { toast.error("Informe um usuário (3 a 40 caracteres, sem espaços) ou um e-mail válido."); return; }
                      addLogin.mutate({ email: ident, password: String(f.get("password")), full_name: c.name, client_id: c.id });
                    }}>
                      <input name="email" type="text" required minLength={3} maxLength={255} placeholder="Usuário ou e-mail do cliente" autoCapitalize="none" spellCheck={false} className={inputCls} />
                      <input name="password" type="text" required minLength={8} placeholder="Senha inicial (mín. 8)" className={inputCls} />
                      <p className="text-xs text-muted-foreground">{loginHint}</p>
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

type PoolRow = { id: string; name: string | null; address: string | null; coating: string; dimensions: string | null; payment_day: number | null; monthly_fee: number | null };
function EditPool({ pool, pending, readPool, onCancel, onSave }: {
  pool: PoolRow; pending: boolean; onCancel: () => void;
  readPool: (f: FormData, d: ReturnType<typeof usePoolDims>) => Omit<PoolInput, "client_id"> | null;
  onSave: (v: Omit<PoolInput, "client_id">) => void;
}) {
  const dims = usePoolDims(pool.dimensions);
  return (
    <form className="border rounded-lg p-3 space-y-3" onSubmit={(e) => {
      e.preventDefault();
      const v = readPool(new FormData(e.currentTarget), dims);
      if (!v) { toast.error("Preencha as medidas da piscina."); return; }
      onSave(v);
    }}>
      <div className="text-sm font-semibold">Editar piscina</div>
      <PoolFields pool={dims} initial={{ ...pool, monthly_fee: pool.monthly_fee != null ? Number(pool.monthly_fee) : null }} />
      <div className="flex gap-2"><button disabled={pending} className="btn-primary px-3 py-2 flex-1">Salvar alterações</button><button type="button" onClick={onCancel} className="px-3 text-muted-foreground">Cancelar</button></div>
    </form>
  );
}
