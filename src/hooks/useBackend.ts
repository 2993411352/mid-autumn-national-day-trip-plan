import { useCallback, useEffect, useState } from 'react'
import { backendConfigured, ensureTrip, getExpenses, getGuideLinks, getMembers, getNotes, getPhotos, getTrip, supabase, type CloudExpense, type CloudMember, type CloudNote, type CloudPhoto, type CloudTrip, type GuideLink, type Session } from '../lib/backend'

export function useBackend() {
  const [session, setSession] = useState<Session | null>(null)
  const [tripId, setTripId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<CloudExpense[]>([])
  const [photos, setPhotos] = useState<CloudPhoto[]>([])
  const [trip, setTrip] = useState<CloudTrip | null>(null)
  const [members, setMembers] = useState<CloudMember[]>([])
  const [notes, setNotes] = useState<CloudNote[]>([])
  const [guideLinks, setGuideLinks] = useState<GuideLink[]>([])
  const [loading, setLoading] = useState(backendConfigured)
  const [error, setError] = useState('')

  const refresh = useCallback(async (id?: string) => {
    const activeTrip = id || tripId
    if (!activeTrip) return
    try {
      const [expenseRows, photoRows, tripRow, memberRows, noteRows, guideRows] = await Promise.all([getExpenses(activeTrip), getPhotos(activeTrip), getTrip(activeTrip), getMembers(activeTrip), getNotes(activeTrip), getGuideLinks(activeTrip)])
      setExpenses(expenseRows); setPhotos(photoRows); setTrip(tripRow); setMembers(memberRows); setNotes(noteRows); setGuideLinks(guideRows); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : '云端同步失败') }
  }, [tripId])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) { const fallback = await ensureTrip(); const wanted = localStorage.getItem('active-trip-id'); const selected = wanted ? await getTrip(wanted) : null; const id = selected?.id || fallback; setTripId(id); if (id) { localStorage.setItem('active-trip-id', id); await refresh(id) } else localStorage.removeItem('active-trip-id') }
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) { setTripId(null); setTrip(null); setExpenses([]); setPhotos([]); setMembers([]); setNotes([]); setGuideLinks([]) }
      else setTimeout(async () => { const fallback = await ensureTrip(); const wanted = localStorage.getItem('active-trip-id'); const selected = wanted ? await getTrip(wanted) : null; const id = selected?.id || fallback; setTripId(id); if (id) { localStorage.setItem('active-trip-id', id); await refresh(id) } else localStorage.removeItem('active-trip-id') }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [refresh])

  return { configured: backendConfigured, session, tripId, trip, members, notes, guideLinks, expenses, photos, loading, error, refresh }
}
