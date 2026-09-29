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

- Canonical schema lives in supabase/migrations (YYYYMMDDHHMMSS_topic.sql); copy any tool-generated migration there. Why: files, not the Cloud DB, are the source of truth.
- Permission/tenant helpers live in schema `app` (my_tenant, can, has_property_access, approval_limit, fail); RLS policies call them. Why: keeps helpers off the public API and avoids RLS recursion.
- Every data-changing DB function calls app.assert_writable() first (pass true only for settlement/check-out); enforce_writable triggers also block direct writes. Why: expired/suspended hotels are read-only.
- App shell loads everything via one rpc public.my_context() into AccessProvider (src/lib/access.tsx); hide UI with useAccess().can / <Can>. Why: one call, permissions as data.
- Setup tables are read via RLS SELECT only; every write goes through a public.save_* / set_* function that calls app.require(perm, property). Why: rule 2/5, business rules in Postgres.
- Property defaults (charge codes, payment methods, doc sequences, Nigerian taxes) are seeded by an AFTER INSERT trigger on properties via app.seed_property_defaults. Why: every new property is usable at once.
