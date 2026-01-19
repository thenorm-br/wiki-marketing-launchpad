-- Create campaigns table to store campaign names
CREATE TABLE public.whatsapp_campaigns (
  id TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  template_id UUID REFERENCES public.whatsapp_templates(id),
  template_name TEXT,
  contacts_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own campaigns"
ON public.whatsapp_campaigns
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
ON public.whatsapp_campaigns
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON public.whatsapp_campaigns
FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime for campaigns table
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_campaigns;