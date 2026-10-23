import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidLogin, loginToEmail } from "@/lib/login";

const loginField = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .refine((v) => isValidLogin(v), {
    message: "Informe um e-mail válido ou um nome de usuário (3 a 40 caracteres, sem espaços).",
  });

const schema = z.object({
  email: loginField,
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(100),
  role: z.enum(["tecnico", "cliente", "admin"]),
  client_id: z.string().uuid().nullable().optional(),
});

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem criar contas.");
    if (data.role === "cliente" && !data.client_id) throw new Error("Selecione o cliente.");
    const email = loginToEmail(data.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar conta.");
    const id = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id, full_name: data.full_name, email, client_id: data.role === "cliente" ? (data.client_id ?? null) : null });
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    return { id };
  });

const updateSchema = z
  .object({
    id: z.string().uuid(),
    full_name: z.string().trim().min(1).max(100).optional(),
    email: loginField.optional(),
    password: z.string().min(8).max(72).optional(),
  })
  .refine((v) => Boolean(v.full_name || v.email || v.password), { message: "Nada para atualizar." });

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem editar contas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const nextEmail = data.email ? loginToEmail(data.email) : undefined;

    const authUpdate: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (nextEmail) {
      authUpdate.email = nextEmail;
      authUpdate.email_confirm = true;
    }
    if (data.password) authUpdate.password = data.password;

    if (Object.keys(authUpdate).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, authUpdate);
      if (error) throw new Error(error.message);
    }

    const profileUpdate: { full_name?: string; email?: string } = {};
    if (data.full_name) profileUpdate.full_name = data.full_name;
    if (nextEmail) profileUpdate.email = nextEmail;

    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem excluir contas.");
    if (data.id === context.userId) throw new Error("Você não pode excluir a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
