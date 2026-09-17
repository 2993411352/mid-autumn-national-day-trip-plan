import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, CalendarDays, Camera, Check, ChevronRight, CircleDollarSign, CloudSun, Compass, Download, ExternalLink, Fuel, Home, Link, LocateFixed, Map, MapPin, Menu, MessageCircle, Navigation, Plus, Route, Search, Settings, Sparkles, Users, Utensils, WalletCards, X } from 'lucide-react'
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { guides, tripDays, type DayPlan } from './data'
import { askTripAgent, createExpense, createGuideLink, createNote, joinTrip, signInWithEmail, supabase, updateMemberName, uploadPhoto, verifyEmailOtp, type CloudNote, type CloudPhoto, type GuideLink } from './lib/backend'
import { useBackend } from './hooks/useBackend'
import './styles.css'
import 'leaflet/dist/leaflet.css'

type Tab = 'home' | 'trip' | 'map' | 'expense' | 'gallery'
type Expense = { id: string | number; title: string; category: string; payer: string; amount: number; date: string }

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
  const backend = useBackend()
  const todayWeather = useCurrentWeather()
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try { return JSON.parse(localStorage.getItem('trip-expenses-v2') || '[]') } catch { return [] }
  })
  useEffect(() => {
    if (backend.session) {
      setExpenses(backend.expenses.map(x => ({ id:x.id, title:x.title, category:x.category, payer:x.payer_name, amount:Number(x.amount), date:x.expense_date.slice(5) })))
    }
  }, [backend.expenses, backend.session])
  useEffect(() => { if (!backend.session) localStorage.setItem('trip-expenses-v2', JSON.stringify(expenses)) }, [expenses, backend.session])
  const currentMember = backend.members.find(x => x.user_id === backend.session?.user.id)
  const currentName = currentMember?.display_name || backend.session?.user.email?.split('@')[0] || '我'
  const memberNames = backend.tripId ? backend.members.map(x => x.display_name || '同行人') : backend.session ? [] : ['我']
  const memberCount = memberNames.length
  const total = expenses.reduce((sum, x) => sum + x.amount, 0)
  const addExpense = async (expense: Omit<Expense, 'id' | 'date'>) => {
    const optimistic = { ...expense, id: crypto.randomUUID(), date: '今天' }
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
      {tab === 'home' && <HomeView selectedDay={selectedDay} setSelectedDay={setSelectedDay} setTab={setTab} openAuth={()=>setAuthOpen(true)} currentName={currentName} memberCount={memberCount} connected={Boolean(backend.trip)} tripId={backend.tripId} notes={backend.notes} guideLinks={backend.guideLinks} refresh={backend.refresh} />}
      {tab === 'trip' && <TripView selectedDay={selectedDay} setSelectedDay={setSelectedDay} tripId={backend.tripId} notes={backend.notes} refresh={backend.refresh} />}
      {tab === 'map' && <MapView />}
      {tab === 'expense' && <ExpenseView expenses={expenses} onAdd={addExpense} cloud={Boolean(backend.trip)} memberNames={memberNames.length ? memberNames : ['我']} />}
      {tab === 'gallery' && <GalleryView tripId={backend.tripId} photos={backend.photos} cloud={Boolean(backend.trip)} memberCount={memberCount || 1} refresh={backend.refresh} openAuth={()=>setAuthOpen(true)} />}
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

function HomeView({ selectedDay, setSelectedDay, setTab, openAuth, currentName, memberCount, connected, tripId, notes, guideLinks, refresh }: { selectedDay: number; setSelectedDay: (n:number)=>void; setTab:(t:Tab)=>void; openAuth:()=>void; currentName:string; memberCount:number; connected:boolean; tripId:string|null; notes:CloudNote[]; guideLinks:GuideLink[]; refresh:()=>Promise<void> }) {
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

    <GuideLibrary tripId={tripId} links={guideLinks} refresh={refresh} openAuth={openAuth} />
  </div>
}

function StopNotes({tripId,dayNumber,stop,notes,refresh,compact=false}:{tripId:string|null;dayNumber:number;stop:{time:string;title:string};notes:CloudNote[];refresh:()=>Promise<void>;compact?:boolean}){
  const [editing,setEditing]=useState(false);const [body,setBody]=useState('');const [saving,setSaving]=useState(false)
  const rows=notes.filter(n=>n.day_number===dayNumber&&n.stop_time===stop.time)
  const save=async()=>{if(!tripId){alert('请先登录并加入旅程后再添加共享备注');return}if(!body.trim())return;setSaving(true);try{await createNote(tripId,dayNumber,stop.time,stop.title,body);setBody('');setEditing(false);await refresh()}finally{setSaving(false)}}
  return <div className={`stop-notes ${compact?'compact':''}`}>{rows.map(n=><p key={n.id}>📝 {n.body}</p>)}{editing?<div className="note-editor"><input autoFocus value={body} onChange={e=>setBody(e.target.value)} placeholder="停车、门票、集合点等…"/><button onClick={save} disabled={saving}>{saving?'保存中':'保存'}</button><button onClick={()=>setEditing(false)}>取消</button></div>:<button className="add-note" onClick={()=>setEditing(true)}>添加备注</button>}</div>
}

function GuideLibrary({tripId,links,refresh,openAuth}:{tripId:string|null;links:GuideLink[];refresh:()=>Promise<void>;openAuth:()=>void}){
  const [open,setOpen]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('')
  const submit=async(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!tripId){openAuth();return}const f=new FormData(e.currentTarget);setSaving(true);setError('');try{await createGuideLink(tripId,{title:String(f.get('title')),url:String(f.get('url')),note:String(f.get('note')),platform:String(f.get('platform'))});await refresh();setOpen(false)}catch(err){setError(err instanceof Error?err.message:'保存失败')}finally{setSaving(false)}}
  return <><div className="section-title guides-heading"><div><span className="eyebrow">旅途灵感</span><h2>攻略链接库</h2></div><button onClick={()=>tripId?setOpen(true):openAuth()}><Plus size={15}/>添加链接</button></div>
    <div className="guide-grid">{links.map(link=><a key={link.id} className="guide-card saved-guide" href={link.url} target="_blank" rel="noreferrer"><div className="guide-visual link-visual"><span>{link.platform==='小红书'?'📕':link.platform==='抖音'?'🎵':'🔗'}</span><em>{link.platform}</em></div><div><small><Link size={13}/>点击打开原文</small><h3>{link.title}</h3><p>{link.note||'未添加备注'}</p><ExternalLink size={14}/></div></a>)}{guides.map(g => <article key={g.title} className="guide-card"><div className="guide-visual" style={{backgroundColor:g.color}}><span>{g.emoji}</span><em>{g.tag}</em></div><div><small><MapPin size={13}/>{g.place}</small><h3>{g.title}</h3><p>{g.meta}</p></div></article>)}</div>
    {open&&<div className="modal-backdrop" onClick={()=>setOpen(false)}><form className="expense-modal" onSubmit={submit} onClick={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setOpen(false)}><X/></button><span className="eyebrow">共享攻略库</span><h2>收藏一个攻略</h2><label>平台<select name="platform"><option>小红书</option><option>抖音</option><option>微信公众号</option><option>网页</option></select></label><label>标题<input required name="title" placeholder="例如：亚丁长线避坑攻略"/></label><label>链接<input required name="url" type="url" placeholder="粘贴 https:// 开头的分享链接"/></label><label>备注<textarea name="note" placeholder="停车点、推荐菜、需要提前预约…"/></label>{error&&<p className="form-notice error">{error}</p>}<button className="primary-button" disabled={saving}>{saving?'保存中…':'保存到攻略库'}</button></form></div>}</>
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

function TripView({ selectedDay, setSelectedDay, tripId, notes, refresh }: { selectedDay:number; setSelectedDay:(n:number)=>void; tripId:string|null; notes:CloudNote[]; refresh:()=>Promise<void> }) {
  const day = tripDays[selectedDay-1]
  return <div className="page">
    <PageHeading eyebrow="完整计划" title="十日自驾" note="成都两日慢游，再用八天走完四姑娘山、稻城亚丁与木格措。" action={<button className="primary-button"><Plus size={17}/>添加安排</button>} />
    <div className="trip-layout"><div className="trip-days">{tripDays.map(d => <button key={d.day} className={selectedDay===d.day?'active':''} onClick={()=>setSelectedDay(d.day)}><span>D{d.day}</span><div><strong>{d.shortDate} · {d.weekday}</strong><small>{d.title}</small></div><ChevronRight size={18}/></button>)}</div>
      <section className="day-detail card"><div className="day-detail-head"><div><span className="eyebrow">DAY {day.day} · {day.shortDate} · {day.weekday}</span><h2>{day.title}</h2><p><MapPin size={15}/>{day.route}</p></div><span className={`risk ${day.risk}`}>{day.risk}</span></div>
        <div className="stats"><div><Route/><span>里程<b>{day.distance}</b></span></div><div><Navigation/><span>驾驶<b>{day.drive}</b></span></div><div><Home/><span>住宿<b>{day.stay}</b></span></div><div><CloudSun/><span>天气<b>{day.weather} {day.temperature}</b></span></div></div>
        <div className="detail-timeline">{day.stops.map((s,i)=><div key={s.time}><time>{s.time}</time><span className="detail-dot">{i+1}</span><article><strong>{s.title}</strong>{s.note&&<p>{s.note}</p>}<StopNotes tripId={tripId} dayNumber={day.day} stop={s} notes={notes} refresh={refresh}/></article></div>)}</div>
      </section></div>
  </div>
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
  const map=useMap();const [position,setPosition]=useState<[number,number]|null>(null);const [message,setMessage]=useState('定位我')
  const locate=()=>{if(!navigator.geolocation){setMessage('不支持定位');return}setMessage('定位中…');navigator.geolocation.getCurrentPosition(pos=>{const next:[number,number]=[pos.coords.latitude,pos.coords.longitude];setPosition(next);map.flyTo(next,13);setMessage('已定位')},()=>setMessage('请允许定位权限'),{enableHighAccuracy:true,timeout:12000})}
  return <>{position&&<CircleMarker center={position} radius={9} pathOptions={{color:'#fff',weight:3,fillColor:'#2877d4',fillOpacity:1}}><Popup>你当前的位置</Popup></CircleMarker>}<button className="locate-button" onClick={locate}><LocateFixed size={17}/>{message}</button></>
}
function MapView(){
  const route=mapStops.map(stop=>stop.coords)
  return <div className="page"><PageHeading eyebrow="路线与实时定位" title="全程地图" note="10 天 · 约 1,800 公里 · 可缩放查看路线并定位当前位置" action={<button className="primary-button" onClick={downloadOfflineGuide}><Download size={17}/>下载离线清单</button>} />
    <section className="real-map card"><MapContainer center={[30.12,102.2]} zoom={7} scrollWheelZoom><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Polyline positions={route} pathOptions={{color:'#d95d39',weight:4,dashArray:'8 8'}}/>{mapStops.map((stop,i)=><CircleMarker key={stop.name} center={stop.coords} radius={10} pathOptions={{color:'#fff',weight:3,fillColor:'#174f44',fillOpacity:1}}><Popup><strong>D{i===0?'1–2':i+2} · {stop.name}</strong><br/>{stop.region}<br/><button onClick={()=>openMap('amap',stop.name,stop.region)}>用高德导航</button></Popup></CircleMarker>)}<LiveLocation/></MapContainer></section>
    <section className="offline-panel card"><div><span className="eyebrow">离线准备</span><h2>出发前下载这些区域</h2><p>网页地图需要网络；无信号路段仍应提前在高德或百度地图 App 下载离线包。</p></div><div className="offline-grid">{['成都 · 雅安 · 泸定','阿坝州 · 卧龙 / 四姑娘山','甘孜北线 · 丹巴 / 新都桥','甘孜南线 · 理塘 / 稻城 / 亚丁'].map((x,i)=><label key={x}><span className="check done"><Check size={13}/></span><div><strong>{x}</strong><small>{[520,680,920,1280][i]} MB 预估</small></div></label>)}</div></section>
    <section className="map-destinations card"><div className="card-top"><div><span className="eyebrow">手机导航</span><h2>沿途目的地</h2></div><small>打开后请先核对地点，再开始导航</small></div><div className="destination-grid">{mapStops.map((stop,i)=><article key={stop.name}><span>{i+1}</span><div><strong>{stop.name}</strong><small>{stop.region}</small></div><button onClick={()=>openMap('amap',stop.name,stop.region)}>高德</button><button onClick={()=>openMap('baidu',stop.name,stop.region)}>百度</button></article>)}</div></section>
  </div>
}

function ExpenseView({ expenses, onAdd, cloud, memberNames }: {expenses:Expense[];onAdd:(expense:Omit<Expense,'id'|'date'>)=>Promise<void>;cloud:boolean;memberNames:string[]}){
  const total=expenses.reduce((s,x)=>s+x.amount,0); const [showForm,setShowForm]=useState(false); const [showSettlement,setShowSettlement]=useState(false); const count=Math.max(memberNames.length,1); const target=total/count
  const shares=useMemo(()=>memberNames.map((name,i)=>({name,paid:expenses.filter(x=>x.payer===name).reduce((s,x)=>s+x.amount,0), color:['#d95d39','#1e5146','#536b92','#a06b45','#5b769a'][i%5]})),[expenses,memberNames])
  const settlement=useMemo(()=>{const debtors=shares.filter(x=>x.paid<target-.01).map(x=>({name:x.name,n:target-x.paid}));const creditors=shares.filter(x=>x.paid>target+.01).map(x=>({name:x.name,n:x.paid-target}));const rows:{from:string;to:string;amount:number}[]=[];let d=0,c=0;while(d<debtors.length&&c<creditors.length){const amount=Math.min(debtors[d].n,creditors[c].n);rows.push({from:debtors[d].name,to:creditors[c].name,amount});debtors[d].n-=amount;creditors[c].n-=amount;if(debtors[d].n<.01)d++;if(creditors[c].n<.01)c++}return rows},[shares,target])
  return <div className="page"><PageHeading eyebrow={`${count} 人共享账本 · ${cloud?'云端同步':'本机保存'}`} title="旅途花销" note="谁先付款都没关系，最终一键算清。" action={<button className="primary-button" onClick={()=>setShowForm(true)}><Plus size={17}/>记一笔</button>} />
    <div className="expense-summary"><div><span>当前总花销</span><strong>¥ {total.toLocaleString()}</strong><small>预算 ¥12,000 · 已使用 {Math.round(total/120)}%</small><div className="budget-bar"><i style={{width:`${Math.min(total/120,100)}%`}}/></div></div><div><span>人均应付</span><strong>¥ {target.toFixed(2)}</strong><small>根据 {count} 位同行人均摊</small></div></div>
    <div className="expense-layout"><section className="card expense-list"><div className="card-top"><h2>最近记录</h2><button>筛选</button></div>{expenses.map(x=><div className="expense-item" key={x.id}><span className="expense-icon">{x.category==='住宿'?'🏨':x.category==='交通'?'🚙':'🎫'}</span><div><strong>{x.title}</strong><small>{x.date} · {x.payer} 付款 · {x.category}</small></div><b>¥{x.amount.toLocaleString()}</b></div>)}</section>
      <section className="card split-card"><span className="eyebrow">付款概览</span><h2>{count} 人分摊</h2>{shares.map(x=><div className="share-row" key={x.name}><span style={{background:x.color}}>{x.name.slice(-1)}</span><div><strong>{x.name}</strong><small>已付 ¥{x.paid.toLocaleString()}</small></div><b>{x.paid>target?'应收':'应补'} ¥{Math.abs(x.paid-target).toFixed(0)}</b></div>)}<button className="full-button" onClick={()=>setShowSettlement(x=>!x)}>生成结算方案</button>{showSettlement&&<div className="settlement-box">{settlement.length?settlement.map((x,i)=><p key={i}><strong>{x.from}</strong> 转给 <strong>{x.to}</strong><b>¥{x.amount.toFixed(2)}</b></p>):<p>当前不需要互相转账。</p>}</div>}</section></div>
    {showForm&&<div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="expense-modal" onClick={e=>e.stopPropagation()} onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await onAdd({title:String(f.get('title')),category:String(f.get('category')),payer:String(f.get('payer')),amount:Number(f.get('amount'))});setShowForm(false)}}><button type="button" className="modal-close" onClick={()=>setShowForm(false)}><X/></button><span className="eyebrow">共享账本</span><h2>记一笔花销</h2><label>项目<input required name="title" placeholder="例如：今天的火锅"/></label><label>金额<input required name="amount" type="number" min="0.01" step="0.01" placeholder="¥ 0.00"/></label><label>分类<select name="category"><option>餐饮</option><option>住宿</option><option>交通</option><option>门票</option><option>其他</option></select></label><label>付款人<select name="payer">{memberNames.map(name=><option key={name}>{name}</option>)}</select></label><button className="primary-button" type="submit">保存并参与均摊</button></form></div>}
  </div>
}

