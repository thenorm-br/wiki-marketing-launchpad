-- Atualizar função para criar subscription inativa para novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  
  -- Criar role padrão (user)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Criar subscription INATIVA (sem plano)
  INSERT INTO public.subscriptions (user_id, status, plan)
  VALUES (NEW.id, 'inactive', 'none');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Atualizar default da coluna status
ALTER TABLE public.subscriptions ALTER COLUMN status SET DEFAULT 'inactive';

-- Atualizar default da coluna plan  
ALTER TABLE public.subscriptions ALTER COLUMN plan SET DEFAULT 'none';

-- Corrigir usuários existentes que têm plano 'free'
UPDATE public.subscriptions SET status = 'inactive', plan = 'none' WHERE plan = 'free' OR status = 'active';