import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, CalendarDays, Camera, Check, ChevronRight, CircleDollarSign, CloudSun, Compass, Download, Fuel, Home, Map, MapPin, Menu, MessageCircle, Navigation, Plus, Route, Search, Settings, Sparkles, Users, Utensils, WalletCards, X } from 'lucide-react'
import { defaultExpenses, guides, tripDays, type DayPlan } from './data'
import './styles.css'

type Tab = 'home' | 'trip' | 'map' | 'expense' | 'gallery'
type Expense = (typeof defaultExpenses)[number]

const navItems: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: '今日', icon: Home }, { id: 'trip', label: '行程', icon: CalendarDays },
  { id: 'map', label: '地图', icon: Map }, { id: 'expense', label: '账本', icon: WalletCards },
  { id: 'gallery', label: '图册', icon: Camera },
]

function daysToTrip() {
  const diff = Math.ceil((new Date('2026-09-25T00:00:00+08:00').getTime() - Date.now()) / 86400000)
  if (diff > 0) return `距离出发还有 ${diff} 天`
  if (diff >= -6) return `旅程第 ${Math.abs(diff) + 1} 天`
  return '这趟旅程已结束'
}

function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [selectedDay, setSelectedDay] = useState(2)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try { return JSON.parse(localStorage.getItem('trip-expenses') || 'null') || defaultExpenses } catch { return defaultExpenses }
  })
  useEffect(() => localStorage.setItem('trip-expenses', JSON.stringify(expenses)), [expenses])
  const total = expenses.reduce((sum, x) => sum + x.amount, 0)

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Navigation size={19}/></div><div><b>同行</b><span>TRAVEL TOGETHER</span></div></div>
      <button className="close-menu" onClick={() => setMenuOpen(false)}><X /></button>
      <div className="trip-mini"><span className="eyebrow">当前旅程</span><strong>川西小环线</strong><small>2026.09.25 — 10.01</small><div className="travelers"><span>岚</span><span>明</span><span>北</span><button><Plus size={13}/></button></div></div>
      <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => {setTab(id);setMenuOpen(false)}}><Icon size={20}/><span>{label}</span>{id === 'expense' && <em>¥{total.toLocaleString()}</em>}</button>)}</nav>
      <div className="side-bottom"><button><Download size={18}/>离线资料包<span className="downloaded">已下载</span></button><button><Settings size={18}/>旅程设置</button></div>
      <div className="profile"><div className="avatar">岚</div><div><strong>阿岚</strong><small>行程管理员</small></div><ChevronRight size={18}/></div>
    </aside>

    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}><Menu/></button><div className="mobile-brand">同行 · 川西</div><div className="top-actions"><button className="search"><Search size={18}/>搜索行程、地点和攻略</button><div className="weather-pill"><CloudSun size={18}/><span>成都</span><b>24°</b></div><button className="crew"><Users size={18}/><span>3 位同行人</span></button></div></header>
      {tab === 'home' && <HomeView selectedDay={selectedDay} setSelectedDay={setSelectedDay} setTab={setTab} />}
      {tab === 'trip' && <TripView selectedDay={selectedDay} setSelectedDay={setSelectedDay} />}
      {tab === 'map' && <MapView />}
      {tab === 'expense' && <ExpenseView expenses={expenses} setExpenses={setExpenses} />}
      {tab === 'gallery' && <GalleryView />}
    </main>

    <button className="ai-fab" onClick={() => setAssistantOpen(!assistantOpen)}><Sparkles size={20}/><span>问问同行助手</span></button>
    {assistantOpen && <Assistant onClose={() => setAssistantOpen(false)} />}
  </div>
}