function GalleryView({tripId,photos:cloudPhotos,cloud,memberCount,refresh,openAuth}:{tripId:string|null;photos:CloudPhoto[];cloud:boolean;memberCount:number;refresh:()=>Promise<void>;openAuth:()=>void}){ const [localPhotos,setLocalPhotos]=useState<string[]>([]); const photos=cloud?cloudPhotos.map(x=>x.signedUrl).filter(Boolean) as string[]:localPhotos
  const handleFiles=async(files:File[])=>{if(!cloud||!tripId){files.forEach(f=>{const r=new FileReader();r.onload=()=>setLocalPhotos(p=>[...p,String(r.result)]);r.readAsDataURL(f)});return}for(const file of files)await uploadPhoto(tripId,file);await refresh()}
  return <div className="page"><PageHeading eyebrow={`${memberCount} 人共享空间 · ${cloud?'云端原图':'本机预览'}`} title="旅途图册" note="原图共同保存，旅行结束后每个人都能下载。" action={cloud?<label className="primary-button file-button"><Plus size={17}/>上传照片<input type="file" accept="image/*" multiple onChange={e=>handleFiles(Array.from(e.target.files||[]))}/></label>:<button className="primary-button" onClick={openAuth}><Users size={17}/>登录后共享</button>} />
    {photos.length===0?<section className="empty-gallery"><div className="camera-orbit"><Camera size={38}/></div><h2>故事还没开始</h2><p>{cloud?'旅途中上传的原图会安全保存到旅程的私有空间，并向受邀同伴提供临时下载链接。':'登录并使用邀请码加入后，受邀同伴可以共同上传和下载原图；你也可以先在本机预览。'}</p><label className="outline-button file-button"><Camera size={17}/>上传第一张照片<input type="file" accept="image/*" onChange={e=>handleFiles(Array.from(e.target.files||[]))}/></label></section>:<div className="photo-grid">{photos.map((p,i)=><img key={i} src={p} alt={`旅途照片 ${i+1}`}/>)}</div>}
  </div> }

