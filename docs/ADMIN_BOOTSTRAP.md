# Admin Bootstrap

KidsCode Quest does not store a real super-admin password in migrations.
The first admin must be created in a private Supabase SQL session.

## Create the First Super Admin

1. Apply the migrations:

```sql
-- via Supabase CLI:
-- supabase db push
```

2. In the Supabase SQL editor, run this with a private email and password:

```sql
set app.kcq_bootstrap_admin_email = 'admin@example.com';
set app.kcq_bootstrap_admin_password = 'replace-with-a-private-password';

do $$
declare
  boot_email text := nullif(current_setting('app.kcq_bootstrap_admin_email', true), '');
  boot_password text := nullif(current_setting('app.kcq_bootstrap_admin_password', true), '');
begin
  if boot_email is null or boot_password is null then
    raise exception 'Bootstrap email and password are required';
  end if;

  insert into public.kcq_admins (email, pass_hash, name, role)
  values (boot_email, extensions.crypt(boot_password, extensions.gen_salt('bf')), 'Super Admin', 'super')
  on conflict do nothing;
end $$;
```

3. Remove the SQL editor tab/history entry if your operational process requires it.

4. Sign in at `/admin` and create normal admin accounts from the UI.

## Rotation

If a bootstrap password was exposed, create a new super admin, sign in with it,
delete the exposed account from the admin UI, and then rotate any affected browser sessions.

## Notes

- Never commit real admin credentials to `supabase/migrations/`.
- `0004_admins.sql` only bootstraps when session-local GUC values are provided.
- Admin sessions are DB-issued tokens stored in an HTTP-only cookie.
