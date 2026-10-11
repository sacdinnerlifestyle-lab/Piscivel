import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/Shell";
import { visits } from "@/lib/mock";
import { MapPin, Phone, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({ meta: [{ title: "Clientes e Piscinas — Piscivel" }, { name: "description", content: "Cadastro de clientes e piscinas." }, { property: "og:title", content: "Clientes e Piscinas — Piscivel" }, { property: "og:description", content: "Cadastro de clientes e piscinas." }] }),
  component: Clientes,
});

function Clientes() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(visits);
  const inp = "w-full rounded-lg border bg-ice px-3 py-2.5 outline-none focus:ring-2 ring-ring";
  return (
    <AdminShell title="Clientes e Piscinas">
      <button onClick={() => setOpen(!open)} className="btn-primary px-4 py-2.5 mb-5 flex items-center gap-2"><Plus className="size-4" />Novo cliente</button>
      {open && (
        <form className="glass p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          setList([{ ...visits[0], id: String(Date.now()), client: String(f.get("n")), phone: String(f.get("p")), address: String(f.get("a")), pool: String(f.get("t")), volume: Number(f.get("v")) }, ...list]); setOpen(false);
        }}>
          <input name="n" required placeholder="Nome" className={inp} />
          <input name="p" required placeholder="Telefone" className={inp} />
          <input name="a" required placeholder="Endereço" className={inp} />
          <select name="t" className={inp}>{["Vinil", "Fibra", "Pastilha", "Azulejo", "Concreto"].map((t) => <option key={t}>{t}</option>)}</select>
          <input name="d" placeholder="Dimensões (ex: 8 x 4 x 1,4 m)" className={inp} />
          <input name="v" type="number" required placeholder="Volume (m³)" className={inp} />
          <button className="btn-primary py-2.5 sm:col-span-2 lg:col-span-3">Salvar</button>
        </form>
      )}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((c) => (
          <div key={c.id} className="glass p-5">
            <div className="font-semibold">{c.client}</div>
            <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2"><Phone className="size-3.5" />{c.phone}</div>
            <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address)}`} className="text-sm text-primary mt-1 flex items-center gap-2"><MapPin className="size-3.5" />{c.address}</a>
            <div className="flex gap-2 mt-4 text-xs">
              <span className="bg-secondary px-2.5 py-1 rounded-full">{c.pool}</span>
              <span className="bg-aqua text-abyss px-2.5 py-1 rounded-full font-semibold">{c.volume} m³</span>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
