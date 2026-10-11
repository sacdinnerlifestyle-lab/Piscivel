import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { meQuery, type Role } from "./session";

export async function requireRole(qc: QueryClient, allowed: Role[]) {
  const me = await qc.ensureQueryData(meQuery);
  if (!me || !me.roles.some((r) => allowed.includes(r))) throw redirect({ to: "/" });
  return { me };
}
