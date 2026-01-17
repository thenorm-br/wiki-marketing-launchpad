-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Service role can insert conversations" ON public.whatsapp_conversations;