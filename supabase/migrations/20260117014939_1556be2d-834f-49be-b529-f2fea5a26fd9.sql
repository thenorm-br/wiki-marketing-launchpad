-- Create message queue table for WhatsApp messages
CREATE TABLE public.whatsapp_message_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  template_id UUID REFERENCES public.whatsapp_templates(id),
  template_name TEXT,
  template_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  error_message TEXT,
  meta_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own messages" 
ON public.whatsapp_message_queue 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" 
ON public.whatsapp_message_queue 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" 
ON public.whatsapp_message_queue 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for faster queue processing
CREATE INDEX idx_message_queue_status ON public.whatsapp_message_queue(status, created_at);
CREATE INDEX idx_message_queue_campaign ON public.whatsapp_message_queue(campaign_id);
CREATE INDEX idx_message_queue_user ON public.whatsapp_message_queue(user_id);