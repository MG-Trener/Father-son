import { withSupabase } from 'npm:@supabase/server'

type EventRow = { id: string; family_id: string; actor_user_id: string | null; event_type: string; payload: Record<string, unknown> | null }
type PushDevice = { expo_push_token: string }
type DeliveryRow = { id: string; expo_push_token: string; status: string }
type NotificationCopy = { title: string; body: string; type: string; url: string }

const supportedEventTypes = new Set([
  'five_minutes_ping',
  'advice_requested',
  'connection_response',
  'voice_story_added',
  'recognition_added',
  'agreement_proposed',
  'agreement_activated',
])

const payloadText = (payload: Record<string, unknown> | null, key: string) => {
  const value = payload?.[key]
  return typeof value === 'string' ? value : null
}

const notificationCopy = (event: EventRow, actorName: string): NotificationCopy => {
  if (event.event_type === 'five_minutes_ping') return { title: `${actorName}: есть 5 минут?`, body: 'Открой «Папа & Я» и ответь: «Я рядом» или «Чуть позже».', type: 'connection_signal', url: '/together' }
  if (event.event_type === 'advice_requested') return { title: `${actorName}: мне нужен совет`, body: payloadText(event.payload, 'message') || 'Есть тема, которую хочется обсудить вместе.', type: 'connection_signal', url: '/together' }
  if (event.event_type === 'voice_story_added') return { title: `${actorName} оставил голосовую историю`, body: payloadText(event.payload, 'title') || 'Новый голосовой момент появился в вашей общей истории.', type: 'voice_story', url: '/voice-stories' }
  if (event.event_type === 'recognition_added') {
    const title = payloadText(event.payload, 'title')
    const quality = payloadText(event.payload, 'quality')
    return { title: `${actorName}: я заметил ✦`, body: title || (quality ? `Отметил в тебе: ${quality}.` : 'Сохранил важный момент про тебя.'), type: 'recognition', url: '/recognitions' }
  }
  if (event.event_type === 'agreement_proposed') {
    const title = payloadText(event.payload, 'title')
    return { title: `${actorName} предложил договорённость 🤝`, body: title || 'Открой приложение и реши, согласен ли ты с ней.', type: 'agreement_proposed', url: '/agreements' }
  }
  if (event.event_type === 'agreement_activated') {
    const title = payloadText(event.payload, 'title')
    return { title: 'Мы договорились 🤝', body: title ? `Теперь действует: «${title}».` : `${actorName} подтвердил вашу договорённость.`, type: 'agreement_activated', url: '/agreements' }
  }
  const response = payloadText(event.payload, 'response')
  return { title: `${actorName}: ${response === 'here' ? 'я рядом' : 'чуть позже'}`, body: response === 'here' ? 'Ответ на твой запрос: можно связаться сейчас.' : 'Ответ на твой запрос: вернётся к разговору немного позже.', type: 'connection_response', url: '/together' }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
    let body: { event_id?: string }
    try { body = await req.json() } catch { return Response.json({ error: 'INVALID_JSON' }, { status: 400 }) }
    const eventId = typeof body.event_id === 'string' ? body.event_id : ''
    if (!eventId) return Response.json({ error: 'EVENT_ID_REQUIRED' }, { status: 400 })
    const callerId = typeof ctx.jwtClaims?.sub === 'string' ? ctx.jwtClaims.sub : null
    if (!callerId) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

    const { data: eventData, error: eventError } = await ctx.supabase.from('activity_events').select('id,family_id,actor_user_id,event_type,payload').eq('id', eventId).maybeSingle()
    if (eventError) return Response.json({ error: 'EVENT_READ_FAILED' }, { status: 500 })
    if (!eventData) return Response.json({ error: 'EVENT_NOT_FOUND' }, { status: 404 })
    const event = eventData as EventRow
    if (!supportedEventTypes.has(event.event_type)) return Response.json({ error: 'UNSUPPORTED_EVENT' }, { status: 400 })
    if (event.actor_user_id !== callerId) return Response.json({ error: 'NOT_EVENT_ACTOR' }, { status: 403 })

    let recipientUserId: string | null = null
    if (event.event_type === 'connection_response') {
      recipientUserId = payloadText(event.payload, 'requester_user_id')
    } else if (event.event_type === 'recognition_added') {
      recipientUserId = payloadText(event.payload, 'to_user_id')
      if (recipientUserId) {
        const { data: recipientMember } = await ctx.supabaseAdmin.from('family_members').select('user_id').eq('family_id', event.family_id).eq('user_id', recipientUserId).maybeSingle()
        if (!recipientMember) recipientUserId = null
      }
    } else {
      const { data: recipient } = await ctx.supabaseAdmin.from('family_members').select('user_id').eq('family_id', event.family_id).neq('user_id', callerId).order('joined_at', { ascending: true }).limit(1).maybeSingle()
      recipientUserId = recipient?.user_id ?? null
    }

    if (!recipientUserId || recipientUserId === callerId) return Response.json({ ok: true, delivered: 0, reason: 'NO_RECIPIENT' })

    const [{ data: actorMember }, { data: devices, error: devicesError }] = await Promise.all([
      ctx.supabaseAdmin.from('family_members').select('display_name').eq('family_id', event.family_id).eq('user_id', callerId).maybeSingle(),
      ctx.supabaseAdmin.from('push_devices').select('expo_push_token').eq('user_id', recipientUserId).eq('enabled', true),
    ])
    if (devicesError) return Response.json({ error: 'DEVICE_READ_FAILED' }, { status: 500 })
    const tokens = ((devices ?? []) as PushDevice[]).map((row) => row.expo_push_token).filter((token) => token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
    if (!tokens.length) return Response.json({ ok: true, delivered: 0, reason: 'NO_REGISTERED_DEVICE' })

    const actorName = actorMember?.display_name ?? 'Участник команды'
    const copy = notificationCopy(event, actorName)
    const messages: Array<Record<string, unknown>> = []
    const deliveryByToken = new Map<string, DeliveryRow>()
    for (const token of tokens) {
      const { data: existing } = await ctx.supabaseAdmin.from('notification_deliveries').select('id,expo_push_token,status').eq('event_id', event.id).eq('recipient_user_id', recipientUserId).eq('expo_push_token', token).maybeSingle()
      if (existing && existing.status === 'sent') continue
      let delivery = existing as DeliveryRow | null
      if (!delivery) {
        const { data: inserted, error: insertError } = await ctx.supabaseAdmin.from('notification_deliveries').insert({ event_id: event.id, recipient_user_id: recipientUserId, expo_push_token: token, status: 'pending' }).select('id,expo_push_token,status').single()
        if (insertError || !inserted) continue
        delivery = inserted as DeliveryRow
      }
      deliveryByToken.set(token, delivery)
      messages.push({ to: token, sound: 'default', channelId: 'connection', title: copy.title, body: copy.body, data: { url: copy.url, type: copy.type, event_id: event.id, family_id: event.family_id } })
    }
    if (!messages.length) return Response.json({ ok: true, delivered: 0, reason: 'ALREADY_SENT' })

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' }, body: JSON.stringify(messages) })
    const expoJson = await expoResponse.json().catch(() => null) as { data?: Array<Record<string, unknown>> } | null
    const tickets = Array.isArray(expoJson?.data) ? expoJson.data : []
    for (let index = 0; index < messages.length; index += 1) {
      const token = messages[index]?.to
      if (typeof token !== 'string') continue
      const delivery = deliveryByToken.get(token)
      if (!delivery) continue
      const ticket = tickets[index] ?? {}
      await ctx.supabaseAdmin.from('notification_deliveries').update({ status: ticket.status === 'ok' ? 'sent' : 'error', ticket_id: typeof ticket.id === 'string' ? ticket.id : null, error_message: typeof ticket.message === 'string' ? ticket.message : null, updated_at: new Date().toISOString() }).eq('id', delivery.id)
    }
    if (!expoResponse.ok) return Response.json({ error: 'EXPO_PUSH_FAILED', status: expoResponse.status }, { status: 502 })
    return Response.json({ ok: true, delivered: tickets.filter((ticket) => ticket.status === 'ok').length, attempted: messages.length })
  }),
}