function Assistant({onClose,tripId,authorized,openAuth}:{onClose:()=>void;tripId:string|null;authorized:boolean;openAuth:()=>void}){ const [messages,setMessages]=useState([{from:'ai',text:authorized?'我已经读过这趟 10 天游程，可以帮你检查天气、高反、堵车和预算。想先看哪一天？':'同行助手仅向这趟旅程的受邀成员开放。请先登录并使用邀请码加入。'}]); const [input,setInput]=useState(''); const [sending,setSending]=useState(false)
  const send=async()=>{if(!authorized||!tripId){openAuth();return}if(!input.trim()||sending)return;const q=input;setMessages(m=>[...m,{from:'me',text:q}]);setInput('');setSending(true);try{const answer=await askTripAgent(tripId,q);setMessages(m=>[...m,{from:'ai',text:answer}])}catch(e){setMessages(m=>[...m,{from:'ai',text:`服务暂时不可用：${e instanceof Error?e.message:'未知错误'}`}])}finally{setSending(false)}}
  return <aside className="assistant"><div className="assistant-head"><div className="ai-icon"><Sparkles/></div><div><strong>同行助手</strong><small><i/> {authorized?'Luna 智能体已连接':'等待成员验证'}</small></div><button onClick={onClose}><X/></button></div><div className="assistant-context"><MapPin size={14}/>{authorized?'正在分析：川西环线 · 8天':'未加入旅程，无法读取计划与账目'}</div><div className="messages">{messages.map((m,i)=><div className={`message ${m.from}`} key={i}>{m.text}</div>)}{sending&&<div className="message ai">正在结合行程和账目分析…</div>}</div><div className="quick-prompts"><button disabled={!authorized} onClick={()=>setInput('D3 天气不好时怎么改？')}>D3 天气不好怎么改？</button><button disabled={!authorized} onClick={()=>setInput('帮我检查高反风险')}>检查高反风险</button></div><div className="chat-input"><input disabled={!authorized} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={authorized?'问路线、天气、预算…':'登录并加入后可提问'}/><button onClick={send}><ArrowRight/></button></div><small className="ai-note">{authorized?'模型只生成修改草案，不会自动覆盖团队行程。':'问答与云端行程只对受邀成员开放。'} {!authorized&&<button onClick={openAuth}>登录 / 输入邀请码</button>}</small></aside>
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
