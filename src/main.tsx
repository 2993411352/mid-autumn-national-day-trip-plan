import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, Camera, Check, ChevronRight, CloudSun, Download, ExternalLink, FolderPlus, Home, Link, LocateFixed, Map, MapPin, Menu, Navigation, Pencil, Plus, Route, Search, Settings, Sparkles, Trash2, Users, WalletCards, X } from 'lucide-react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { guides, tripDays, type DayPlan } from './data'
import { askTripAgent, createExpense, createGuideGroup, createGuideLink, createNote, createPhotoAlbum, deleteGuideGroup, deleteNote, deletePhotoAlbum, joinTrip, signInWithEmail, supabase, updateMemberName, uploadPhoto, upsertAccommodation, verifyEmailOtp, type Accommodation, type CloudNote, type CloudPhoto, type GuideGroup, type GuideLink, type PhotoAlbum } from './lib/backend'
import { useBackend } from './hooks/useBackend'
import './styles.css'
import 'leaflet/dist/leaflet.css'

type Tab = 'home' | 'trip' | 'map' | 'expense' | 'gallery'
type Expense = { id: string | number; title: string; category: string; payer: string; amount: number; date: string }

const LOCAL_NOTES_KEY = 'trip-notes-v1'
const LOCAL_GUIDES_KEY = 'trip-guides-v1'
const LOCAL_GUIDE_GROUPS_KEY = 'trip-guide-groups-v1'
const LOCAL_STAYS_KEY = 'trip-accommodations-v1'

function readLocalNotes(): CloudNote[] {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_NOTES_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

function saveLocalNote(note: CloudNote) {
  try {
    const rows = readLocalNotes().filter(item => item.id !== note.id)
    localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify([...rows, note]))
    window.dispatchEvent(new CustomEvent('trip-notes-updated'))
  } catch { /* local storage may be disabled in private browsing */ }
}

function removeLocalNote(id:string) {
  localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(readLocalNotes().filter(item=>item.id!==id)))
  window.dispatchEvent(new CustomEvent('trip-notes-updated'))
}

