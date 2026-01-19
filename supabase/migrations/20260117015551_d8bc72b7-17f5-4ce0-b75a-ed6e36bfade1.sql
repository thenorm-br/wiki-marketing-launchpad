-- Add contact_email column to message queue
ALTER TABLE public.whatsapp_message_queue 
ADD COLUMN IF NOT EXISTS contact_email TEXT;