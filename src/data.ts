export type Stop = { time: string; title: string; note?: string; done?: boolean }
export type DayPlan = {
  day: number; date: string; shortDate: string; weekday: string; title: string; route: string;
  distance: string; drive: string; stay: string; altitude: string; weather: string;
  temperature: string; risk: '舒适' | '留意' | '谨慎'; stops: Stop[]
}

export const tripDays: DayPlan[] = [
  { day: 1, date: '2026-09-25', shortDate: '09.25', weekday: '周五', title: '成都城市慢游', route: '人民公园 → 宽窄巷子 → 奎星楼街 → 九眼桥', distance: '18 km', drive: '市内通勤', stay: '成都 · 春熙路', altitude: '500 m', weather: '多云', temperature: '19–26°', risk: '舒适', stops: [
    { time: '09:30', title: '人民公园 · 鹤鸣茶社', note: '喝盖碗茶，避开中午客流' }, { time: '12:00', title: '奎星楼街午饭', note: '冒椒火辣 / 成都吃客' }, { time: '14:00', title: '宽窄巷子', note: '拍照与散步，建议 1.5 小时' }, { time: '20:30', title: '九眼桥夜景' }
  ]},
  { day: 2, date: '2026-09-26', shortDate: '09.26', weekday: '周六', title: '成都经典打卡', route: '熊猫基地 → 武侯祠 / 锦里 → 太古里', distance: '46 km', drive: '约 2 小时', stay: '成都 · 原酒店', altitude: '500 m', weather: '阵雨', temperature: '18–24°', risk: '留意', stops: [
    { time: '07:30', title: '出发去熊猫基地', note: '提前预约，尽量早进' }, { time: '11:30', title: '武侯祠附近午饭' }, { time: '13:00', title: '武侯祠 + 锦里' }, { time: '17:00', title: '春熙路太古里' }, { time: '20:00', title: '成都火锅' }
  ]},
  { day: 3, date: '2026-09-27', shortDate: '09.27', weekday: '周日', title: '翻越折多山', route: '成都 → 雅安 → 泸定 → 康定 → 新都桥', distance: '430 km', drive: '8–9 小时', stay: '新都桥 · 供氧酒店', altitude: '3,460 m', weather: '小雨转晴', temperature: '5–16°', risk: '谨慎', stops: [
    { time: '07:30', title: '成都出发' }, { time: '12:00', title: '康定午饭' }, { time: '14:00', title: '康定补满油', note: '进入高海拔前最后检查' }, { time: '16:30', title: '折多山垭口短停', note: '不跑跳，不久留' }, { time: '18:30', title: '抵达新都桥' }
  ]},
  { day: 4, date: '2026-09-28', shortDate: '09.28', weekday: '周一', title: '草原与异星峡谷', route: '新都桥 → 塔公 → 墨石公园 → 丹巴', distance: '220 km', drive: '5–6 小时', stay: '丹巴县城', altitude: '1,900 m', weather: '晴间多云', temperature: '8–19°', risk: '舒适', stops: [
    { time: '08:30', title: '新都桥出发' }, { time: '10:00', title: '塔公草原' }, { time: '12:00', title: '塔公 / 八美午饭' }, { time: '13:30', title: '墨石公园' }, { time: '16:00', title: '八美视油量补油' }, { time: '18:30', title: '抵达丹巴' }
  ]},
  { day: 5, date: '2026-09-29', shortDate: '09.29', weekday: '周二', title: '深入双桥沟', route: '丹巴 → 四姑娘山双桥沟 → 日隆镇', distance: '140 km', drive: '4–5 小时', stay: '日隆镇', altitude: '3,160 m', weather: '多云', temperature: '4–15°', risk: '留意', stops: [
    { time: '08:30', title: '丹巴出发' }, { time: '11:30', title: '四姑娘山镇午饭' }, { time: '13:00', title: '双桥沟', note: '门票 + 观光车，带保温水' }, { time: '17:30', title: '离开景区' }, { time: '18:00', title: '日隆镇入住' }
  ]},
  { day: 6, date: '2026-09-30', shortDate: '09.30', weekday: '周三', title: '沿熊猫走廊下山', route: '日隆 → 卧龙 → 映秀 → 都江堰', distance: '180 km', drive: '4–5 小时', stay: '都江堰', altitude: '700 m', weather: '小雨', temperature: '16–22°', risk: '留意', stops: [
    { time: '09:00', title: '日隆镇出发' }, { time: '12:00', title: '映秀午饭' }, { time: '14:00', title: '映秀 / 都江堰补油' }, { time: '16:00', title: '抵达都江堰' }, { time: '19:00', title: '灌县古城晚饭' }
  ]},
  { day: 7, date: '2026-10-01', shortDate: '10.01', weekday: '周四', title: '山水收尾，返回成都', route: '都江堰 / 青城山 → 成都', distance: '70 km', drive: '1.5–2 小时', stay: '旅程结束', altitude: '500–1,260 m', weather: '阴', temperature: '17–23°', risk: '舒适', stops: [
    { time: '08:30', title: '酒店出发' }, { time: '09:00', title: '都江堰或青城山', note: '根据体力二选一' }, { time: '13:00', title: '午饭后返蓉' }, { time: '15:30', title: '抵达成都' }
  ]}
]

export const guides = [
  { tag: '必吃', title: '奎星楼街小吃路线', place: '成都', meta: '步行 1.2 km · 6 家店', emoji: '🌶️', color: '#d95d39' },
  { tag: '观景', title: '新都桥日落机位', place: '新都桥', meta: '日落前 50 分钟抵达', emoji: '🏔️', color: '#52796f' },
  { tag: '避坑', title: '折多山停车与高反', place: '康定', meta: '停留不超过 30 分钟', emoji: '🫁', color: '#536b92' },
  { tag: '酒店', title: '高海拔住宿检查表', place: '新都桥', meta: '供氧 · 热水 · 电热毯', emoji: '🛏️', color: '#9a6b4a' },
]

export const defaultExpenses = [
  { id: 1, title: '成都酒店 · 2晚', category: '住宿', payer: '小明', amount: 1280, date: '09.25' },
  { id: 2, title: '租车订金', category: '交通', payer: '阿岚', amount: 800, date: '09.24' },
  { id: 3, title: '双桥沟门票', category: '门票', payer: '小北', amount: 450, date: '09.29' },
]
