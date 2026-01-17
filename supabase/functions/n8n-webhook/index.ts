import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('n8n webhook received:', JSON.stringify(body, null, 2))

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // n8n sends an array of message objects
    const items = Array.isArray(body) ? body : [body]
    let savedCount = 0

    for (const item of items) {
      const phoneNumberId = item.metadata?.phone_number_id
      const messages = item.messages || []
      const contacts = item.contacts || []

      if (!phoneNumberId) {
        console.log('No phone_number_id in payload')
        continue
      }

      // Find the user who owns this phone number
      const { data: configData } = await supabase
        .from('whatsapp_config')
        .select('user_id')
        .eq('cloudapi_phone_number_id', phoneNumberId)
        .single()

      if (!configData) {
        console.log('No user found for phone_number_id:', phoneNumberId)
        continue
      }

      const userId = configData.user_id

      for (const message of messages) {
        const contactPhone = message.from
        const messageId = message.id
        const messageType = message.type || 'text'

        // Get contact name
        const contact = contacts.find((c: any) => c.wa_id === contactPhone)
        const contactName = contact?.profile?.name || null

        // Extract message content based on type
        let messageContent = ''
        let mediaUrl = null

        switch (messageType) {
          case 'text':
            messageContent = message.text?.body || ''
            break
          case 'image':
            messageContent = message.image?.caption || '[Imagem]'
            mediaUrl = message.image?.id
            break
          case 'video':
            messageContent = message.video?.caption || '[Vídeo]'
            mediaUrl = message.video?.id
            break
          case 'audio':
            messageContent = '[Áudio]'
            mediaUrl = message.audio?.id
            break
          case 'document':
            messageContent = message.document?.filename || '[Documento]'
            mediaUrl = message.document?.id
            break
          case 'location':
            messageContent = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`
            break
          case 'button':
            messageContent = message.button?.text || '[Botão]'
            break
          case 'interactive':
            if (message.interactive?.type === 'button_reply') {
              messageContent = message.interactive.button_reply?.title || '[Resposta de botão]'
            } else if (message.interactive?.type === 'list_reply') {
              messageContent = message.interactive.list_reply?.title || '[Resposta de lista]'
            }
            break
          default:
            messageContent = `[${messageType}]`
        }

        // Try to find the original campaign this is a reply to
        let campaignId = null
        let originalMessageId = null

        const { data: lastOutbound } = await supabase
          .from('whatsapp_message_queue')
          .select('campaign_id, id')
          .eq('user_id', userId)
          .eq('contact_phone', contactPhone)
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastOutbound) {
          campaignId = lastOutbound.campaign_id
          originalMessageId = lastOutbound.id
        }

        // Insert the conversation record
        const { error: insertError } = await supabase
          .from('whatsapp_conversations')
          .insert({
            user_id: userId,
            contact_phone: contactPhone,
            contact_name: contactName,
            message_id: messageId,
            direction: 'inbound',
            message_type: messageType,
            message_content: messageContent,
            media_url: mediaUrl,
            campaign_id: campaignId,
            original_message_id: originalMessageId,
            status: 'received'
          })

        if (insertError) {
          console.error('Error inserting conversation:', insertError)
        } else {
          console.log('Saved message from:', contactName || contactPhone)
          savedCount++
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      saved: savedCount 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('n8n webhook error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