function readLocalGuides(): GuideLink[] {
  try {
    const value = JSON.parse(localStorage.getItem(LOCAL_GUIDES_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch { return [] }
}

function saveLocalGuide(link: GuideLink) {
  try {
    const rows = readLocalGuides().filter(item => item.id !== link.id)
    localStorage.setItem(LOCAL_GUIDES_KEY, JSON.stringify([link, ...rows]))
    window.dispatchEvent(new CustomEvent('trip-guides-updated'))
  } catch { /* local storage may be disabled in private browsing */ }
}

function readLocalGuideGroups():GuideGroup[]{try{const value=JSON.parse(localStorage.getItem(LOCAL_GUIDE_GROUPS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function saveLocalGuideGroup(group:GuideGroup){localStorage.setItem(LOCAL_GUIDE_GROUPS_KEY,JSON.stringify([...readLocalGuideGroups().filter(x=>x.id!==group.id),group]));window.dispatchEvent(new CustomEvent('trip-guide-groups-updated'))}
function removeLocalGuideGroup(id:string){localStorage.setItem(LOCAL_GUIDE_GROUPS_KEY,JSON.stringify(readLocalGuideGroups().filter(x=>x.id!==id)));localStorage.setItem(LOCAL_GUIDES_KEY,JSON.stringify(readLocalGuides().filter(x=>x.group_id!==id)));window.dispatchEvent(new CustomEvent('trip-guide-groups-updated'));window.dispatchEvent(new CustomEvent('trip-guides-updated'))}
function readLocalStays():Accommodation[]{try{const value=JSON.parse(localStorage.getItem(LOCAL_STAYS_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function saveLocalStay(stay:Accommodation){localStorage.setItem(LOCAL_STAYS_KEY,JSON.stringify([...readLocalStays().filter(x=>x.day_number!==stay.day_number),stay]));window.dispatchEvent(new CustomEvent('trip-stays-updated'))}
function randomCover(){return `https://picsum.photos/seed/${crypto.randomUUID()}/720/420`}

function normaliseGuideUrl(value: string) {
  const raw = value.trim()
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  const url = new URL(candidate)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('只支持 http 或 https 链接')
  return url.toString()
}

const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: '今日', icon: Home }, { id: 'trip', label: '行程', icon: CalendarDays },
  { id: 'map', label: '地图', icon: Map }, { id: 'expense', label: '账本', icon: WalletCards },
  { id: 'gallery', label: '图册', icon: Camera },
]

function daysToTrip() {
  const diff = Math.ceil((new Date('2026-09-25T00:00:00+08:00').getTime() - Date.now()) / 86400000)
  if (diff > 0) return `距离出发还有 ${diff} 天`
  if (diff >= -9) return `旅程第 ${Math.abs(diff) + 1} 天`
  return '这趟旅程已结束'
}

function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [selectedDay, setSelectedDay] = useState(2)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [localNotes, setLocalNotes] = useState<CloudNote[]>(readLocalNotes)
  const [localGuides, setLocalGuides] = useState<GuideLink[]>(readLocalGuides)
  const [localGuideGroups,setLocalGuideGroups]=useState<GuideGroup[]>(readLocalGuideGroups)
  const [localStays,setLocalStays]=useState<Accommodation[]>(readLocalStays)
  const backend = useBackend()
  const todayWeather = useCurrentWeather()
  useEffect(() => {
    const syncNotes = () => setLocalNotes(readLocalNotes())
    const syncGuides = () => setLocalGuides(readLocalGuides())
    const syncGroups = () => setLocalGuideGroups(readLocalGuideGroups())
    const syncStays = () => setLocalStays(readLocalStays())
    window.addEventListener('trip-notes-updated', syncNotes)
    window.addEventListener('trip-guides-updated', syncGuides)
    window.addEventListener('trip-guide-groups-updated',syncGroups);window.addEventListener('trip-stays-updated',syncStays)
    return () => { window.removeEventListener('trip-notes-updated', syncNotes); window.removeEventListener('trip-guides-updated', syncGuides);window.removeEventListener('trip-guide-groups-updated',syncGroups);window.removeEventListener('trip-stays-updated',syncStays) }
  }, [])
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try { return JSON.parse(localStorage.getItem('trip-expenses-v2') || '[]') } catch { return [] }
  })
  useEffect(() => {
    if (backend.session) {
      setExpenses(backend.expenses.map(x => ({ id:x.id, title:x.title, category:x.category, payer:x.payer_name, amount:Number(x.amount), date:x.expense_date })))
    }
  }, [backend.expenses, backend.session])
  useEffect(() => { if (!backend.session) localStorage.setItem('trip-expenses-v2', JSON.stringify(expenses)) }, [expenses, backend.session])
  const currentMember = backend.members.find(x => x.user_id === backend.session?.user.id)
  const currentName = currentMember?.display_name || backend.session?.user.email?.split('@')[0] || '我'
  const memberNames = backend.tripId ? backend.members.map(x => x.display_name || '同行人') : backend.session ? [] : ['我']
  const memberCount = memberNames.length
  const notes = useMemo(() => {
    const rows = [...backend.notes, ...localNotes]
    return rows.filter((row, index, all) => all.findIndex(item => item.id === row.id) === index)
  }, [backend.notes, localNotes])
  const guideLinks = useMemo(() => {
    const rows = [...backend.guideLinks, ...localGuides]
    return rows.filter((row, index, all) => all.findIndex(item => item.id === row.id) === index)
  }, [backend.guideLinks, localGuides])
  const guideGroups=useMemo(()=>[...backend.guideGroups,...localGuideGroups].filter((row,index,all)=>all.findIndex(x=>x.id===row.id)===index),[backend.guideGroups,localGuideGroups])
  const accommodations=useMemo(()=>[...backend.accommodations,...localStays].filter((row,index,all)=>all.findIndex(x=>x.day_number===row.day_number)===index),[backend.accommodations,localStays])
  const total = expenses.reduce((sum, x) => sum + x.amount, 0)
  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const optimistic = { ...expense, id: crypto.randomUUID() }
    setExpenses(x => [optimistic, ...x])
    if (backend.session && backend.tripId) { await createExpense(backend.tripId, expense); await backend.refresh() }
  }

  return <div className="app-shell">
    {menuOpen && <button className="sidebar-overlay" aria-label="关闭侧边栏" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Navigation size={19}/></div><div><b>同行</b><span>TRAVEL TOGETHER</span></div></div>
      <button className="close-menu" onClick={() => setMenuOpen(false)}><X /></button>
      <div className="trip-mini"><span className="eyebrow">当前旅程 · {backend.trip ? '云端已同步' : backend.session ? '等待加入' : '本机预览'}</span><strong>{backend.trip?.name || '川西小环线'}</strong><small>2026.09.25 — 10.04</small><div className="travelers">{memberNames.slice(0,5).map((name,i)=><span key={`${name}-${i}`} title={name}>{name.slice(-1)}</span>)}<button aria-label="邀请或加入同伴" onClick={()=>setAuthOpen(true)}><Plus size={13}/></button></div></div>
      <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => {setTab(id);setMenuOpen(false)}}><Icon size={20}/><span>{label}</span>{id === 'expense' && <em>¥{total.toLocaleString()}</em>}</button>)}</nav>
      <div className="side-bottom"><button onClick={downloadOfflineGuide}><Download size={18}/>离线资料包<span className="downloaded">下载清单</span></button><button onClick={()=>setAuthOpen(true)}><Settings size={18}/>旅程设置</button></div>
      <button className="profile" onClick={()=>setAuthOpen(true)}><div className="avatar">{currentName.slice(-1)}</div><div><strong>{currentName}</strong><small>{backend.trip ? `${memberCount} 位同行人 · 云端同步` : backend.session ? '尚未加入旅程' : '点击登录同步'}</small></div><ChevronRight size={18}/></button>
    </aside>

    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}><Menu/></button><div className="mobile-brand">同行 · 川西</div><div className="top-actions"><button className="search"><Search size={18}/>搜索行程、地点和攻略</button><div className="weather-pill"><CloudSun size={18}/><span>成都</span><b>{todayWeather}</b></div><button className="crew" onClick={()=>setAuthOpen(true)}><Users size={18}/><span>{backend.trip ? `${memberCount} 位同行人` : backend.session ? '使用邀请码加入' : '登录同步'}</span></button></div></header>
      {tab === 'home' && <HomeView selectedDay={selectedDay} setSelectedDay={setSelectedDay} setTab={setTab} openAuth={()=>setAuthOpen(true)} currentName={currentName} memberCount={memberCount} connected={Boolean(backend.trip)} tripId={backend.tripId} notes={notes} guideLinks={guideLinks} guideGroups={guideGroups} refresh={backend.refresh} />}
      {tab === 'trip' && <TripView selectedDay={selectedDay} setSelectedDay={setSelectedDay} tripId={backend.tripId} notes={notes} accommodations={accommodations} refresh={backend.refresh} />}
      {tab === 'map' && <MapView />}
      {tab === 'expense' && <ExpenseView expenses={expenses} onAdd={addExpense} cloud={Boolean(backend.trip)} memberNames={memberNames.length ? memberNames : ['我']} />}
      {tab === 'gallery' && <GalleryView tripId={backend.tripId} photos={backend.photos} albums={backend.photoAlbums} cloud={Boolean(backend.trip)} memberCount={memberCount || 1} refresh={backend.refresh} openAuth={()=>setAuthOpen(true)} />}
    </main>

    <nav className="mobile-nav">{navItems.map(({id,label,icon:Icon})=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>

    <button className="ai-fab" onClick={() => setAssistantOpen(!assistantOpen)}><Sparkles size={20}/><span>问问同行助手</span></button>
    {assistantOpen && <Assistant onClose={() => setAssistantOpen(false)} tripId={backend.tripId} authorized={Boolean(backend.session && backend.tripId)} openAuth={()=>setAuthOpen(true)} />}
    {authOpen && <AuthModal backend={backend} onClose={()=>setAuthOpen(false)} />}
  </div>
}

function PageHeading({ eyebrow, title, note, action }: { eyebrow: string; title: string; note: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{note}</p></div>{action}</div>
}

function HomeView({ selectedDay, setSelectedDay, setTab, openAuth, currentName, memberCount, connected, tripId, notes, guideLinks, guideGroups, refresh }: { selectedDay: number; setSelectedDay: (n:number)=>void; setTab:(t:Tab)=>void; openAuth:()=>void; currentName:string; memberCount:number; connected:boolean; tripId:string|null; notes:CloudNote[]; guideLinks:GuideLink[]; guideGroups:GuideGroup[]; refresh:()=>Promise<void> }) {
  const day = tripDays[selectedDay - 1]
  const liveWeather = useTripWeather(day)
  return <div className="page home-page">
    <PageHeading eyebrow={new Intl.DateTimeFormat('zh-CN', { month:'long', day:'numeric', weekday:'long' }).format(new Date())} title={`晚上好，${currentName}`} note={`${daysToTrip()} · ${connected ? `${memberCount} 位同行人的` : '我的'}川西小环线`} action={<button className="outline-button" onClick={openAuth}><Users size={17}/>{connected?'邀请同伴':'登录同步'}</button>} />
    <section className="hero-card">
      <div className="hero-art"><div className="sun"/><div className="mountain m1"/><div className="mountain m2"/><div className="road"/><div className="route-pin p1"/><div className="route-pin p2"/></div>
      <div className="hero-copy"><span className="status-chip"><i/> 行程准备中</span><h2>从成都出发，驶向<br/><em>稻城亚丁</em></h2><p>10 天 · 约 1,800 公里 · {memberCount || 1} 位同行人</p><div className="hero-actions"><button onClick={() => setTab('trip')}>查看完整行程 <ArrowRight size={17}/></button><button onClick={() => setTab('map')}><Map size={17}/>路线地图</button></div></div>
      <div className="countdown"><span>SEP</span><strong>25</strong><small>周五出发</small></div>
    </section>

    <div className="section-title"><div><span className="eyebrow">逐日计划</span><h2>沿途十日</h2></div><button onClick={() => setTab('trip')}>查看全部 <ArrowRight size={16}/></button></div>
    <div className="day-strip">{tripDays.map(d => <button key={d.day} className={selectedDay === d.day ? 'active' : ''} onClick={() => setSelectedDay(d.day)}><span>D{d.day}</span><b>{d.shortDate}</b><small>{d.title.replace('成都','').slice(0,6)}</small></button>)}</div>

    <div className="dashboard-grid">
      <section className="today-plan card">
        <div className="card-top"><div><span className="eyebrow">DAY {day.day} · {day.shortDate}</span><h2>{day.title}</h2></div><span className={`risk ${day.risk}`}>{day.risk}</span></div>
        <div className="route-line"><Route size={18}/>{day.route}</div>
        <div className="timeline">{day.stops.slice(0,4).map((stop, i) => <div className="timeline-item" key={stop.time}><time>{stop.time}</time><div className={`dot ${i===0?'now':''}`}>{i===0?<Navigation size={12}/>:null}</div><div><strong>{stop.title}</strong>{stop.note && <small>{stop.note}</small>}<StopNotes tripId={tripId} dayNumber={day.day} stop={stop} notes={notes} refresh={refresh} compact /></div></div>)}</div>
        <button className="full-button" onClick={() => setTab('trip')}>查看当天详情 <ChevronRight size={17}/></button>
      </section>
      <div className="side-cards">
        <section className="weather-card card"><div className="card-top"><div><span className="eyebrow">目的地天气 · {liveWeather.live ? '实时预报' : '行程预估'}</span><h3>{liveWeather.label} · {liveWeather.temperature}</h3></div><CloudSun size={36}/></div><p>{liveWeather.note}</p><div className="weather-row"><span>海拔 <b>{day.altitude}</b></span><span>降水概率 <b>{liveWeather.rain}</b></span></div></section>
        <section className="decision-card card"><span className="eyebrow">计划适用性</span><div className="score"><strong>{day.risk === '谨慎' ? 72 : day.risk === '留意' ? 84 : 92}</strong><span>/ 100</span></div><h3>{day.risk === '谨慎' ? '建议微调' : '计划仍然适用'}</h3><p>已综合天气、里程、海拔与节假日客流。</p><button onClick={() => setAssistantOpenViaEvent()}>让助手重新评估 <Sparkles size={15}/></button></section>
      </div>
    </div>

    <GuideLibrary tripId={tripId} links={guideLinks} groups={guideGroups} refresh={refresh} />
  </div>
}

function StopNotes({tripId,dayNumber,stop,notes,refresh,compact=false}:{tripId:string|null;dayNumber:number;stop:{time:string;title:string};notes:CloudNote[];refresh:()=>Promise<void>;compact?:boolean}){
  const [editing,setEditing]=useState(false);const [body,setBody]=useState('');const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [status,setStatus]=useState('')
  const rows=notes.filter(n=>n.day_number===dayNumber&&n.stop_time===stop.time)
  const save=async()=>{
    if(!body.trim())return
    setSaving(true);setError('');setStatus('')
    const draft: CloudNote={ id:`local-note-${crypto.randomUUID()}`, day_number:dayNumber, stop_time:stop.time, stop_title:stop.title, body:body.trim() }
    try {
      if (tripId) {
        try { await createNote(tripId,dayNumber,stop.time,stop.title,body) }
        catch { saveLocalNote(draft);setStatus('云端暂不可用，已保存到本机') }
        try { await refresh() } catch { setStatus('已保存，云端刷新稍后重试') }
      } else saveLocalNote(draft)
      setBody('');setEditing(false)
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败') }
    finally { setSaving(false) }
  }
  const remove=async(note:CloudNote)=>{if(!window.confirm('确定删除这条备注吗？'))return;try{if(note.id.startsWith('local-'))removeLocalNote(note.id);else await deleteNote(note.id);await refresh()}catch(e){setError(e instanceof Error?e.message:'删除失败')}}
  return <div className={`stop-notes ${compact?'compact':''}`}>{rows.map(n=><p key={n.id}><span>📝 {n.body}</span><button className="delete-note" aria-label="删除备注" onClick={()=>remove(n)}><Trash2 size={12}/></button></p>)}{status&&<small className="note-status">{status}</small>}{editing?<div className="note-editor"><input autoFocus value={body} onChange={e=>setBody(e.target.value)} placeholder="停车、门票、集合点等…"/><button onClick={save} disabled={saving}>{saving?'保存中':'保存'}</button><button onClick={()=>setEditing(false)}>取消</button>{error&&<small className="note-error">{error}</small>}</div>:<button className="add-note" onClick={()=>setEditing(true)}>添加备注</button>}</div>
}

const presetGuideGroups:GuideGroup[]=guides.map((g,i)=>({id:`preset-${i+1}`,title:g.title,place:g.place,note:g.meta,cover_url:`https://picsum.photos/seed/chuanxi-${i+1}/720/420`,created_at:''}))

function GuideLibrary({tripId,links,groups,refresh}:{tripId:string|null;links:GuideLink[];groups:GuideGroup[];refresh:()=>Promise<void>}){
  const [selected,setSelected]=useState<GuideGroup|null>(null);const [linkOpen,setLinkOpen]=useState(false);const [groupOpen,setGroupOpen]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [status,setStatus]=useState('')
  const allGroups=[...presetGuideGroups,...groups]
  const groupLinks=selected?links.filter(link=>link.group_id===selected.id||(!link.group_id&&selected.id==='preset-1')):[]
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
    e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setSaving(true);setError('')
    try {
      const title=String(f.get('title')||'').trim();const note=String(f.get('note')||'').trim();const platform=String(f.get('platform')||'网页');const url=normaliseGuideUrl(String(f.get('url')||''))
      if (!title) throw new Error('请填写攻略标题')
      const localDraft:GuideLink={id:`local-guide-${crypto.randomUUID()}`,title,url,note,platform,group_id:selected?.id||null,created_at:new Date().toISOString()}
      setStatus('')
      if (tripId) {
        try { await createGuideLink(tripId,{title,url,note,platform,group_id:selected?.id||null}) }
        catch { saveLocalGuide(localDraft);setStatus('云端暂不可用，链接已保存到本机') }
        try { await refresh() } catch { setStatus('链接已保存，云端刷新稍后重试') }
      } else saveLocalGuide(localDraft)
      setLinkOpen(false);form.reset()
    } catch(err){setError(err instanceof Error?err.message:'保存失败')}finally{setSaving(false)}
  }
  const submitGroup=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const draft={title:String(f.get('title')).trim(),place:String(f.get('place')).trim(),note:String(f.get('note')).trim(),cover_url:randomCover()};if(!draft.title)return;setSaving(true);setError('');try{let created:GuideGroup;if(tripId){try{created=await createGuideGroup(tripId,draft)}catch{created={id:`local-group-${crypto.randomUUID()}`,...draft,created_at:new Date().toISOString()};saveLocalGuideGroup(created)}}else{created={id:`local-group-${crypto.randomUUID()}`,...draft,created_at:new Date().toISOString()};saveLocalGuideGroup(created)}await refresh();setGroupOpen(false);setSelected(created);form.reset()}catch(err){setError(err instanceof Error?err.message:'保存失败')}finally{setSaving(false)}}
  const removeSelected=async()=>{if(!selected||selected.id.startsWith('preset-'))return;if(!window.confirm(`确定删除“${selected.title}”吗？分组内的攻略链接也会一起删除。`))return;setSaving(true);setError('');try{if(selected.id.startsWith('local-group-'))removeLocalGuideGroup(selected.id);else{await deleteGuideGroup(selected.id);removeLocalGuideGroup(selected.id)}await refresh();setSelected(null)}catch(err){setError(err instanceof Error?err.message:'删除失败')}finally{setSaving(false)}}
  return <>{selected?<><div className="section-title guides-heading group-detail-heading"><div><button className="back-button" onClick={()=>setSelected(null)}><ArrowLeft size={15}/>返回分组</button><span className="eyebrow">{selected.place||'自定义攻略'}</span><h2>{selected.title}</h2><p className="section-hint">{selected.note||'把相关链接和备注收进这个分组。'}</p>{status&&<p className="guide-status">{status}</p>}{error&&<p className="form-notice error">{error}</p>}</div><div className="group-detail-actions">{!selected.id.startsWith('preset-')&&<button className="delete-group-button" disabled={saving} onClick={removeSelected}><Trash2 size={15}/>删除分组</button>}<button onClick={()=>{setError('');setLinkOpen(true)}}><Plus size={15}/>添加链接</button></div></div><div className="guide-link-list">{groupLinks.length?groupLinks.map(link=><a key={link.id} className="guide-link-row" href={link.url} target="_blank" rel="noreferrer"><span>{link.platform==='小红书'?'📕':link.platform==='抖音'?'🎵':'🔗'}</span><div><small>{link.platform}</small><strong>{link.title}</strong><p>{link.note||'未添加备注'}</p></div><ExternalLink size={16}/></a>):<div className="empty-group"><Link size={24}/><strong>这个分组还没有链接</strong><p>添加小红书、抖音或网页攻略，之后可以直接打开。</p><button onClick={()=>setLinkOpen(true)}><Plus size={15}/>添加第一条</button></div>}</div></>:<><div className="section-title guides-heading"><div><span className="eyebrow">旅途灵感</span><h2>攻略分组</h2><p className="section-hint">每张卡片都是一个可打开的攻略分组，也可以创建自己的卡片。</p></div><button onClick={()=>{setError('');setGroupOpen(true)}}><FolderPlus size={15}/>新增分组</button></div><div className="guide-grid">{allGroups.map(group=>{const count=links.filter(link=>link.group_id===group.id||(!link.group_id&&group.id==='preset-1')).length;return <button key={group.id} className="guide-card guide-group-card" onClick={()=>setSelected(group)}><div className="guide-visual" style={{backgroundImage:`linear-gradient(180deg,transparent,rgba(14,45,38,.48)),url(${group.cover_url})`}}><em>{count} 条攻略</em></div><div><small><MapPin size={13}/>{group.place||'自定义分组'}</small><h3>{group.title}</h3><p>{group.note||'点击进入并添加攻略'}</p><ChevronRight size={15}/></div></button>})}</div></>}
    {linkOpen&&<div className="modal-backdrop" onClick={()=>setLinkOpen(false)}><form className="expense-modal" onSubmit={submit} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setLinkOpen(false)}><X/></button><span className="eyebrow">保存到 · {selected?.title}</span><h2>添加攻略链接</h2><label>平台<select name="platform"><option>小红书</option><option>抖音</option><option>微信公众号</option><option>网页</option></select></label><label>标题<input required name="title" placeholder="例如：亚丁长线避坑攻略"/></label><label>链接<input required name="url" type="text" inputMode="url" autoComplete="url" placeholder="粘贴分享链接（可不带 https://）"/></label><label>备注<textarea name="note" placeholder="停车点、推荐菜、需要提前预约…"/></label>{error&&<p className="form-notice error">{error}</p>}<button className="primary-button" disabled={saving}>{saving?'保存中…':'保存到当前分组'}</button></form></div>}
    {groupOpen&&<div className="modal-backdrop" onClick={()=>setGroupOpen(false)}><form className="expense-modal" onSubmit={submitGroup} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setGroupOpen(false)}><X/></button><span className="eyebrow">自定义攻略卡片</span><h2>新增攻略分组</h2><p className="modal-copy">封面会自动随机生成，创建后可进入分组添加任意链接。</p><label>分组名称<input required name="title" placeholder="例如：成都美食合集"/></label><label>地点<input name="place" placeholder="例如：成都 / 康定"/></label><label>说明<textarea name="note" placeholder="这个分组准备收集什么？"/></label>{error&&<p className="form-notice error">{error}</p>}<button className="primary-button" disabled={saving}>{saving?'创建中…':'创建分组'}</button></form></div>}</>
}

const weatherPlaces: Record<number, [number, number]> = {
  1: [30.67, 104.07], 2: [30.67, 104.07], 3: [31.00, 102.84], 4: [31.00, 102.84],
  5: [30.04, 101.49], 6: [28.46, 100.34], 7: [28.46, 100.34], 8: [29.99, 100.27], 9: [30.05, 101.96], 10: [30.67, 104.07],
}
const weatherLabels: Record<number, string> = { 0:'晴',1:'晴间多云',2:'多云',3:'阴',45:'有雾',48:'雾凇',51:'小雨',53:'小雨',55:'中雨',61:'小雨',63:'中雨',65:'大雨',71:'小雪',73:'中雪',75:'大雪',80:'阵雨',81:'阵雨',82:'强阵雨',95:'雷雨' }

function useCurrentWeather(){
  const [label,setLabel]=useState('更新中')
  useEffect(()=>{const c=new AbortController();fetch('https://api.open-meteo.com/v1/forecast?latitude=30.67&longitude=104.07&current=temperature_2m&timezone=Asia%2FShanghai',{signal:c.signal}).then(r=>r.ok?r.json():Promise.reject()).then(x=>setLabel(`${Math.round(x.current.temperature_2m)}°`)).catch(()=>setLabel('待更新'));return()=>c.abort()},[])
  return label
}

function useTripWeather(day: DayPlan) {
  const [weather, setWeather] = useState({ label: day.weather, temperature: day.temperature, rain: '待更新', note: day.day === 3 ? '折多山可能有雾，建议 15:30 前通过垭口。' : '天气整体适合出行，仍建议携带轻便雨具。', live: false })
  useEffect(() => {
    const [lat, lon] = weatherPlaces[day.day]
    const controller = new AbortController()
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FShanghai&start_date=${day.date}&end_date=${day.date}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const d = data.daily
        const rain = d.precipitation_probability_max?.[0] ?? 0
        const wind = d.wind_speed_10m_max?.[0] ?? 0
        setWeather({ label: weatherLabels[d.weather_code?.[0]] || day.weather, temperature: `${Math.round(d.temperature_2m_min[0])}–${Math.round(d.temperature_2m_max[0])}°`, rain: `${rain}%`, note: rain >= 60 ? `降水概率较高，最大风速约 ${wind} km/h；建议准备备选室内行程。` : `预报降水概率 ${rain}%，最大风速约 ${wind} km/h；出发前请再次刷新。`, live: true })
      }).catch(() => {})
    return () => controller.abort()
  }, [day])
  return weather
}

