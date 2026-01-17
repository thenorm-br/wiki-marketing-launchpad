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
    console.log("Getting WhatsApp config...");

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Get config WITHOUT the access token (security: never send token to client)
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('id, user_id, provider, evolution_instance_name, cloudapi_phone_number_id, cloudapi_business_account_id, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) {
      console.error("Error getting config:", configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar configuração' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config) {
      console.log("No config found");
      return new Response(
        JSON.stringify({ success: true, config: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token exists (without returning it)
    const { data: tokenCheck } = await supabase
      .from('whatsapp_config')
      .select('cloudapi_access_token')
      .eq('user_id', user.id)
      .single();

    const hasAccessToken = !!(tokenCheck?.cloudapi_access_token);

    console.log("Config found, has_access_token:", hasAccessToken);
    return new Response(
      JSON.stringify({ 
        success: true, 
        config: {
          ...config,
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