function PageHeading({ eyebrow, title, note, action }: { eyebrow: string; title: string; note: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{note}</p></div>{action}</div>
}

function HomeView({ selectedDay, setSelectedDay, setTab }: { selectedDay: number; setSelectedDay: (n:number)=>void; setTab:(t:Tab)=>void }) {
  const day = tripDays[selectedDay - 1]
  const liveWeather = useTripWeather(day)
  return <div className="page home-page">
    <PageHeading eyebrow={new Intl.DateTimeFormat('zh-CN', { month:'long', day:'numeric', weekday:'long' }).format(new Date())} title="晚上好，阿岚" note={`${daysToTrip()} · 三个人的川西小环线`} action={<button className="outline-button"><Users size={17}/>邀请同伴</button>} />
    <section className="hero-card">
      <div className="hero-art"><div className="sun"/><div className="mountain m1"/><div className="mountain m2"/><div className="road"/><div className="route-pin p1"/><div className="route-pin p2"/></div>
      <div className="hero-copy"><span className="status-chip"><i/> 行程准备中</span><h2>从烟火成都，驶向<br/><em>雪山与草原</em></h2><p>7 天 · 1,058 公里 · 3 位同行人</p><div className="hero-actions"><button onClick={() => setTab('trip')}>查看完整行程 <ArrowRight size={17}/></button><button onClick={() => setTab('map')}><Map size={17}/>路线地图</button></div></div>
      <div className="countdown"><span>SEP</span><strong>25</strong><small>周五出发</small></div>
    </section>

    <div className="section-title"><div><span className="eyebrow">逐日计划</span><h2>沿途七日</h2></div><button onClick={() => setTab('trip')}>查看全部 <ArrowRight size={16}/></button></div>
    <div className="day-strip">{tripDays.map(d => <button key={d.day} className={selectedDay === d.day ? 'active' : ''} onClick={() => setSelectedDay(d.day)}><span>D{d.day}</span><b>{d.shortDate}</b><small>{d.title.replace('成都','').slice(0,6)}</small></button>)}</div>

    <div className="dashboard-grid">
      <section className="today-plan card">
        <div className="card-top"><div><span className="eyebrow">DAY {day.day} · {day.shortDate}</span><h2>{day.title}</h2></div><span className={`risk ${day.risk}`}>{day.risk}</span></div>
        <div className="route-line"><Route size={18}/>{day.route}</div>
        <div className="timeline">{day.stops.slice(0,4).map((stop, i) => <div className="timeline-item" key={stop.time}><time>{stop.time}</time><div className={`dot ${i===0?'now':''}`}>{i===0?<Navigation size={12}/>:null}</div><div><strong>{stop.title}</strong>{stop.note && <small>{stop.note}</small>}</div></div>)}</div>
        <button className="full-button" onClick={() => setTab('trip')}>查看当天详情 <ChevronRight size={17}/></button>
      </section>
      <div className="side-cards">
        <section className="weather-card card"><div className="card-top"><div><span className="eyebrow">目的地天气 · {liveWeather.live ? '实时预报' : '行程预估'}</span><h3>{liveWeather.label} · {liveWeather.temperature}</h3></div><CloudSun size={36}/></div><p>{liveWeather.note}</p><div className="weather-row"><span>海拔 <b>{day.altitude}</b></span><span>降水概率 <b>{liveWeather.rain}</b></span></div></section>
        <section className="decision-card card"><span className="eyebrow">计划适用性</span><div className="score"><strong>{day.risk === '谨慎' ? 72 : day.risk === '留意' ? 84 : 92}</strong><span>/ 100</span></div><h3>{day.risk === '谨慎' ? '建议微调' : '计划仍然适用'}</h3><p>已综合天气、里程、海拔与节假日客流。</p><button onClick={() => setAssistantOpenViaEvent()}>让助手重新评估 <Sparkles size={15}/></button></section>
      </div>
    </div>

    <div className="section-title guides-heading"><div><span className="eyebrow">旅途灵感</span><h2>收藏的攻略</h2></div><button>攻略库 <ArrowRight size={16}/></button></div>
    <div className="guide-grid">{guides.map(g => <article key={g.title} className="guide-card"><div className="guide-visual" style={{backgroundColor:g.color}}><span>{g.emoji}</span><em>{g.tag}</em></div><div><small><MapPin size={13}/>{g.place}</small><h3>{g.title}</h3><p>{g.meta}</p></div></article>)}</div>
  </div>
}

const weatherPlaces: Record<number, [number, number]> = {
  1: [30.67, 104.07], 2: [30.67, 104.07], 3: [30.04, 101.49], 4: [30.88, 101.89],
  5: [31.00, 102.84], 6: [30.99, 103.62], 7: [30.99, 103.62],
}
const weatherLabels: Record<number, string> = { 0:'晴',1:'晴间多云',2:'多云',3:'阴',45:'有雾',48:'雾凇',51:'小雨',53:'小雨',55:'中雨',61:'小雨',63:'中雨',65:'大雨',71:'小雪',73:'中雪',75:'大雪',80:'阵雨',81:'阵雨',82:'强阵雨',95:'雷雨' }

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

function TripView({ selectedDay, setSelectedDay }: { selectedDay:number; setSelectedDay:(n:number)=>void }) {
  const day = tripDays[selectedDay-1]
  return <div className="page">
    <PageHeading eyebrow="完整计划" title="七日行程" note="每一段路程、停靠和住宿，都集中在这里。" action={<button className="primary-button"><Plus size={17}/>添加安排</button>} />
    <div className="trip-layout"><div className="trip-days">{tripDays.map(d => <button key={d.day} className={selectedDay===d.day?'active':''} onClick={()=>setSelectedDay(d.day)}><span>D{d.day}</span><div><strong>{d.shortDate} · {d.weekday}</strong><small>{d.title}</small></div><ChevronRight size={18}/></button>)}</div>
      <section className="day-detail card"><div className="day-detail-head"><div><span className="eyebrow">DAY {day.day} · {day.shortDate} · {day.weekday}</span><h2>{day.title}</h2><p><MapPin size={15}/>{day.route}</p></div><span className={`risk ${day.risk}`}>{day.risk}</span></div>
        <div className="stats"><div><Route/><span>里程<b>{day.distance}</b></span></div><div><Navigation/><span>驾驶<b>{day.drive}</b></span></div><div><Home/><span>住宿<b>{day.stay}</b></span></div><div><CloudSun/><span>天气<b>{day.weather} {day.temperature}</b></span></div></div>
        <div className="detail-timeline">{day.stops.map((s,i)=><div key={s.time}><time>{s.time}</time><span className="detail-dot">{i+1}</span><article><strong>{s.title}</strong>{s.note&&<p>{s.note}</p>}<button>添加备注</button></article></div>)}</div>
      </section></div>
  </div>
}

function MapView(){
  return <div className="page"><PageHeading eyebrow="路线与离线导航" title="全程地图" note="1,058 公里环线 · 建议出发前在高德或百度地图下载对应城市离线包" action={<button className="primary-button"><Download size={17}/>下载离线清单</button>} />
    <section className="map-card"><div className="map-bg"><svg viewBox="0 0 900 480" preserveAspectRatio="none"><path d="M115,120 C210,80 220,330 340,300 S440,80 555,160 S720,350 790,260"/><circle cx="115" cy="120" r="8"/><circle cx="260" cy="265" r="8"/><circle cx="340" cy="300" r="8"/><circle cx="455" cy="125" r="8"/><circle cx="555" cy="160" r="8"/><circle cx="700" cy="320" r="8"/><circle cx="790" cy="260" r="8"/></svg>{['成都','新都桥','塔公','丹巴','四姑娘山','都江堰','成都'].map((x,i)=><span className={`map-label ml${i}`} key={i}>{i+1}<b>{x}</b></span>)}</div>
      <div className="map-panel"><span className="eyebrow">离线准备</span><h3>这些区域需要提前下载</h3>{['成都全市','甘孜州 · 康定 / 新都桥','阿坝州 · 丹巴 / 小金','都江堰及周边'].map((x,i)=><label key={x}><span className="check done"><Check size={13}/></span><div><strong>{x}</strong><small>{[382,646,518,274][i]} MB</small></div></label>)}<p>地图数据需在高德/百度地图 App 内下载；本网站保存地点清单与紧急坐标。</p></div>
    </section>
  </div>
}

function ExpenseView({ expenses, setExpenses }: {expenses:Expense[];setExpenses:React.Dispatch<React.SetStateAction<Expense[]>>}){
  const total=expenses.reduce((s,x)=>s+x.amount,0); const [showForm,setShowForm]=useState(false)
  const shares=useMemo(()=>['小明','阿岚','小北'].map((name,i)=>({name,paid:expenses.filter(x=>x.payer===name).reduce((s,x)=>s+x.amount,0), color:['#d95d39','#1e5146','#536b92'][i]})),[expenses])
  return <div className="page"><PageHeading eyebrow="三人共享账本" title="旅途花销" note="谁先付款都没关系，最终一键算清。" action={<button className="primary-button" onClick={()=>setShowForm(true)}><Plus size={17}/>记一笔</button>} />
    <div className="expense-summary"><div><span>当前总花销</span><strong>¥ {total.toLocaleString()}</strong><small>预算 ¥12,000 · 已使用 {Math.round(total/120)}%</small><div className="budget-bar"><i style={{width:`${Math.min(total/120,100)}%`}}/></div></div><div><span>人均应付</span><strong>¥ {(total/3).toFixed(2)}</strong><small>根据 3 位同行人均摊</small></div></div>
    <div className="expense-layout"><section className="card expense-list"><div className="card-top"><h2>最近记录</h2><button>筛选</button></div>{expenses.map(x=><div className="expense-item" key={x.id}><span className="expense-icon">{x.category==='住宿'?'🏨':x.category==='交通'?'🚙':'🎫'}</span><div><strong>{x.title}</strong><small>{x.date} · {x.payer} 付款 · {x.category}</small></div><b>¥{x.amount.toLocaleString()}</b></div>)}</section>
      <section className="card split-card"><span className="eyebrow">付款概览</span><h2>三人分摊</h2>{shares.map(x=><div className="share-row" key={x.name}><span style={{background:x.color}}>{x.name.slice(-1)}</span><div><strong>{x.name}</strong><small>已付 ¥{x.paid.toLocaleString()}</small></div><b>{x.paid>total/3?'应收':'应补'} ¥{Math.abs(x.paid-total/3).toFixed(0)}</b></div>)}<button className="full-button">生成结算方案</button></section></div>
    {showForm&&<div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="expense-modal" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setExpenses(x=>[...x,{id:Date.now(),title:String(f.get('title')),category:'餐饮',payer:String(f.get('payer')),amount:Number(f.get('amount')),date:'今天'}]);setShowForm(false)}}><button type="button" className="modal-close" onClick={()=>setShowForm(false)}><X/></button><span className="eyebrow">共享账本</span><h2>记一笔花销</h2><label>项目<input required name="title" placeholder="例如：今天的火锅"/></label><label>金额<input required name="amount" type="number" min="0.01" step="0.01" placeholder="¥ 0.00"/></label><label>付款人<select name="payer"><option>阿岚</option><option>小明</option><option>小北</option></select></label><button className="primary-button" type="submit">保存并参与均摊</button></form></div>}
  </div>
}