function setAssistantOpenViaEvent(){ document.querySelector<HTMLButtonElement>('.ai-fab')?.click() }

function TripView({ selectedDay, setSelectedDay, tripId, notes, accommodations, refresh }: { selectedDay:number; setSelectedDay:(n:number)=>void; tripId:string|null; notes:CloudNote[]; accommodations:Accommodation[]; refresh:()=>Promise<void> }) {
  const day = tripDays[selectedDay-1]
  const [stayOpen,setStayOpen]=useState(false)
  const stay=accommodations.find(x=>x.day_number===day.day)
  return <div className="page">
    <PageHeading eyebrow="完整计划" title="十日自驾" note="10 天串联成都、四姑娘山、稻城亚丁与木格措，按天查看路线与提醒。" action={<button className="primary-button"><Plus size={17}/>添加安排</button>} />
    <div className="trip-layout"><div className="trip-days">{tripDays.map(d => <button key={d.day} className={selectedDay===d.day?'active':''} onClick={()=>setSelectedDay(d.day)}><span>D{d.day}</span><div><strong>{d.shortDate} · {d.weekday}</strong><small>{d.title}</small></div><ChevronRight size={18}/></button>)}</div>
      <section className="day-detail card"><div className="day-detail-head"><div><span className="eyebrow">DAY {day.day} · {day.shortDate} · {day.weekday}</span><h2>{day.title}</h2><p><MapPin size={15}/>{day.route}</p></div><span className={`risk ${day.risk}`}>{day.risk}</span></div>
        <div className="stats"><div><Route/><span>里程<b>{day.distance}</b></span></div><div><Navigation/><span>驾驶<b>{day.drive}</b></span></div><button className="stay-stat" onClick={()=>setStayOpen(true)}><BedDouble/><span>住宿 · 点击编辑<b>{stay?.hotel_name||day.stay}</b></span><Pencil size={13}/></button><div><CloudSun/><span>天气<b>{day.weather} {day.temperature}</b></span></div></div>
        <div className="detail-timeline">{day.stops.map((s,i)=><div key={s.time}><time>{s.time}</time><span className="detail-dot">{i+1}</span><article><strong>{s.title}</strong>{s.note&&<p>{s.note}</p>}<StopNotes tripId={tripId} dayNumber={day.day} stop={s} notes={notes} refresh={refresh}/></article></div>)}</div>
      </section></div>{stayOpen&&<StayEditor day={day} stay={stay} tripId={tripId} refresh={refresh} onClose={()=>setStayOpen(false)}/>}
  </div>
}

