import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/guard";

export const Route = createFileRoute("/_authenticated/tecnico")({
  beforeLoad: ({ context }) => requireRole(context.queryClient, ["tecnico", "admin"]),
  component: () => <Outlet />,
});
