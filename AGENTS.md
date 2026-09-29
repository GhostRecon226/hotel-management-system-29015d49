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