function StayEditor({day,stay,tripId,refresh,onClose}:{day:DayPlan;stay?:Accommodation;tripId:string|null;refresh:()=>Promise<void>;onClose:()=>void}){
  const [editing,setEditing]=useState(!stay);const [saving,setSaving]=useState(false);const [error,setError]=useState('')
  const hotel=stay?.hotel_name||day.stay;const address=stay?.address||''
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const input={day_number:day.day,hotel_name:String(f.get('hotel_name')).trim(),address:String(f.get('address')).trim(),note:String(f.get('note')).trim()};if(!input.hotel_name)return;setSaving(true);setError('');try{if(tripId){try{await upsertAccommodation(tripId,input)}catch{saveLocalStay({id:`local-stay-${day.day}`,...input})}}else saveLocalStay({id:`local-stay-${day.day}`,...input});await refresh();setEditing(false);onClose()}catch(err){setError(err instanceof Error?err.message:'保存失败')}finally{setSaving(false)}}
  return <div className="modal-backdrop" onClick={onClose}><section className="expense-modal stay-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X/></button><span className="eyebrow">DAY {day.day} · 住宿安排</span><h2>{editing?'编辑酒店':hotel}</h2>{editing?<form onSubmit={submit}><label>酒店名称<input required name="hotel_name" defaultValue={hotel} placeholder="输入已预订酒店名称"/></label><label>详细地址<input name="address" defaultValue={address} placeholder="用于地图搜索和导航"/></label><label>备注<textarea name="note" defaultValue={stay?.note||''} placeholder="房型、停车、联系电话、入住提醒…"/></label>{error&&<p className="form-notice error">{error}</p>}<button className="primary-button" disabled={saving}>{saving?'保存中…':'保存住宿'}</button></form>:<><div className="stay-summary"><BedDouble size={25}/><div><strong>{hotel}</strong><p>{address||'尚未填写详细地址'}</p>{stay?.note&&<small>{stay.note}</small>}</div></div><div className="stay-actions"><button className="outline-button" onClick={()=>setEditing(true)}><Pencil size={15}/>编辑</button><button className="primary-button" onClick={()=>openMap('amap',hotel,address||day.stay)}><Navigation size={15}/>高德导航</button><button className="outline-button" onClick={()=>openMap('baidu',hotel,address||day.stay)}>百度地图</button></div></>}</section></div>
}

