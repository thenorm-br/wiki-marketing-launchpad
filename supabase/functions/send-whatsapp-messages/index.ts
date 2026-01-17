import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueuedMessage {
  id: string;
  contact_phone: string;
  contact_name: string;
  template_name: string;
  template_body: string;
}

interface SendResult {
  messageId: string;
  success: boolean;
  error?: string;
}

// Format phone number for WhatsApp API (remove non-digits, add country code if needed)
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // If doesn't start with country code (55 for Brazil), add it
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

// Extract variables from template body ({{1}}, {{2}}, etc.)
function extractVariables(body: string, contactName: string): string[] {
  const variableMatches = body.match(/\{\{\d+\}\}/g) || [];
  // For now, use contact name as first variable, empty for others
  return variableMatches.map((_, index) => index === 0 ? contactName : '');
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get request body
    const body = await req.json();
    const { campaign_id, contacts, template_name, template_body } = body;

    console.log('Processing WhatsApp campaign:', campaign_id, 'for user:', user.id);
    console.log('Contacts to process:', contacts?.length || 0);

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No contacts provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's WhatsApp config
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

    // Insert messages into queue
    const queuedMessages = contacts.map((contact: { name: string; phone: string }) => ({
      user_id: user.id,
      campaign_id,
      contact_name: contact.name,
      contact_phone: contact.phone,
      template_name: template_name || null,
      template_body: template_body,
      status: 'pending',
    }));

    const { data: insertedMessages, error: insertError } = await supabase
      .from('whatsapp_message_queue')
      .insert(queuedMessages)
      .select('id, contact_phone, contact_name, template_name, template_body');

    if (insertError) {
      console.error('Error inserting messages:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to queue messages', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Queued', insertedMessages?.length || 0, 'messages');

    // Process messages in background (send them)
    const results: { sent: number; failed: number; errors: string[] } = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const message of (insertedMessages || []) as QueuedMessage[]) {
      try {
        // Update status to processing
        await supabase
          .from('whatsapp_message_queue')
          .update({ status: 'processing', processed_at: new Date().toISOString() })
          .eq('id', message.id);

        const formattedPhone = formatPhoneNumber(message.contact_phone);
        
        // Build the message payload
        let messagePayload: Record<string, unknown>;

        if (message.template_name) {
          // Template message
          const variables = extractVariables(message.template_body, message.contact_name);
          
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
                  parameters: variables.map(v => ({ type: 'text', text: v })),
                },
              ] : undefined,
            },
          };
        } else {
          // Regular text message (for testing - may require template in production)
          messagePayload = {
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'text',
            text: { body: message.template_body },
          };
        }

        console.log('Sending message to:', formattedPhone, 'Payload:', JSON.stringify(messagePayload));

        // Send via Meta Cloud API
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
        errors: results.errors.slice(0, 10), // Limit errors returned
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
