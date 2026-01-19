import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)

  // Webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    console.log('Webhook verification request:', { mode, token, challenge })

    // You can set your own verify token in whatsapp_config
    if (mode === 'subscribe' && token) {
      console.log('Webhook verified successfully')
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  // Handle incoming messages (POST request from Meta)
  if (req.method === 'POST') {
    try {
      // Check if body is empty
      const contentLength = req.headers.get('content-length')
      const bodyText = await req.text()
      
      if (!bodyText || bodyText.trim() === '') {
        console.log('Empty body received, returning success')
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      let body
      try {
        body = JSON.parse(bodyText)
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Body:', bodyText.substring(0, 200))
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log('Webhook received:', JSON.stringify(body, null, 2))

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        db: { schema: 'wiki' }
      })

      // Support both Meta format and direct n8n format
      let value
      if (Array.isArray(body)) {
        // n8n sends an array directly with the value content
        value = body[0]
        console.log('Processing n8n array format')
      } else if (body.entry) {
        // Meta standard webhook format
        const entry = body.entry?.[0]
        const changes = entry?.changes?.[0]
        value = changes?.value
        console.log('Processing Meta webhook format')
      } else if (body.metadata && body.messages) {
        // Direct value format
        value = body
        console.log('Processing direct value format')
      }

      if (!value) {
        console.log('No value in webhook payload')
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const phoneNumberId = value.metadata?.phone_number_id
      const messages = value.messages || []
      const statuses = value.statuses || []

      console.log(`Processing ${messages.length} messages and ${statuses.length} statuses`)

      // Find the user who owns this phone number
      let userId: string | null = null
      if (phoneNumberId) {
        const { data: configData } = await supabase
          .from('whatsapp_config')
          .select('user_id')
          .eq('cloudapi_phone_number_id', phoneNumberId)
          .single()

        if (configData) {
          userId = configData.user_id
          console.log('Found user for phone number:', userId)
        }
      }

      // Process incoming messages
      for (const message of messages) {
        const contactPhone = message.from
        const messageId = message.id
        const messageType = message.type || 'text'
        const timestamp = message.timestamp

        // Get contact name if available
        const contacts = value.contacts || []
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

        // Try to find the original campaign/message this is a reply to
        // Only save messages from contacts who received a campaign
        // And only save the FIRST response per contact per campaign
        let campaignId = null
        let originalMessageId = null
        let shouldSaveMessage = false

        if (userId && contactPhone) {
          // Find ALL campaigns this contact was part of (by matching last 8-9 digits)
          const phoneDigits = contactPhone.replace(/\D/g, '')
          const { data: outboundMessages } = await supabase
            .from('whatsapp_message_queue')
            .select('campaign_id, id, contact_phone')
            .eq('user_id', userId)
            .ilike('contact_phone', `%${phoneDigits.slice(-8)}%`) // Match by last 8 digits
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })

          if (outboundMessages && outboundMessages.length > 0) {
            // For each campaign, check if we already have a response
            for (const outbound of outboundMessages) {
              // Check if there's already a response for this campaign
              const { data: existingResponse } = await supabase
                .from('whatsapp_conversations')
                .select('id')
                .eq('user_id', userId)
                .eq('campaign_id', outbound.campaign_id)
                .ilike('contact_phone', `%${phoneDigits.slice(-8)}%`)
                .eq('direction', 'inbound')
                .limit(1)
                .maybeSingle()

              if (!existingResponse) {
                // No response yet for this campaign - save it
                campaignId = outbound.campaign_id
                originalMessageId = outbound.id
                shouldSaveMessage = true
                console.log('First response for campaign:', campaignId, 'from contact:', contactPhone)
                break // Only save for the first campaign without a response
              } else {
                console.log('Already have response for campaign:', outbound.campaign_id, 'from contact:', contactPhone, '- skipping')
              }
            }

            if (!shouldSaveMessage) {
              console.log('Contact already responded to all campaigns:', contactPhone)
            }
          } else {
            console.log('No campaign found for contact:', contactPhone, '- skipping message')
          }
        }

        // Insert the conversation record only if contact received a campaign and hasn't responded yet
        if (userId && shouldSaveMessage) {
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
            console.log('First response saved successfully for contact:', contactPhone, 'campaign:', campaignId)
          }
        } else if (!shouldSaveMessage && userId) {
          console.log('Skipping duplicate/non-campaign response from:', contactPhone)
        } else {
          console.log('Could not find user for phone number ID:', phoneNumberId)
        }
      }

      // Process message status updates
      for (const status of statuses) {
        const statusValue = status.status // sent, delivered, read, failed
        const messageId = status.id
        const recipientPhone = status.recipient_id

        console.log(`Status update: ${statusValue} for message ${messageId} to ${recipientPhone}`)

        // Update the original message status in whatsapp_message_queue
        if (userId && messageId) {
          const { error: updateError } = await supabase
            .from('whatsapp_message_queue')
            .update({ 
              status: statusValue === 'failed' ? 'failed' : statusValue,
              error_message: status.errors?.[0]?.message || null
            })
            .eq('meta_message_id', messageId)
            .eq('user_id', userId)

          if (updateError) {
            console.error('Error updating message status:', updateError)
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } catch (error) {
      console.error('Webhook error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders })
})
