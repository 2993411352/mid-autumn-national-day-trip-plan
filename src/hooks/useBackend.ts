import { useCallback, useEffect, useState } from 'react'
import { backendConfigured, ensureTrip, getExpenses, getPhotos, getTrip, supabase, type CloudExpense, type CloudPhoto, type CloudTrip, type Session } from '../lib/backend'

export function useBackend() {
  const [session, setSession] = useState<Session | null>(null)
  const [tripId, setTripId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<CloudExpense[]>([])
  const [photos, setPhotos] = useState<CloudPhoto[]>([])
  const [trip, setTrip] = useState<CloudTrip | null>(null)
  const [loading, setLoading] = useState(backendConfigured)
  const [error, setError] = useState('')

  const refresh = useCallback(async (id?: string) => {
    const activeTrip = id || tripId
    if (!activeTrip) return
    try {
      const [expenseRows, photoRows, tripRow] = await Promise.all([getExpenses(activeTrip), getPhotos(activeTrip), getTrip(activeTrip)])
      setExpenses(expenseRows); setPhotos(photoRows); setTrip(tripRow); setError('')
    } catch (e) { setError(e instanceof Error ? e.message : '云端同步失败') }
  }, [tripId])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) { const fallback = await ensureTrip(); const wanted = localStorage.getItem('active-trip-id'); const selected = wanted ? await getTrip(wanted) : null; const id = selected?.id || fallback; setTripId(id); if (id) { localStorage.setItem('active-trip-id', id); await refresh(id) } }
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) { setTripId(null); setTrip(null); setExpenses([]); setPhotos([]) }
      else setTimeout(async () => { const fallback = await ensureTrip(); const wanted = localStorage.getItem('active-trip-id'); const selected = wanted ? await getTrip(wanted) : null; const id = selected?.id || fallback; setTripId(id); if (id) { localStorage.setItem('active-trip-id', id); await refresh(id) } }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [refresh])

  return { configured: backendConfigured, session, tripId, trip, expenses, photos, loading, error, refresh }
}
