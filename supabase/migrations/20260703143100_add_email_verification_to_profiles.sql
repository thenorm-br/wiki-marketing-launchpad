-- Store and sync email verification state from auth.users into app profiles.

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF to_regclass('wiki.profiles') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE wiki.profiles ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMP WITH TIME ZONE';
    EXECUTE 'ALTER TABLE wiki.profiles ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN NOT NULL DEFAULT false';
  END IF;
END $$;

-- Confirm the current test account requested for deployment validation.
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmed_at = COALESCE(confirmed_at, now()),
  updated_at = now()
WHERE email = 'teste@gmail.com';

UPDATE public.profiles AS p
SET
  email = u.email,
  email_confirmed_at = u.email_confirmed_at,
  email_confirmed = u.email_confirmed_at IS NOT NULL,
  updated_at = now()
FROM auth.users AS u
WHERE p.user_id = u.id;

DO $$
BEGIN
  IF to_regclass('wiki.profiles') IS NOT NULL THEN
    EXECUTE '
      UPDATE wiki.profiles AS p
      SET
        email = u.email,
        email_confirmed_at = u.email_confirmed_at,
        email_confirmed = u.email_confirmed_at IS NOT NULL,
        updated_at = now()
      FROM auth.users AS u
      WHERE p.user_id = u.id
    ';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_profile_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    email_confirmed_at = NEW.email_confirmed_at,
    email_confirmed = NEW.email_confirmed_at IS NOT NULL,
    updated_at = now()
  WHERE user_id = NEW.id;

  IF to_regclass('wiki.profiles') IS NOT NULL THEN
    EXECUTE '
      UPDATE wiki.profiles
      SET
        email = $1,
        email_confirmed_at = $2,
        email_confirmed = $3,
        updated_at = now()
      WHERE user_id = $4
    '
    USING NEW.email, NEW.email_confirmed_at, NEW.email_confirmed_at IS NOT NULL, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_email_verification_changed ON auth.users;

CREATE TRIGGER on_auth_user_email_verification_changed
AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email_verification();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    email_confirmed_at,
    email_confirmed
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.email_confirmed_at,
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    email_confirmed = EXCLUDED.email_confirmed,
    updated_at = now();
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.subscriptions (user_id, status, plan)
  VALUES (NEW.id, 'inactive', 'none')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
