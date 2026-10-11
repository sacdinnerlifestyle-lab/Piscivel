import { supabase } from "@/integrations/supabase/client";

export const techsQuery = {
  queryKey: ["team"],
  queryFn: async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["tecnico", "admin"]);
    const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
    if (!ids.length) return [];
    const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    return (profs ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) }));
  },
};

