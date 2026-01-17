import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: {
    body_text?: string[][];
    header_text?: string[];
  };
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
    const { 
      name, 
      category, 
      language, 
      header_type, 
      header_content, 
      body_text, 
      footer_text,
      local_template_id 
    } = body;

    console.log('Submitting template for user:', user.id, 'Template:', name);

    // Validate required fields
    if (!name || !body_text) {
      return new Response(
        JSON.stringify({ error: 'Name and body_text are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's WhatsApp config with access token
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('cloudapi_access_token, cloudapi_business_account_id')
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      console.error('Config not found:', configError);
      return new Response(
        JSON.stringify({ error: 'WhatsApp config not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.cloudapi_access_token || !config.cloudapi_business_account_id) {
      console.error('Missing Cloud API credentials');
      return new Response(
        JSON.stringify({ error: 'Cloud API credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build template components for Meta API
    const components: TemplateComponent[] = [];

    // Add header if present
    if (header_type && header_content) {
      if (header_type === 'TEXT') {
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: header_content,
        });
      } else {
        // For media headers (IMAGE, VIDEO, DOCUMENT)
        components.push({
          type: 'HEADER',
          format: header_type,
          example: {
            header_text: [header_content], // URL as example
          },
        });
      }
    }

    // Add body (required)
    // Extract variables from body text ({{1}}, {{2}}, etc.)
    const variableMatches = body_text.match(/\{\{\d+\}\}/g) || [];
    const bodyComponent: TemplateComponent = {
      type: 'BODY',
      text: body_text,
    };

    // Add example values for variables
    if (variableMatches.length > 0) {
      const exampleValues = variableMatches.map((_: string, index: number) => `exemplo${index + 1}`);
      bodyComponent.example = {
        body_text: [exampleValues],
      };
    }

    components.push(bodyComponent);

    // Add footer if present
    if (footer_text) {
      components.push({
        type: 'FOOTER',
        text: footer_text,
      });
    }

    // Prepare request to Meta API
    const metaPayload = {
      name: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      category: category || 'MARKETING',
      language: language || 'pt_BR',
      components,
    };

    console.log('Sending to Meta API:', JSON.stringify(metaPayload, null, 2));

    // Submit to Meta Graph API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${config.cloudapi_business_account_id}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.cloudapi_access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error('Meta API error:', metaResult);
      
      // Update local template with error status if we have the ID
      if (local_template_id) {
        await supabase
          .from('whatsapp_templates')
          .update({
            status: 'rejected',
            rejection_reason: metaResult.error?.message || 'Erro ao enviar para Meta',
          })
          .eq('id', local_template_id);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to submit template to Meta',
          details: metaResult.error?.message || 'Unknown error',
          meta_error: metaResult.error,
        }),
        { status: metaResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Meta API response:', metaResult);

    // Update local template with Meta template ID
    if (local_template_id && metaResult.id) {
      await supabase
        .from('whatsapp_templates')
        .update({
          meta_template_id: metaResult.id,
          status: 'pending', // Meta will review and update status
        })
        .eq('id', local_template_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        meta_template_id: metaResult.id,
        status: metaResult.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Submit template error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
