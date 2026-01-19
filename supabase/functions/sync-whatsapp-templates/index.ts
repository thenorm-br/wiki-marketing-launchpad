import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetaTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: {
      header_handle?: string[];
    };
  }>;
  rejected_reason?: string;
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

    console.log('Syncing templates for user:', user.id);

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

    console.log('Fetching templates from Meta API for business account:', config.cloudapi_business_account_id);

    // Fetch templates from Meta Graph API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${config.cloudapi_business_account_id}/message_templates?limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${config.cloudapi_access_token}`,
        },
      }
    );

    if (!metaResponse.ok) {
      const errorData = await metaResponse.json();
      console.error('Meta API error:', errorData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch templates from Meta',
          details: errorData.error?.message || 'Unknown error'
        }),
        { status: metaResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metaData = await metaResponse.json();
    const metaTemplates: MetaTemplate[] = metaData.data || [];

    console.log(`Found ${metaTemplates.length} templates from Meta API`);

    // Process each template
    let synced = 0;
    let updated = 0;

    for (const metaTemplate of metaTemplates) {
      // Extract components
      let headerType: string | null = null;
      let headerContent: string | null = null;
      let bodyText = '';
      let footerText: string | null = null;
      let buttons: unknown = null;

      for (const component of metaTemplate.components) {
        switch (component.type) {
          case 'HEADER':
            headerType = component.format || 'TEXT';
            headerContent = component.text || null;
            break;
          case 'BODY':
            bodyText = component.text || '';
            break;
          case 'FOOTER':
            footerText = component.text || null;
            break;
          case 'BUTTONS':
            buttons = component;
            break;
        }
      }

      // Map Meta status to our status
      let status = 'pending';
      if (metaTemplate.status === 'APPROVED') status = 'approved';
      else if (metaTemplate.status === 'REJECTED') status = 'rejected';

      // Check if template already exists
      const { data: existing } = await supabase
        .from('whatsapp_templates')
        .select('id')
        .eq('user_id', user.id)
        .eq('meta_template_id', metaTemplate.id)
        .single();

      const templateData = {
        user_id: user.id,
        name: metaTemplate.name,
        category: metaTemplate.category,
        language: metaTemplate.language,
        header_type: headerType,
        header_content: headerContent,
        body_text: bodyText,
        footer_text: footerText,
        buttons: buttons,
        status: status,
        rejection_reason: metaTemplate.rejected_reason || null,
        meta_template_id: metaTemplate.id,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('whatsapp_templates')
          .update(templateData)
          .eq('id', existing.id);

        if (updateError) {
          console.error('Error updating template:', updateError);
        } else {
          updated++;
        }
      } else {
        // Insert new template
        const { error: insertError } = await supabase
          .from('whatsapp_templates')
          .insert(templateData);

        if (insertError) {
          console.error('Error inserting template:', insertError);
        } else {
          synced++;
        }
      }
    }

    console.log(`Sync complete: ${synced} new, ${updated} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        updated,
        total: metaTemplates.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
