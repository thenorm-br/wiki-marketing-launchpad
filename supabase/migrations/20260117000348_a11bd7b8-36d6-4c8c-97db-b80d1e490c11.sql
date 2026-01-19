-- Tabela para configuração de WhatsApp do usuário
CREATE TABLE public.whatsapp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'evolution' CHECK (provider IN ('evolution', 'cloudapi')),
  evolution_instance_name TEXT,
  cloudapi_phone_number_id TEXT,
  cloudapi_business_account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para templates de WhatsApp (Cloud API)
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'MARKETING' CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  language TEXT NOT NULL DEFAULT 'pt_BR',
  header_type TEXT CHECK (header_type IN ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', NULL)),
  header_content TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  buttons JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  meta_template_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Policies para whatsapp_config
CREATE POLICY "Users can view their own config" 
ON public.whatsapp_config 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config" 
ON public.whatsapp_config 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config" 
ON public.whatsapp_config 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policies para whatsapp_templates
CREATE POLICY "Users can view their own templates" 
ON public.whatsapp_templates 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates" 
ON public.whatsapp_templates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" 
ON public.whatsapp_templates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" 
ON public.whatsapp_templates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_config_updated_at
BEFORE UPDATE ON public.whatsapp_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();