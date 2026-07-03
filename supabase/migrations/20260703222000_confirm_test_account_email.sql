-- Confirm the deployment test account in Supabase Auth.
-- Apply this migration in Supabase; Coolify deploys the frontend but does not run database migrations.

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN NOT NULL DEFAULT false;

UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmed_at = COALESCE(confirmed_at, now()),
  updated_at = now()
WHERE lower(email) = 'teste@gmail.com';

UPDATE public.profiles AS p
SET
  email = u.email,
  email_confirmed_at = u.email_confirmed_at,
  email_confirmed = u.email_confirmed_at IS NOT NULL,
  updated_at = now()
FROM auth.users AS u
WHERE p.user_id = u.id
  AND lower(u.email) = 'teste@gmail.com';

DO $$
BEGIN
  IF to_regclass('wiki.profiles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE wiki.profiles ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMP WITH TIME ZONE';
    EXECUTE 'ALTER TABLE wiki.profiles ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN NOT NULL DEFAULT false';

    EXECUTE '
      UPDATE wiki.profiles AS p
      SET
        email = u.email,
        email_confirmed_at = u.email_confirmed_at,
        email_confirmed = u.email_confirmed_at IS NOT NULL,
        updated_at = now()
      FROM auth.users AS u
      WHERE p.user_id = u.id
        AND lower(u.email) = ''teste@gmail.com''
    ';
  END IF;
END $$;
