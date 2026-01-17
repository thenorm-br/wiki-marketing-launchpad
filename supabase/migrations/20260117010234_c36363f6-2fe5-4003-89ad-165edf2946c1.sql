-- Add access_token column to whatsapp_config for per-user token storage
ALTER TABLE public.whatsapp_config
ADD COLUMN cloudapi_access_token TEXT;