const mapStops = [
  {name:'成都',region:'四川省成都市',coords:[30.67,104.07] as [number,number]},
  {name:'四姑娘山双桥沟',region:'阿坝藏族羌族自治州',coords:[31.10,102.83] as [number,number]},
  {name:'丹巴县',region:'甘孜藏族自治州',coords:[30.88,101.89] as [number,number]},
  {name:'墨石公园景区',region:'甘孜藏族自治州',coords:[30.44,101.56] as [number,number]},
  {name:'新都桥镇',region:'甘孜藏族自治州',coords:[30.04,101.49] as [number,number]},
  {name:'理塘县',region:'甘孜藏族自治州',coords:[29.99,100.27] as [number,number]},
  {name:'稻城亚丁景区',region:'甘孜藏族自治州',coords:[28.46,100.34] as [number,number]},
  {name:'康定市',region:'甘孜藏族自治州',coords:[30.05,101.96] as [number,number]},
  {name:'木格措景区',region:'甘孜藏族自治州',coords:[30.15,101.86] as [number,number]},
]
function openMap(provider:'amap'|'baidu',name:string,region:string){
  const url=provider==='amap'
    ? `https://uri.amap.com/search?keyword=${encodeURIComponent(name)}&city=${encodeURIComponent(region)}&src=tongxing.chuanxi&callnative=1`
    : `https://api.map.baidu.com/place/search?query=${encodeURIComponent(name)}&region=${encodeURIComponent(region)}&output=html&src=webapp.tongxing.chuanxi`
  window.open(url,'_blank','noopener,noreferrer')
}
function downloadOfflineGuide(){
  const text=`成都 + 川西十日自驾离线地图准备清单\n\n高德/百度 App 内提前下载：\n- 成都、雅安、泸定\n- 阿坝州：映秀、卧龙、小金、四姑娘山\n- 甘孜州：丹巴、八美、新都桥、雅江、理塘、稻城、亚丁、康定\n\n关键目的地：\n${mapStops.map((x,i)=>`${i+1}. ${x.name}（${x.region}）`).join('\n')}\n\n提示：出发前更新离线数据；点击网页中的地图按钮后，先核对 POI，再开始导航。\n`
  const href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=href;a.download='川西离线地图准备清单.txt';a.click();URL.revokeObjectURL(href)
}
function LiveLocation(){
  const map=useMap();const [position,setPosition]=useState<[number,number]|null>(null);const [accuracy,setAccuracy]=useState<number|null>(null);const [message,setMessage]=useState('定位当前位置')
  const locate=()=>{if(!navigator.geolocation){setMessage('设备不支持定位');return}setMessage('定位中…');navigator.geolocation.getCurrentPosition(pos=>{const next:[number,number]=[pos.coords.latitude,pos.coords.longitude];setPosition(next);setAccuracy(pos.coords.accuracy);map.flyTo(next,Math.max(map.getZoom(),13),{duration:.8});setMessage('已定位当前位置')},()=>setMessage('请允许定位权限'),{enableHighAccuracy:true,timeout:12000,maximumAge:60000})}
  useEffect(()=>{
    if(!navigator.permissions?.query)return
    navigator.permissions.query({name:'geolocation'}).then(status=>{if(status.state==='granted')locate()}).catch(()=>{})
  },[map])
  return <>{position&&<><CircleMarker center={position} radius={20} pathOptions={{color:'#2877d4',weight:1,fillColor:'#2877d4',fillOpacity:.12}}/><CircleMarker center={position} radius={9} pathOptions={{color:'#fff',weight:3,fillColor:'#2877d4',fillOpacity:1}}><Popup><strong>你当前的位置</strong>{accuracy&&<><br/>定位精度约 {Math.round(accuracy)} 米</>}</Popup></CircleMarker></>}<button className="locate-button" aria-label="定位当前所在位置" onClick={locate}><LocateFixed size={17}/>{message}</button></>
}
function MapView(){
  const route=mapStops.map(stop=>stop.coords)
  return <div className="page"><PageHeading eyebrow="路线与实时定位" title="全程地图" note="10 天 · 约 1,800 公里 · 可缩放查看路线并定位当前位置" action={<button className="primary-button" onClick={downloadOfflineGuide}><Download size={17}/>下载离线清单</button>} />
    <section className="real-map card"><MapContainer center={[30.12,102.2]} zoom={7} minZoom={5} maxZoom={16} scrollWheelZoom={false} dragging touchZoom doubleClickZoom><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Polyline positions={route} pathOptions={{color:'#d95d39',weight:4,dashArray:'8 8'}}/>{mapStops.map((stop,i)=><CircleMarker key={stop.name} center={stop.coords} radius={10} pathOptions={{color:'#fff',weight:3,fillColor:'#174f44',fillOpacity:1}}><Popup><strong>D{i===0?'1–2':i+2} · {stop.name}</strong><br/>{stop.region}<br/><button onClick={()=>openMap('amap',stop.name,stop.region)}>用高德导航</button></Popup></CircleMarker>)}<LiveLocation/></MapContainer><div className="map-hint">可拖动、双指缩放地图 · 点击右上角定位当前位置</div></section>
    <section className="offline-panel card"><div><span className="eyebrow">离线准备</span><h2>出发前下载这些区域</h2><p>网页地图需要网络；无信号路段仍应提前在高德或百度地图 App 下载离线包。</p></div><div className="offline-grid">{['成都 · 雅安 · 泸定','阿坝州 · 卧龙 / 四姑娘山','甘孜北线 · 丹巴 / 新都桥','甘孜南线 · 理塘 / 稻城 / 亚丁'].map((x,i)=><label key={x}><span className="check done"><Check size={13}/></span><div><strong>{x}</strong><small>{[520,680,920,1280][i]} MB 预估</small></div></label>)}</div></section>
    <section className="map-destinations card"><div className="card-top"><div><span className="eyebrow">手机导航</span><h2>沿途目的地</h2></div><small>打开后请先核对地点，再开始导航</small></div><div className="destination-grid">{mapStops.map((stop,i)=><article key={stop.name}><span>{i+1}</span><div><strong>{stop.name}</strong><small>{stop.region}</small></div><button onClick={()=>openMap('amap',stop.name,stop.region)}>高德</button><button onClick={()=>openMap('baidu',stop.name,stop.region)}>百度</button></article>)}</div></section>
  </div>
}

