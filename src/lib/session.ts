import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "tecnico" | "cliente";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
    ]);
    return { user: u.user, roles: (roles ?? []).map((r) => r.role as Role), profile };
  },
});

export function homeFor(roles: Role[]) {
  if (roles.includes("admin")) return "/admin" as const;
  if (roles.includes("tecnico")) return "/tecnico" as const;
  if (roles.includes("cliente")) return "/cliente" as const;
  return null;
}

export async function signedUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from("visit-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
