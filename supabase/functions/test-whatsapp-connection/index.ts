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
    console.log("Testing WhatsApp Cloud API connection...");

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

    // Get user's WhatsApp config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('cloudapi_access_token, cloudapi_phone_number_id, cloudapi_business_account_id')
      .eq('user_id', user.id)
      .single();

    if (configError || !config) {
      console.error("Error getting config:", configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do WhatsApp não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { cloudapi_access_token, cloudapi_phone_number_id, cloudapi_business_account_id } = config;

    if (!cloudapi_access_token || !cloudapi_phone_number_id) {
      console.error("Missing credentials");
      return new Response(
        JSON.stringify({ success: false, error: 'Access Token ou Phone Number ID não configurados' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Testing connection with Phone ID:", cloudapi_phone_number_id);

    // Test the connection by getting phone number info from Meta API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${cloudapi_phone_number_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cloudapi_access_token}`,
        },
      }
    );

    const metaData = await metaResponse.json();
    console.log("Meta API response:", JSON.stringify(metaData));

    if (!metaResponse.ok) {
      const errorMessage = metaData.error?.message || 'Erro ao conectar com a API do WhatsApp';
      console.error("Meta API error:", errorMessage);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          details: metaData.error 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Connection successful!
    console.log("Connection successful! Phone:", metaData.display_phone_number);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Conexão estabelecida com sucesso!',
        phoneNumber: metaData.display_phone_number,
        verifiedName: metaData.verified_name,
        qualityRating: metaData.quality_rating
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
