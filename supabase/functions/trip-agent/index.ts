import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) return json({ error: 'Unauthorized' }, 401)

    const { tripId, message } = await req.json()
    if (!tripId || typeof message !== 'string' || message.trim().length < 2 || message.length > 2000) return json({ error: 'Invalid request' }, 400)
    const { data: membership } = await supabase.from('trip_members').select('role').eq('trip_id', tripId).eq('user_id', auth.user.id).maybeSingle()
    if (!membership) return json({ error: 'Forbidden' }, 403)

    const [{ data: trip }, { data: itinerary }, { data: expenses }, { data: members }] = await Promise.all([
      supabase.from('trips').select('name,starts_on,ends_on').eq('id', tripId).single(),
      supabase.from('itinerary_days').select('day_number,trip_date,title,route,plan').eq('trip_id', tripId).order('day_number'),
      supabase.from('expenses').select('title,category,amount,payer_name,expense_date').eq('trip_id', tripId).order('created_at', { ascending: false }).limit(40),
      supabase.from('trip_members').select('display_name,role').eq('trip_id', tripId).order('joined_at'),
    ])

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) return json({ error: 'OPENAI_API_KEY is not configured' }, 503)
    const prompt = `你是这趟川西自驾旅行的安全优先行程助手。只根据提供的行程、成员和账目回答；不确定的实时路况要明确要求用户核验官方来源。任何修改都先给草案，不声称已经修改数据库。\n旅程：${JSON.stringify(trip)}\n同行成员：${JSON.stringify(members || [])}\n逐日计划：${JSON.stringify(itinerary || [])}\n近期账目：${JSON.stringify(expenses || [])}\n用户问题：${message}`
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: Deno.env.get('OPENAI_MODEL') || 'gpt-5', input: prompt, store: false, max_output_tokens: 900 }) })
    const result = await response.json()
    if (!response.ok) return json({ error: result.error?.message || 'OpenAI request failed' }, response.status)
    const answer = result.output?.flatMap((item: { content?: Array<{ type: string; text?: string }> }) => item.content || []).find((item: { type: string }) => item.type === 'output_text')?.text || '没有生成回答'
    await supabase.from('agent_messages').insert([{ trip_id: tripId, user_id: auth.user.id, role: 'user', content: message }, { trip_id: tripId, user_id: auth.user.id, role: 'assistant', content: answer }])
    return json({ answer }, 200)
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500) }
})

function json(body: unknown, status: number) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }) }
