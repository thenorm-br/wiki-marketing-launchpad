-- Create table for WhatsApp conversations/responses
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  message_id TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  message_type TEXT NOT NULL DEFAULT 'text',
  message_content TEXT,
  media_url TEXT,
  campaign_id TEXT,
  original_message_id UUID,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own conversations"
ON public.whatsapp_conversations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
ON public.whatsapp_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
ON public.whatsapp_conversations
FOR UPDATE
USING (auth.uid() = user_id);

-- Allow service role to insert (for webhook)
CREATE POLICY "Service role can insert conversations"
ON public.whatsapp_conversations
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_conversations_user_phone ON public.whatsapp_conversations(user_id, contact_phone);
CREATE INDEX idx_conversations_campaign ON public.whatsapp_conversations(campaign_id);

-- Enable realtime for conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;