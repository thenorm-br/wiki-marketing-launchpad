import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Saving WhatsApp config...");

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'wiki' }
    });

    // Get user ID from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("User ID:", user.id);

    // Parse request body
    const body = await req.json();
    const { 
      provider, 
      evolution_instance_name, 
      cloudapi_phone_number_id, 
      cloudapi_business_account_id,
      cloudapi_access_token 
    } = body;

    console.log("Saving config for provider:", provider);

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const configData: Record<string, unknown> = {
      user_id: user.id,
      provider,
      evolution_instance_name: provider === 'evolution' ? evolution_instance_name : null,
      cloudapi_phone_number_id: provider === 'cloudapi' ? cloudapi_phone_number_id : null,
      cloudapi_business_account_id: provider === 'cloudapi' ? cloudapi_business_account_id : null,
    };

    // Only update token if a new one was provided (not empty)
    if (provider === 'cloudapi' && cloudapi_access_token && cloudapi_access_token.trim() !== '') {
      configData.cloudapi_access_token = cloudapi_access_token.trim();
    } else if (provider !== 'cloudapi') {
      // Clear token if switching away from cloudapi
      configData.cloudapi_access_token = null;
    }

    let result;
    if (existingConfig) {
      console.log("Updating existing config:", existingConfig.id);
      result = await supabase
        .from('whatsapp_config')
        .update(configData)
        .eq('id', existingConfig.id);
    } else {
      console.log("Creating new config");
      result = await supabase
        .from('whatsapp_config')
        .insert(configData);
    }

    if (result.error) {
      console.error("Error saving config:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao salvar configuração' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get updated config (without the access token)
    const { data: updatedConfig } = await supabase
      .from('whatsapp_config')
      .select('id, user_id, provider, evolution_instance_name, cloudapi_phone_number_id, cloudapi_business_account_id, created_at, updated_at')
      .eq('user_id', user.id)
      .single();

    // Check if token exists (without returning it)
    const { data: tokenCheck } = await supabase
      .from('whatsapp_config')
      .select('cloudapi_access_token')
      .eq('user_id', user.id)
      .single();

    const hasAccessToken = !!(tokenCheck?.cloudapi_access_token);

    console.log("Config saved successfully");
    return new Response(
      JSON.stringify({ 
        success: true, 
        config: {
          ...updatedConfig,
          has_access_token: hasAccessToken
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
