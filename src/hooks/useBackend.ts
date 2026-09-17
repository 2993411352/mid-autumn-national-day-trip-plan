import { useCallback, useEffect, useState } from 'react'
import {
  backendConfigured, ensureTrip, getAccommodations, getExpenses, getGuideGroups,
  getGuideLinks, getMembers, getNotes, getPhotoAlbums, getPhotos, getTrip, supabase,
  type Accommodation, type CloudExpense, type CloudMember, type CloudNote,
  type CloudPhoto, type CloudTrip, type GuideGroup, type GuideLink, type PhotoAlbum, type Session,
} from '../lib/backend'

function errorMessage(error: unknown, fallback = '云端同步失败') {
  if (!error || typeof error !== 'object') return fallback
  const candidate = error as { code?: string; message?: string }
  if (['42P01', '42703', 'PGRST204', 'PGRST205'].includes(candidate.code || '')) {
    return '新功能的云端数据库尚未升级，请先在 Supabase 执行最新迁移脚本'
  }
  return candidate.message || fallback
}

export function useBackend() {
  const [session, setSession] = useState<Session | null>(null)
  const [tripId, setTripId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<CloudExpense[]>([])
  const [photos, setPhotos] = useState<CloudPhoto[]>([])
  const [photoAlbums, setPhotoAlbums] = useState<PhotoAlbum[]>([])
  const [trip, setTrip] = useState<CloudTrip | null>(null)
  const [members, setMembers] = useState<CloudMember[]>([])
  const [notes, setNotes] = useState<CloudNote[]>([])
  const [guideLinks, setGuideLinks] = useState<GuideLink[]>([])
  const [guideGroups, setGuideGroups] = useState<GuideGroup[]>([])
  const [accommodations, setAccommodations] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(backendConfigured)
  const [error, setError] = useState('')

  const refresh = useCallback(async (id?: string) => {
    const activeTrip = id || tripId
    if (!activeTrip) return

    // Membership and trip identity are core state. Optional feature tables must
    // never make a valid member look as though they have not joined the trip.
    try {
      const [tripRow, memberRows] = await Promise.all([getTrip(activeTrip), getMembers(activeTrip)])
      setTrip(tripRow)
      setMembers(memberRows)
      if (!tripRow) {
        setError('当前账号无权访问这趟旅程，请使用旅程邀请码加入')
        return
      }
    } catch (cause) {
      setError(errorMessage(cause))
      return
    }

    const results = await Promise.allSettled([
      getExpenses(activeTrip), getPhotos(activeTrip), getPhotoAlbums(activeTrip), getNotes(activeTrip),
      getGuideLinks(activeTrip), getGuideGroups(activeTrip), getAccommodations(activeTrip),
    ])

    if (results[0].status === 'fulfilled') setExpenses(results[0].value)
    if (results[1].status === 'fulfilled') setPhotos(results[1].value)
    if (results[2].status === 'fulfilled') setPhotoAlbums(results[2].value)
    if (results[3].status === 'fulfilled') setNotes(results[3].value)
    if (results[4].status === 'fulfilled') setGuideLinks(results[4].value)
    if (results[5].status === 'fulfilled') setGuideGroups(results[5].value)
    if (results[6].status === 'fulfilled') setAccommodations(results[6].value)

    const failed = results.find(result => result.status === 'rejected')
    setError(failed?.status === 'rejected' ? errorMessage(failed.reason, '部分云端功能同步失败') : '')
  }, [tripId])

  const loadTripForSession = useCallback(async () => {
    try {
      const fallback = await ensureTrip()
      const wanted = localStorage.getItem('active-trip-id')
      const selected = wanted ? await getTrip(wanted) : null
      const id = selected?.id || fallback
      setTripId(id)
      if (id) {
        localStorage.setItem('active-trip-id', id)
        await refresh(id)
      } else {
        localStorage.removeItem('active-trip-id')
        setTrip(null)
        setError('')
      }
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }, [refresh])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession()
      .then(async ({ data }) => {
        setSession(data.session)
        if (data.session) await loadTripForSession()
      })
      .catch(cause => setError(errorMessage(cause)))
      .finally(() => setLoading(false))

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        setTripId(null); setTrip(null); setExpenses([]); setPhotos([]); setMembers([])
        setPhotoAlbums([]); setNotes([]); setGuideLinks([]); setGuideGroups([]); setAccommodations([]); setError('')
      } else {
        setTimeout(loadTripForSession, 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [loadTripForSession])

  return { configured: backendConfigured, session, tripId, trip, members, notes, guideLinks, guideGroups, accommodations, expenses, photos, photoAlbums, loading, error, refresh }
}
