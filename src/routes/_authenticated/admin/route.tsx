import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => requireRole(context.queryClient, ["admin"]),
  component: () => <Outlet />,
});
