<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Roles (admin/tecnico/cliente) live in `public.user_roles`; data access is enforced by RLS, route guards in `src/lib/guard.ts` are UX only. Why: prevents privilege escalation.
- Accounts for technicians and clients are created only via the admin server function `createAccount` (service role); the first self-signup becomes admin via DB trigger. Why: admin-invite model.
- Visit photos live in the private `visit-photos` bucket under `<schedule_id>/...`; storage RLS keys off that folder. Why: clients see only their own photos.
- Daily PDF client options and generation share the technician/day visit query; client filtering is centralized in a tested helper. Why: the selectable clients and exported visits must stay consistent.
- Technician-entered visit date and time are validated together and stored in `schedules.visited_at`, without changing `scheduled_at`. Why: actual attendance and the planned schedule are distinct.
