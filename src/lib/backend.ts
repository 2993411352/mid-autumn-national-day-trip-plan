import { createClient, type Session, type User } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const backendConfigured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT'))
export const supabase = backendConfigured ? createClient(url!, anonKey!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null

export type CloudExpense = {
  id: string
  title: string
  category: string
  payer_name: string
  amount: number
  expense_date: string
}

export type CloudPhoto = { id: string; object_path: string; caption: string | null; signedUrl?: string }
export type CloudTrip = { id: string; name: string; invite_code: string }

export async function signInWithEmail(email: string) {
  if (!supabase) throw new Error('请先配置 Supabase 环境变量')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
  if (error) throw error
}

export async function ensureTrip() {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('ensure_default_trip')
  if (error) throw error
  return data as string
}

export async function joinTrip(inviteCode: string, displayName: string) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data, error } = await supabase.rpc('join_trip_by_code', { p_invite_code: inviteCode.toUpperCase(), p_display_name: displayName })
  if (error) throw error
  return data as string
}

export async function getExpenses(tripId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('expenses').select('id,title,category,payer_name,amount,expense_date').eq('trip_id', tripId).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as CloudExpense[]
}

export async function getTrip(tripId: string) {
  if (!supabase) return null
  const { data, error } = await supabase.from('trips').select('id,name,invite_code').eq('id', tripId).maybeSingle()
  if (error) throw error
  return data as CloudTrip | null
}

export async function createExpense(tripId: string, expense: { title: string; category: string; payer: string; amount: number }) {
  if (!supabase) return null
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('expenses').insert({ trip_id: tripId, title: expense.title, category: expense.category, payer_name: expense.payer, amount: expense.amount, created_by: auth.user?.id }).select().single()
  if (error) throw error
  return data
}

export async function getPhotos(tripId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('photos').select('id,object_path,caption').eq('trip_id', tripId).order('created_at', { ascending: false })
  if (error) throw error
  return Promise.all((data || []).map(async photo => {
    const signed = await supabase.storage.from('trip-photos').createSignedUrl(photo.object_path, 3600)
    return { ...photo, signedUrl: signed.data?.signedUrl }
  })) as Promise<CloudPhoto[]>
}

export async function uploadPhoto(tripId: string, file: File) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('请先登录')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${tripId}/${auth.user.id}/${crypto.randomUUID()}-${safeName}`
  const uploaded = await supabase.storage.from('trip-photos').upload(path, file, { cacheControl: '3600', upsert: false })
  if (uploaded.error) throw uploaded.error
  const { error } = await supabase.from('photos').insert({ trip_id: tripId, object_path: path, original_name: file.name, mime_type: file.type, size_bytes: file.size, uploaded_by: auth.user.id })
  if (error) throw error
}

export async function askTripAgent(tripId: string, message: string) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data, error } = await supabase.functions.invoke('trip-agent', { body: { tripId, message } })
  if (error) throw error
  return String(data?.answer || '暂时没有收到回答')
}

export type { Session, User }