function ExpenseView({ expenses, onAdd, cloud, memberNames }: {expenses:Expense[];onAdd:(expense:Omit<Expense,'id'>)=>Promise<void>;cloud:boolean;memberNames:string[]}){
  const [dayFilter,setDayFilter]=useState('all');const shownExpenses=dayFilter==='all'?expenses:expenses.filter(x=>x.date===dayFilter);const total=expenses.reduce((s,x)=>s+x.amount,0); const [showForm,setShowForm]=useState(false); const [showSettlement,setShowSettlement]=useState(false); const count=Math.max(memberNames.length,1); const target=total/count
  const shares=useMemo(()=>memberNames.map((name,i)=>({name,paid:expenses.filter(x=>x.payer===name).reduce((s,x)=>s+x.amount,0), color:['#d95d39','#1e5146','#536b92','#a06b45','#5b769a'][i%5]})),[expenses,memberNames])
  const settlement=useMemo(()=>{const debtors=shares.filter(x=>x.paid<target-.01).map(x=>({name:x.name,n:target-x.paid}));const creditors=shares.filter(x=>x.paid>target+.01).map(x=>({name:x.name,n:x.paid-target}));const rows:{from:string;to:string;amount:number}[]=[];let d=0,c=0;while(d<debtors.length&&c<creditors.length){const amount=Math.min(debtors[d].n,creditors[c].n);rows.push({from:debtors[d].name,to:creditors[c].name,amount});debtors[d].n-=amount;creditors[c].n-=amount;if(debtors[d].n<.01)d++;if(creditors[c].n<.01)c++}return rows},[shares,target])
  return <div className="page"><PageHeading eyebrow={`${count} 人共享账本 · ${cloud?'云端同步':'本机保存'}`} title="旅途花销" note="谁先付款都没关系，最终一键算清。" action={<button className="primary-button" onClick={()=>setShowForm(true)}><Plus size={17}/>记一笔</button>} />
    <div className="expense-summary"><div><span>当前总花销</span><strong>¥ {total.toLocaleString()}</strong><small>预算 ¥12,000 · 已使用 {Math.round(total/120)}%</small><div className="budget-bar"><i style={{width:`${Math.min(total/120,100)}%`}}/></div></div><div><span>人均应付</span><strong>¥ {target.toFixed(2)}</strong><small>根据 {count} 位同行人均摊</small></div></div>
    <div className="expense-layout"><section className="card expense-list"><div className="card-top expense-filter-head"><h2>{dayFilter==='all'?'最近记录':`当日记录 · ${dayFilter.slice(5).replace('-','.')}`}</h2><select aria-label="按日期筛选" value={dayFilter} onChange={e=>setDayFilter(e.target.value)}><option value="all">全部日期</option>{tripDays.map(d=><option key={d.date} value={d.date}>D{d.day} · {d.shortDate}</option>)}</select></div>{shownExpenses.length?shownExpenses.map(x=><div className="expense-item" key={x.id}><span className="expense-icon">{x.category==='住宿'?'🏨':x.category==='交通'?'🚙':'🎫'}</span><div><strong>{x.title}</strong><small>{x.date.length===10?x.date.slice(5).replace('-','.') : x.date} · {x.payer} 付款 · {x.category}</small></div><b>¥{x.amount.toLocaleString()}</b></div>):<p className="empty-expenses">这一天还没有记账。</p>}</section>
      <section className="card split-card"><span className="eyebrow">付款概览</span><h2>{count} 人分摊</h2>{shares.map(x=><div className="share-row" key={x.name}><span style={{background:x.color}}>{x.name.slice(-1)}</span><div><strong>{x.name}</strong><small>已付 ¥{x.paid.toLocaleString()}</small></div><b>{x.paid>target?'应收':'应补'} ¥{Math.abs(x.paid-target).toFixed(0)}</b></div>)}<button className="full-button" onClick={()=>setShowSettlement(x=>!x)}>生成结算方案</button>{showSettlement&&<div className="settlement-box">{settlement.length?settlement.map((x,i)=><p key={i}><strong>{x.from}</strong> 转给 <strong>{x.to}</strong><b>¥{x.amount.toFixed(2)}</b></p>):<p>当前不需要互相转账。</p>}</div>}</section></div>
    {showForm&&<div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="expense-modal" onClick={e=>e.stopPropagation()} onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await onAdd({title:String(f.get('title')),category:String(f.get('category')),payer:String(f.get('payer')),amount:Number(f.get('amount')),date:String(f.get('date'))});setShowForm(false)}}><button type="button" className="modal-close" onClick={()=>setShowForm(false)}><X/></button><span className="eyebrow">共享账本</span><h2>记一笔花销</h2><label>项目<input required name="title" placeholder="例如：今天的火锅"/></label><label>日期<input required name="date" type="date" defaultValue={new Date().toLocaleDateString('en-CA')}/></label><label>金额<input required name="amount" type="number" min="0.01" step="0.01" placeholder="¥ 0.00"/></label><label>分类<select name="category"><option>餐饮</option><option>住宿</option><option>交通</option><option>门票</option><option>其他</option></select></label><label>付款人<select name="payer">{memberNames.map(name=><option key={name}>{name}</option>)}</select></label><button className="primary-button" type="submit">保存并参与均摊</button></form></div>}
  </div>
}