function GalleryView(){ const [photos,setPhotos]=useState<string[]>([]); return <div className="page"><PageHeading eyebrow="三人共享空间" title="旅途图册" note="原图共同保存，旅行结束后每个人都能下载。" action={<label className="primary-button file-button"><Plus size={17}/>上传照片<input type="file" accept="image/*" multiple onChange={e=>{Array.from(e.target.files||[]).forEach(f=>{const r=new FileReader();r.onload=()=>setPhotos(p=>[...p,String(r.result)]);r.readAsDataURL(f)})}}/></label>} />
    {photos.length===0?<section className="empty-gallery"><div className="camera-orbit"><Camera size={38}/></div><h2>故事还没开始</h2><p>旅途中上传的照片会按日期和地点自动整理。当前原型中的照片只保存在本机浏览器，接入云存储后可与同伴共享。</p><label className="outline-button file-button"><Camera size={17}/>上传第一张照片<input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=()=>setPhotos([String(r.result)]);r.readAsDataURL(f)}}}/></label></section>:<div className="photo-grid">{photos.map((p,i)=><img key={i} src={p} alt={`旅途照片 ${i+1}`}/>)}</div>}
  </div> }

function Assistant({onClose}:{onClose:()=>void}){ const [messages,setMessages]=useState([{from:'ai',text:'晚上好，阿岚。我已经读过 7 天游程，可以帮你检查天气、高反、堵车和预算。想先看哪一天？'}]); const [input,setInput]=useState('')
  const send=()=>{if(!input.trim())return;const q=input;setMessages(m=>[...m,{from:'me',text:q},{from:'ai',text:q.includes('天气')?'目前 D3 翻越折多山的风险最高。建议 15:30 前通过垭口，并把康定设为可撤回点；出发前我还会再核对实时预报。':'我建议保留核心目的地，同时把每天最后一个景点设为“可取消项”。这样遇到堵车或高反时，不需要赶夜路。'}]);setInput('')}
  return <aside className="assistant"><div className="assistant-head"><div className="ai-icon"><Sparkles/></div><div><strong>同行助手</strong><small><i/> 行程上下文已同步</small></div><button onClick={onClose}><X/></button></div><div className="assistant-context"><MapPin size={14}/>正在分析：川西小环线 · 7天</div><div className="messages">{messages.map((m,i)=><div className={`message ${m.from}`} key={i}>{m.text}</div>)}</div><div className="quick-prompts"><button onClick={()=>setInput('D3 天气不好时怎么改？')}>D3 天气不好怎么改？</button><button onClick={()=>setInput('帮我检查高反风险')}>检查高反风险</button></div><div className="chat-input"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="问路线、天气、预算…"/><button onClick={send}><ArrowRight/></button></div><small className="ai-note">当前为本地建议引擎；接入服务端 API 后可获取实时智能规划。</small></aside>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`))
