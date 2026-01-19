import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Contact {
  name: string;
  phone: string;
  email?: string;
}

interface VariableMapping {
  variable: string;
  source: 'name' | 'phone' | 'email' | 'custom';
  customValue?: string;
}

interface QueuedMessage {
  id: string;
  contact_phone: string;
  contact_name: string;
  contact_email: string;
  template_name: string;
  template_body: string;
}

// Format phone number for WhatsApp API (remove non-digits, add country code if needed)
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

// Get variable value based on mapping and contact data
function getVariableValue(
  mapping: VariableMapping,
  contact: { name: string; phone: string; email: string }
): string {
  switch (mapping.source) {
    case 'name':
      return contact.name || '';
    case 'phone':
      return contact.phone || '';
    case 'email':
      return contact.email || '';
    case 'custom':
      return mapping.customValue || '';
    default:
      return '';
  }
}

// Build template variables based on mappings
function buildTemplateVariables(
  templateBody: string,
  mappings: VariableMapping[],
  contact: { name: string; phone: string; email: string }
): string[] {
  // Extract variable placeholders from template
  const variableMatches = templateBody.match(/\{\{\d+\}\}/g) || [];
  const uniqueVars = [...new Set(variableMatches)].sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''));
    const numB = parseInt(b.replace(/\D/g, ''));
    return numA - numB;
  });

  // Map each variable to its value
  return uniqueVars.map(variable => {
    const mapping = mappings.find(m => m.variable === variable);
    if (mapping) {
      return getVariableValue(mapping, contact);
    }
    // Default: use contact name for first variable
    const varNum = parseInt(variable.replace(/\D/g, ''));
    if (varNum === 1) return contact.name || '';
    return '';
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { 
      campaign_id, 
      contacts, 
      template_name, 
      template_body,
      variable_mappings = [] 
    } = body;

    console.log('Processing WhatsApp campaign:', campaign_id, 'for user:', user.id);
    console.log('Contacts to process:', contacts?.length || 0);
    console.log('Variable mappings:', JSON.stringify(variable_mappings));

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No contacts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('cloudapi_access_token, cloudapi_phone_number_id, provider')
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      console.error('Config not found:', configError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp config not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (config.provider !== 'cloudapi') {
      return new Response(
        JSON.stringify({ error: 'Only Cloud API provider is supported for direct sending' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.cloudapi_access_token || !config.cloudapi_phone_number_id) {
      console.error('Missing Cloud API credentials');
      return new Response(
        JSON.stringify({ error: 'Cloud API credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert messages into queue with contact email
    const queuedMessages = (contacts as Contact[]).map((contact) => ({
      user_id: user.id,
      campaign_id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      contact_email: contact.email || '',
      template_name: template_name || null,
      template_body: template_body,
      status: 'pending',
    }));

    const { data: insertedMessages, error: insertError } = await supabase
      .from('whatsapp_message_queue')
      .insert(queuedMessages)
      .select('id, contact_phone, contact_name, contact_email, template_name, template_body');

    if (insertError) {
      console.error('Error inserting messages:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to queue messages', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Queued', insertedMessages?.length || 0, 'messages');

    const results: { sent: number; failed: number; errors: string[] } = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const message of (insertedMessages || []) as unknown as Array<{
      id: string;
      contact_phone: string;
      contact_name: string;
      contact_email: string;
      template_name: string;
      template_body: string;
    }>) {
      try {
        await supabase
          .from('whatsapp_message_queue')
          .update({ status: 'processing', processed_at: new Date().toISOString() })
          .eq('id', message.id);

        const formattedPhone = formatPhoneNumber(message.contact_phone);
        
        let messagePayload: Record<string, unknown>;

        if (message.template_name) {
          // Build variables using the mapping
          const contactData = {
            name: message.contact_name,
            phone: message.contact_phone,
            email: message.contact_email || '',
          };
          
          const variables = buildTemplateVariables(
            message.template_body,
            variable_mappings as VariableMapping[],
            contactData
          );
          
          console.log('Variables for', message.contact_name, ':', variables);

          messagePayload = {
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'template',
            template: {
              name: message.template_name,
              language: { code: 'pt_BR' },
              components: variables.length > 0 ? [
                {
                  type: 'body',
                  parameters: variables.map(v => ({ type: 'text', text: v || ' ' })),
                },
              ] : undefined,
            },
          };
        } else {
          messagePayload = {
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'text',
            text: { body: message.template_body },
          };
        }

        console.log('Sending message to:', formattedPhone);

        const metaResponse = await fetch(
          `https://graph.facebook.com/v21.0/${config.cloudapi_phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.cloudapi_access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messagePayload),
          }
        );

        const metaResult = await metaResponse.json();

        if (!metaResponse.ok) {
          console.error('Meta API error for', formattedPhone, ':', metaResult);
          
          await supabase
            .from('whatsapp_message_queue')
            .update({ 
              status: 'failed', 
              error_message: metaResult.error?.message || 'Unknown error',
            })
            .eq('id', message.id);

          results.failed++;
          results.errors.push(`${message.contact_name}: ${metaResult.error?.message || 'Unknown error'}`);
        } else {
          console.log('Message sent successfully to', formattedPhone, 'ID:', metaResult.messages?.[0]?.id);
          
          await supabase
            .from('whatsapp_message_queue')
            .update({ 
              status: 'sent', 
              meta_message_id: metaResult.messages?.[0]?.id,
              sent_at: new Date().toISOString(),
            })
            .eq('id', message.id);

          results.sent++;
        }

        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: unknown) {
        console.error('Error processing message:', message.id, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await supabase
          .from('whatsapp_message_queue')
          .update({ 
            status: 'failed', 
            error_message: errorMessage,
          })
          .eq('id', message.id);

        results.failed++;
        results.errors.push(`${message.contact_name}: ${errorMessage}`);
      }
    }

    console.log('Campaign complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        campaign_id,
        total: insertedMessages?.length || 0,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors.slice(0, 10),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Send messages error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