function GalleryView({tripId,photos,albums,cloud,memberCount,refresh,openAuth}:{tripId:string|null;photos:CloudPhoto[];albums:PhotoAlbum[];cloud:boolean;memberCount:number;refresh:()=>Promise<void>;openAuth:()=>void}){
  const [selected,setSelected]=useState('all');const [uploadOpen,setUploadOpen]=useState(false);const [albumOpen,setAlbumOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const shown=selected==='all'?photos:photos.filter(p=>(p.album_id||'none')===selected)
  const handleUpload=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!tripId)return;const f=new FormData(e.currentTarget);const files=Array.from((e.currentTarget.elements.namedItem('photos') as HTMLInputElement).files||[]);setBusy(true);setError('');try{for(const file of files)await uploadPhoto(tripId,file,String(f.get('album')||'')||null);await refresh();setUploadOpen(false)}catch(err){setError(err instanceof Error?err.message:'上传失败')}finally{setBusy(false)}}
  const addAlbum=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!tripId)return;const f=new FormData(e.currentTarget);setBusy(true);setError('');try{const album=await createPhotoAlbum(tripId,{title:String(f.get('title')),note:String(f.get('note'))});await refresh();setSelected(album.id);setAlbumOpen(false)}catch(err){setError(err instanceof Error?err.message:'创建失败')}finally{setBusy(false)}}
  const removeAlbum=async()=>{if(selected==='all'||selected==='none'||!confirm('删除这个相册分组？照片会保留并移到“未分组”。'))return;setBusy(true);try{await deletePhotoAlbum(selected);setSelected('all');await refresh()}catch(err){setError(err instanceof Error?err.message:'删除失败')}finally{setBusy(false)}}
  return <div className="page"><PageHeading eyebrow={`${memberCount} 人共享空间 · ${cloud?'云端原图':'登录后使用'}`} title="旅途图册" note="按相册分组收纳照片，上传时可直接选择分组。" action={cloud?<button className="primary-button" onClick={()=>setUploadOpen(true)}><Plus size={17}/>上传照片</button>:<button className="primary-button" onClick={openAuth}><Users size={17}/>登录后共享</button>} />
    {cloud&&<><div className="album-toolbar"><div className="album-tabs"><button className={selected==='all'?'active':''} onClick={()=>setSelected('all')}>全部 <b>{photos.length}</b></button>{albums.map(a=><button key={a.id} className={selected===a.id?'active':''} onClick={()=>setSelected(a.id)}>{a.title} <b>{photos.filter(p=>p.album_id===a.id).length}</b></button>)}<button className={selected==='none'?'active':''} onClick={()=>setSelected('none')}>未分组 <b>{photos.filter(p=>!p.album_id).length}</b></button></div><div className="album-actions"><button className="outline-button" onClick={()=>setAlbumOpen(true)}><FolderPlus size={15}/>新建相册</button>{!['all','none'].includes(selected)&&<button className="delete-album" disabled={busy} onClick={removeAlbum}><Trash2 size={15}/>删除相册</button>}</div></div>{error&&<p className="form-notice error">{error}</p>}</>}
    {shown.length===0?<section className="empty-gallery"><div className="camera-orbit"><Camera size={38}/></div><h2>{photos.length?'这个分组还没有照片':'故事还没开始'}</h2><p>{cloud?'新建相册后，上传时选择对应分组，后期查看会更清晰。':'登录并加入旅程后可以共享图册。'}</p>{cloud&&<button className="outline-button" onClick={()=>setUploadOpen(true)}><Camera size={17}/>上传照片</button>}</section>:<div className="photo-grid">{shown.map((p,i)=><img key={p.id} src={p.signedUrl} alt={`旅途照片 ${i+1}`}/>)}</div>}
    {uploadOpen&&<div className="modal-backdrop" onClick={()=>setUploadOpen(false)}><form className="expense-modal" onSubmit={handleUpload} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setUploadOpen(false)}><X/></button><span className="eyebrow">共享图册</span><h2>上传照片</h2><label>收入相册<select name="album" defaultValue={!['all','none'].includes(selected)?selected:''}><option value="">未分组</option>{albums.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label><label>选择照片<input required name="photos" type="file" accept="image/*" multiple/></label>{error&&<p className="form-notice error">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'上传中…':'开始上传'}</button></form></div>}
    {albumOpen&&<div className="modal-backdrop" onClick={()=>setAlbumOpen(false)}><form className="expense-modal" onSubmit={addAlbum} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setAlbumOpen(false)}><X/></button><span className="eyebrow">照片分组</span><h2>新建相册</h2><label>相册名称<input required name="title" placeholder="例如：D4 双桥沟"/></label><label>备注<textarea name="note" placeholder="这个相册收录什么？"/></label>{error&&<p className="form-notice error">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'创建中…':'创建相册'}</button></form></div>}
  </div>
}

