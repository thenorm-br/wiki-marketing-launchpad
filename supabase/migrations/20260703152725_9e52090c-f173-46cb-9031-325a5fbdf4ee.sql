
CREATE SCHEMA IF NOT EXISTS wiki;
GRANT USAGE ON SCHEMA wiki TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW wiki.profiles WITH (security_invoker=true) AS SELECT * FROM public.profiles;
CREATE OR REPLACE VIEW wiki.subscriptions WITH (security_invoker=true) AS SELECT * FROM public.subscriptions;
CREATE OR REPLACE VIEW wiki.user_roles WITH (security_invoker=true) AS SELECT * FROM public.user_roles;
CREATE OR REPLACE VIEW wiki.whatsapp_campaigns WITH (security_invoker=true) AS SELECT * FROM public.whatsapp_campaigns;
CREATE OR REPLACE VIEW wiki.whatsapp_config WITH (security_invoker=true) AS SELECT * FROM public.whatsapp_config;
CREATE OR REPLACE VIEW wiki.whatsapp_conversations WITH (security_invoker=true) AS SELECT * FROM public.whatsapp_conversations;
CREATE OR REPLACE VIEW wiki.whatsapp_message_queue WITH (security_invoker=true) AS SELECT * FROM public.whatsapp_message_queue;
CREATE OR REPLACE VIEW wiki.whatsapp_templates WITH (security_invoker=true) AS SELECT * FROM public.whatsapp_templates;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA wiki TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA wiki TO service_role;

DELETE FROM public.subscriptions
WHERE user_id='883d4545-67e7-457d-b0ae-de0281629b5e' AND status='inactive';
