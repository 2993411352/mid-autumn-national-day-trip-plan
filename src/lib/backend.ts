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

export type CloudPhoto = { id: string; object_path: string; caption: string | null; album_id: string | null; signedUrl?: string }
export type PhotoAlbum = { id: string; title: string; note: string | null; created_at: string }
export type CloudTrip = { id: string; name: string; invite_code: string }
export type CloudMember = { user_id: string; display_name: string | null; role: 'owner' | 'editor' | 'member' }
export type CloudNote = { id: string; day_number: number; stop_time: string; stop_title: string; body: string }
export type GuideLink = { id: string; title: string; url: string; note: string | null; platform: string; group_id?: string | null; created_at: string }
export type GuideGroup = { id: string; title: string; place: string; note: string | null; cover_url: string; created_at: string }
export type Accommodation = { id: string; day_number: number; hotel_name: string; address: string; note: string | null }

export async function signInWithEmail(email: string) {
  if (!supabase) throw new Error('请先配置 Supabase 环境变量')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw error
}

export async function verifyEmailOtp(email: string, token: string) {
  if (!supabase) throw new Error('请先配置 Supabase 环境变量')
  const { data, error } = await supabase.auth.verifyOtp({ email, token: token.trim(), type: 'email' })
  if (error) throw error
  if (!data.session) throw new Error('验证码验证失败，请重新获取')
  return data.session
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

export async function updateMemberName(tripId: string, displayName: string) {
  if (!supabase) throw new Error('后端尚未配置')
  const { error } = await supabase.rpc('update_trip_member_name', { p_trip_id: tripId, p_display_name: displayName.trim() })
  if (error) throw error
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

export async function getMembers(tripId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('trip_members').select('user_id,display_name,role').eq('trip_id', tripId).order('joined_at')
  if (error) throw error
  return (data || []) as CloudMember[]
}

export async function getNotes(tripId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('notes').select('id,day_number,stop_time,stop_title,body').eq('trip_id', tripId).order('created_at')
  if (error) throw error
  return (data || []) as CloudNote[]
}

export async function createNote(tripId: string, dayNumber: number, stopTime: string, stopTitle: string, body: string) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('请先登录')
  const { error } = await supabase.from('notes').insert({ trip_id: tripId, day_number: dayNumber, stop_time: stopTime, stop_title: stopTitle, body: body.trim(), created_by: auth.user.id })
  if (error) throw error
}

export async function deleteNote(id: string) {
  if (!supabase) throw new Error('后端尚未配置')
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

export async function getGuideLinks(tripId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('guide_links').select('id,title,url,note,platform,group_id,created_at').eq('trip_id', tripId).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as GuideLink[]
}

export async function createGuideLink(tripId: string, input: { title:string; url:string; note:string; platform:string; group_id?:string|null }) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('请先登录')
  const rawUrl = input.url.trim()
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('只支持 http 或 https 链接')
  const { error } = await supabase.from('guide_links').insert({ trip_id: tripId, ...input, url: url.toString(), created_by: auth.user.id })
  if (error) throw error
}

export async function getGuideGroups(tripId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('guide_groups').select('id,title,place,note,cover_url,created_at').eq('trip_id', tripId).order('created_at')
  if (error) throw error
  return (data || []) as GuideGroup[]
}

export async function createGuideGroup(tripId: string, input: { title:string; place:string; note:string; cover_url:string }) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('请先登录')
  const { data, error } = await supabase.from('guide_groups').insert({ trip_id:tripId, ...input, created_by:auth.user.id }).select('id,title,place,note,cover_url,created_at').single()
  if (error) throw error
  return data as GuideGroup
}

export async function deleteGuideGroup(id: string) {
  if (!supabase) throw new Error('后端尚未配置')
  const links = await supabase.from('guide_links').delete().eq('group_id', id)
  if (links.error) throw links.error
  const group = await supabase.from('guide_groups').delete().eq('id', id)
  if (group.error) throw group.error
}

export async function getAccommodations(tripId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('accommodations').select('id,day_number,hotel_name,address,note').eq('trip_id', tripId).order('day_number')
  if (error) throw error
  return (data || []) as Accommodation[]
}

export async function upsertAccommodation(tripId: string, input: { day_number:number; hotel_name:string; address:string; note:string }) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('请先登录')
  const { data, error } = await supabase.from('accommodations').upsert({ trip_id:tripId, ...input, updated_by:auth.user.id }, { onConflict:'trip_id,day_number' }).select('id,day_number,hotel_name,address,note').single()
  if (error) throw error
  return data as Accommodation
}

export async function createExpense(tripId: string, expense: { title: string; category: string; payer: string; amount: number; date: string }) {
  if (!supabase) return null
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('expenses').insert({ trip_id: tripId, title: expense.title, category: expense.category, payer_name: expense.payer, amount: expense.amount, expense_date: expense.date, created_by: auth.user?.id }).select().single()
  if (error) throw error
  return data
}

export async function deleteExpense(id: string) {
  if (!supabase) throw new Error('后端尚未配置')
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

export async function getPhotos(tripId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('photos').select('id,object_path,caption,album_id').eq('trip_id', tripId).order('created_at', { ascending: false })
  if (error) throw error
  return Promise.all((data || []).map(async photo => {
    const signed = await supabase.storage.from('trip-photos').createSignedUrl(photo.object_path, 3600)
    return { ...photo, signedUrl: signed.data?.signedUrl }
  })) as Promise<CloudPhoto[]>
}

export async function getPhotoAlbums(tripId: string) {
  if (!supabase) return []
  const { data, error } = await supabase.from('photo_albums').select('id,title,note,created_at').eq('trip_id', tripId).order('created_at')
  if (error) throw error
  return (data || []) as PhotoAlbum[]
}

export async function createPhotoAlbum(tripId: string, input: { title: string; note: string }) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('请先登录')
  const { data, error } = await supabase.from('photo_albums').insert({ trip_id: tripId, title: input.title.trim(), note: input.note.trim(), created_by: auth.user.id }).select('id,title,note,created_at').single()
  if (error) throw error
  return data as PhotoAlbum
}

export async function deletePhotoAlbum(id: string) {
  if (!supabase) throw new Error('后端尚未配置')
  const { error } = await supabase.from('photo_albums').delete().eq('id', id)
  if (error) throw error
}

export async function uploadPhoto(tripId: string, file: File, albumId?: string | null) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('请先登录')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${tripId}/${auth.user.id}/${crypto.randomUUID()}-${safeName}`
  const uploaded = await supabase.storage.from('trip-photos').upload(path, file, { cacheControl: '3600', upsert: false })
  if (uploaded.error) throw uploaded.error
  const { error } = await supabase.from('photos').insert({ trip_id: tripId, object_path: path, original_name: file.name, mime_type: file.type, size_bytes: file.size, album_id: albumId || null, uploaded_by: auth.user.id })
  if (error) throw error
}

export async function deletePhoto(photo: Pick<CloudPhoto, 'id' | 'object_path'>) {
  if (!supabase) throw new Error('后端尚未配置')
  const removed = await supabase.storage.from('trip-photos').remove([photo.object_path])
  if (removed.error) throw removed.error
  const { error } = await supabase.from('photos').delete().eq('id', photo.id)
  if (error) throw error
}

export async function askTripAgent(tripId: string, message: string) {
  if (!supabase) throw new Error('后端尚未配置')
  const { data, error } = await supabase.functions.invoke('trip-agent', { body: { tripId, message } })
  if (error) throw error
  return String(data?.answer || '暂时没有收到回答')
}

export type { Session, User }