function Assistant({onClose,tripId,authorized,openAuth}:{onClose:()=>void;tripId:string|null;authorized:boolean;openAuth:()=>void}){ const [messages,setMessages]=useState([{from:'ai',text:authorized?'我已经读过这趟 10 天游程，可以帮你检查天气、高反、堵车和预算。想先看哪一天？':'同行助手仅向这趟旅程的受邀成员开放。请先登录并使用邀请码加入。'}]); const [input,setInput]=useState(''); const [sending,setSending]=useState(false)
  const send=async()=>{if(!authorized||!tripId){openAuth();return}if(!input.trim()||sending)return;const q=input;setMessages(m=>[...m,{from:'me',text:q}]);setInput('');setSending(true);try{const answer=await askTripAgent(tripId,q);setMessages(m=>[...m,{from:'ai',text:answer}])}catch(e){setMessages(m=>[...m,{from:'ai',text:`服务暂时不可用：${e instanceof Error?e.message:'未知错误'}`}])}finally{setSending(false)}}
  return <aside className="assistant"><div className="assistant-head"><div className="ai-icon"><Sparkles/></div><div><strong>同行助手</strong><small><i/> {authorized?'Luna 智能体已连接':'等待成员验证'}</small></div><button onClick={onClose}><X/></button></div><div className="assistant-context"><MapPin size={14}/>{authorized?'正在分析：川西环线 · 10天':'未加入旅程，无法读取计划与账目'}</div><div className="messages">{messages.map((m,i)=><div className={`message ${m.from}`} key={i}>{m.text}</div>)}{sending&&<div className="message ai">正在结合行程和账目分析…</div>}</div><div className="quick-prompts"><button disabled={!authorized} onClick={()=>setInput('D3 天气不好时怎么改？')}>D3 天气不好怎么改？</button><button disabled={!authorized} onClick={()=>setInput('帮我检查高反风险')}>检查高反风险</button></div><div className="chat-input"><input disabled={!authorized} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={authorized?'问路线、天气、预算…':'登录并加入后可提问'}/><button onClick={send}><ArrowRight/></button></div><small className="ai-note">{authorized?'模型只生成修改草案，不会自动覆盖团队行程。':'问答与云端行程只对受邀成员开放。'} {!authorized&&<button onClick={openAuth}>登录 / 输入邀请码</button>}</small></aside>
}

function AuthModal({backend,onClose}:{backend:ReturnType<typeof useBackend>;onClose:()=>void}){
  const [email,setEmail]=useState('');const [code,setCode]=useState('');const [name,setName]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const [codeSent,setCodeSent]=useState(false);const [otp,setOtp]=useState('')
  const existingName=backend.session&&backend.members.find(member=>member.user_id===backend.session?.user.id)?.display_name||''
  const run=async(task:()=>Promise<unknown>,success:string)=>{setBusy(true);setNotice('');try{await task();setNotice(success)}catch(e){setNotice(e instanceof Error?e.message:'操作失败')}finally{setBusy(false)}}
  const sendCode=async()=>{setBusy(true);setNotice('');try{await signInWithEmail(email);setCodeSent(true);setNotice('验证码已发送，请查看邮箱。')}catch(e){setNotice(e instanceof Error?e.message:'发送失败')}finally{setBusy(false)}}
  const verifyCode=async()=>{setBusy(true);setNotice('');try{await verifyEmailOtp(email,otp);setNotice('登录成功，正在同步旅程…')}catch(e){setNotice(e instanceof Error?e.message:'验证码错误或已过期')}finally{setBusy(false)}}
  return <div className="modal-backdrop" onClick={onClose}><section className="expense-modal auth-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X/></button><span className="eyebrow">多人协作后端</span><h2>{backend.session?'账号与旅程':'登录同行'}</h2>{backend.session&&backend.trip&&<div className="name-editor"><label>我的称呼<input value={name||existingName} onChange={e=>setName(e.target.value)} placeholder="例如 小明"/></label><button className="outline-button" disabled={busy||!(name||existingName).trim()} onClick={()=>run(async()=>{await updateMemberName(backend.tripId!,name||existingName);window.location.reload()},'称呼已更新')}>保存称呼</button></div>}
    {!backend.configured?<div className="setup-hint"><strong>还差 Supabase 项目配置</strong><p>代码和数据库已经准备好。复制 <code>.env.example</code> 为 <code>.env.local</code>，填入项目 URL 与 anon key 后重新部署。</p></div>:backend.session?<><div className="signed-in"><Check size={18}/><div><strong>{backend.trip?`已加入 · ${backend.trip.name}`:'账号已登录，尚未加入旅程'}</strong><small>{backend.session.user.email}</small></div></div>{backend.trip?<div className="invite-code"><span>邀请同伴使用</span><strong>{backend.trip.invite_code}</strong><button onClick={()=>navigator.clipboard.writeText(backend.trip!.invite_code)}>复制</button></div>:<p className="join-required">这个账号还不是旅程成员。请输入管理员给你的邀请码；加入前无法使用智能问答、共享账本和云端图册。</p>}<label>{backend.trip?'加入另一趟旅程的邀请码':'旅程邀请码'}<input value={code} onChange={e=>setCode(e.target.value)} placeholder="例如 A1B2C3D4"/></label><label>你的称呼<input value={name} onChange={e=>setName(e.target.value)} placeholder="例如 小明"/></label><button className="primary-button" disabled={busy||!code||!name} onClick={()=>run(async()=>{const id=await joinTrip(code,name);localStorage.setItem('active-trip-id',id);window.location.reload()},'已经加入旅程')}>加入同伴的旅程</button><button className="outline-button auth-signout" onClick={()=>supabase?.auth.signOut()}>退出登录</button></>:codeSent?<><p className="auth-copy">验证码已发送到 <strong>{email}</strong>，请在当前页面完成登录。</p><label>邮箱验证码<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} placeholder="输入邮件中的验证码"/></label><button className="primary-button" disabled={busy||otp.length<6} onClick={verifyCode}>{busy?'验证中…':'验证并登录'}</button><div className="otp-actions"><button onClick={sendCode} disabled={busy}>重新发送</button><button onClick={()=>{setCodeSent(false);setOtp('');setNotice('')}}>更换邮箱</button></div></>:<><p className="auth-copy">输入邮箱获取一次性验证码。登录成功后会记住当前账号，下次打开可直接同步。</p><label>邮箱<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="primary-button" disabled={busy||!email} onClick={sendCode}>{busy?'发送中…':'获取邮箱验证码'}</button></>}
    {notice&&<p className="form-notice">{notice}</p>}{backend.error&&<p className="form-notice error">{backend.error}</p>}
  </section></div>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`))
