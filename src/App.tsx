import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
//  HEMS 能效管家 — 用户版 v3
//  Matter 1.x · 边缘本地 · 隐私不上云
//  策略 A–H：时移 / 热惯性 / 光感 / RLHF / EV绿电 /
//            小电器排程 / 预冷预热 / 非线性节能
// ═══════════════════════════════════════════════════════════════

// ── 电网 / 环境 24h 模拟数据 ────────────────────────────────
const TARIFF_24H = [.3,.3,.3,.3,.3,.3,.5,.8,1,1.2,1.2,1,.8,.8,1,1.2,1.2,1.2,1,.8,.6,.5,.4,.3];
const CARBON_24H = [380,350,320,300,290,310,400,520,600,650,640,580,500,480,520,600,650,640,580,500,450,420,400,390];
const LUX_24H    = [0,0,0,0,10,100,500,2e3,8e3,15e3,2e4,25e3,3e4,28e3,22e3,15e3,8e3,3e3,500,50,10,0,0,0];
const RENEW_24H  = [55,60,65,68,70,65,45,30,20,15,18,22,30,35,28,20,22,25,35,40,50,55,58,57];

// 【优化3】次日天气预报模拟（生产环境替换为天气 API）
const TOMORROW_WEATHER = {
  hourlyTemp:  [22,21,21,21,22,23,25,28,31,34,36,38,39,40,39,37,35,33,30,28,26,25,24,23],
  hourlyHumid: [70,72,74,75,73,68,60,52,45,40,38,36,35,34,36,38,40,42,48,52,58,62,65,68],
  desc: "晴转多云，午后高温 40°C",
};

const tColor = t => t <= .4 ? "#34d399" : t <= .8 ? "#fbbf24" : "#f87171";
const tLabel = t => t <= .4 ? "谷" : t <= .8 ? "平" : "峰";
const fmtH   = (h, m = 0) => String(Math.floor(h) % 24).padStart(2, "0") + ":" + String(m).padStart(2, "0");

// ── 设备模板 ─────────────────────────────────────────────────
const DEVICE_TEMPLATES = [
  { type:"ac",         label:"空调/暖通",   icon:"❄️", matterCluster:"0x0201", matterType:"0x0301", defaultRated:2200, variable:true,  shiftable:false, chargeable:false, strategy:"B/G" },
  { type:"heater",     label:"电热水器",   icon:"🔥", matterCluster:"0x0201", matterType:"0x050F", defaultRated:3000, variable:false, shiftable:true,  chargeable:false, strategy:"A" },
  { type:"washer",     label:"洗衣机",     icon:"🌀", matterCluster:"0x0055", matterType:"0x007C", defaultRated:500,  variable:false, shiftable:true,  chargeable:false, strategy:"A", cycleMins:60 },
  { type:"dishwasher", label:"洗碗机",     icon:"🍽️", matterCluster:"0x0055", matterType:"0x0075", defaultRated:1800, variable:false, shiftable:true,  chargeable:false, strategy:"A", cycleMins:45 },
  { type:"light",      label:"照明灯具",   icon:"💡", matterCluster:"0x0008", matterType:"0x0100", defaultRated:100,  variable:true,  shiftable:false, chargeable:false, strategy:"C/H" },
  { type:"fridge",     label:"冰箱",       icon:"🧊", matterCluster:"0x0055", matterType:"0x0070", defaultRated:150,  variable:false, shiftable:false, chargeable:false, strategy:"—" },
  // 【优化2】新增小电器类别
  { type:"robot",      label:"扫地机器人", icon:"🤖", matterCluster:"0x0055", matterType:"0x0072", defaultRated:40,   variable:false, shiftable:true,  chargeable:true,  strategy:"F", cycleMins:90  },
  { type:"airpurifier",label:"空气净化器", icon:"💨", matterCluster:"0x0055", matterType:"0x002B", defaultRated:45,   variable:true,  shiftable:true,  chargeable:true,  strategy:"F/H" },
  { type:"tv",         label:"电视/显示器",icon:"📺", matterCluster:"0x0008", matterType:"0x0028", defaultRated:120,  variable:true,  shiftable:false, chargeable:false, strategy:"H" },
  { type:"inverterac", label:"变频空调",   icon:"🌬️", matterCluster:"0x0201", matterType:"0x0302", defaultRated:1800, variable:true,  shiftable:false, chargeable:false, strategy:"B/G/H" },
];

// ── Matter 指令模拟器 ─────────────────────────────────────────
const MatterBus = {
  send(device, command, payload = {}) {
    const ts     = new Date().toISOString().slice(11, 19);
    const nodeId = device.id.replace("dev_", "node_");
    const cluster= device.matterCluster || "0x0006";
    const pStr   = Object.entries(payload).map(([k,v]) => `${k}=${v}`).join(" ");
    return `[matter ${ts}] >> nodeId=${nodeId} cluster=${cluster} type=${device.matterType} cmd=${command}${pStr?" "+pStr:""}`;
  },
  cmdShiftOn(d)      { return MatterBus.send(d, "OnWithTimedOff",    { onTime:d.cycleMins||60, offWaitTime:0 }); },
  cmdOn(d)           { return MatterBus.send(d, "On"); },
  cmdOff(d)          { return MatterBus.send(d, "Off"); },
  cmdSetTemp(d,t)    { return MatterBus.send(d, "SetpointRaiseLower",{ mode:0, amount:Math.round(t*100) }); },
  cmdSetLevel(d,pct) { return MatterBus.send(d, "MoveToLevel",       { level:Math.round(pct/100*254), transitionTime:10 }); },
  cmdSetFreq(d,hz)   { return MatterBus.send(d, "SetFrequency",      { frequency:hz }); },
  cmdEVStart(d)      { return MatterBus.send(d, "EnableCharging",    { maxChargingCurrent:32 }); },
  cmdEVStop(d)       { return MatterBus.send(d, "DisableCharging"); },
};


// ══════════════════════════════════════════════════════════════
//  边缘网关 AI 决策模块 (GatewayAPI)
//  生产环境：提取为独立服务，接口见顶部注释
// ══════════════════════════════════════════════════════════════
const GatewayAPI = (() => {
  const _s = {
    targetTemp: 25, comfortWeight: 0.5, feedbackLog: [],
    // 【优化4】房屋热力学模型
    houseModel: {
      area: 80,           // m²
      insulation: 0.6,    // 0=差保温 1=完美保温（用户可调）
      coolingRate: null,  // 自动推算 °C/h（null=尚未标定）
      calibrated: false,
    },
  };

  return {
    // ── 策略A：时移调度 ──────────────────────────────────────
    evalTimeShift(hour, device) {
      if (!device.shiftable) return null;
      const t = TARIFF_24H[hour];
      if (t <= .5) return null;
      for (let i = 1; i < 12; i++) {
        const h = (hour+i)%24;
        if (TARIFF_24H[h] <= .4) return { shift:true, to:h, saving:+((t-TARIFF_24H[h])*device.rated/1000).toFixed(2) };
      }
      return null;
    },

    // ── 策略B：热惯性调节 ────────────────────────────────────
    evalThermal(hour) {
      const { targetTemp, comfortWeight } = _s;
      const t = TARIFF_24H[hour];
      let target = targetTemp, mode = "normal";
      if (t <= .4)  { target = targetTemp - 1.5; mode = "precool"; }
      else if (t >= 1) { target = targetTemp + (1-comfortWeight)*1.5; mode = "drift"; }
      return { target: Math.round(target*10)/10, mode };
    },

    // ── 策略C：自然光补偿 ────────────────────────────────────
    evalLight(hour) {
      const n = LUX_24H[hour], tgt = 400;
      return n >= tgt ? 0 : Math.min(100, Math.round((tgt-n)/tgt*100));
    },

    // ── 策略D：RLHF 舒适度 ──────────────────────────────────
    feedback(type) {
      const ts = new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"});
      if (type==="cold")     { _s.comfortWeight=Math.min(1,_s.comfortWeight+.1); _s.targetTemp=Math.min(30,_s.targetTemp+.5); }
      else if (type==="hot") { _s.comfortWeight=Math.min(1,_s.comfortWeight+.1); _s.targetTemp=Math.max(20,_s.targetTemp-.5); }
      else                   { _s.comfortWeight=Math.max(.2,_s.comfortWeight-.05); }
      _s.feedbackLog.unshift({ type, ts, target:_s.targetTemp, weight:_s.comfortWeight });
      if (_s.feedbackLog.length>30) _s.feedbackLog.pop();
      return { target:_s.targetTemp, weight:_s.comfortWeight };
    },

    // ── 策略E：EV 绿电优先排程 ──────────────────────────────
    evalEV({ curSoc, targetPct, depHour, curHour, batKwh=75, chargerKw=7.4 }) {
      const neededKwh = Math.max(0,(targetPct-curSoc)/100*batKwh);
      if (neededKwh<=0) return { neededKwh:0,startHour:curHour,endHour:curHour,endMin:0,cost:0,peakCost:0,saving:0,greenPct:0,carbonKg:0,plan:[],scores:TARIFF_24H.map(()=>0) };
      const neededH = neededKwh/chargerKw;
      const scores  = TARIFF_24H.map((t,h)=>+(((1.3-t)/1.0)*0.55+(RENEW_24H[h]/70)*0.45).toFixed(3));
      let best=-Infinity, bestH=curHour;
      const windowEnd = depHour>curHour?depHour:depHour+24;
      for (let h=curHour; h<=windowEnd-neededH; h++) {
        let s=0;
        for (let j=0;j<Math.ceil(neededH);j++) { const frac=j===Math.floor(neededH)?(neededH%1||1):1; s+=scores[(h+j)%24]*frac; }
        if (s>best) { best=s; bestH=h%24; }
      }
      let cost=0,greenSum=0,rolSoc=curSoc; const plan=[];
      for (let j=0;j<Math.ceil(neededH);j++) {
        const h=(bestH+j)%24, frac=j===Math.floor(neededH)?(neededH%1||1):1, kwh=+(chargerKw*frac).toFixed(2);
        cost+=TARIFF_24H[h]*kwh; greenSum+=RENEW_24H[h]/100*frac; rolSoc=Math.min(100,rolSoc+kwh/batKwh*100);
        plan.push({ hour:h, timeLabel:fmtH(bestH+j), kwh, tariff:TARIFF_24H[h], renew:RENEW_24H[h], soc:Math.round(rolSoc) });
      }
      const greenPct=Math.round(greenSum/neededH*100), peakCost=+(neededKwh*1.2).toFixed(2);
      const carbonKg=+(neededKwh*(1-greenPct/100)*0.48+neededKwh*(greenPct/100)*0.05).toFixed(2);
      return { neededKwh:+neededKwh.toFixed(1),neededH:+neededH.toFixed(2),startHour:bestH,
        endHour:(bestH+Math.floor(neededH))%24,endMin:Math.round((neededH%1)*60),
        cost:+cost.toFixed(2),peakCost,saving:+(peakCost-cost).toFixed(2),greenPct,carbonKg,plan,scores };
    },

    // ── 策略F：小电器绿电充电排程 ────────────────────────────
    // 同 EV 算法，但针对低功耗小电器（扫地机、净化器等）
    evalSmallDevice(device, curHour) {
      const scores = TARIFF_24H.map((t,h)=>+(((1.3-t)/1.0)*0.55+(RENEW_24H[h]/70)*0.45).toFixed(3));
      const maxS   = Math.max(...scores);
      let bestH = curHour;
      for (let i=0;i<12;i++) { const h=(curHour+i)%24; if (scores[h]>=maxS*0.9) { bestH=h; break; } }
      const runKwh = device.rated/1000 * (device.cycleMins||60)/60;
      const nowCost= runKwh*TARIFF_24H[curHour];
      const bestCost=runKwh*TARIFF_24H[bestH];
      return { bestHour:bestH, runKwh:+runKwh.toFixed(3), saving:+(nowCost-bestCost).toFixed(3),
               greenPct:RENEW_24H[bestH], tariff:TARIFF_24H[bestH] };
    },

    // ── 策略G：预冷/预热（次日天气联动） ────────────────────
    // 扫描次日天气，若高温高峰期电价贵，提前在绿电充足时段预冷
    evalPrecool(targetTemp) {
      const temps   = TOMORROW_WEATHER.hourlyTemp;
      const peakTemp= Math.max(...temps);
      const peakH   = temps.indexOf(peakTemp);
      if (peakTemp < 35) return { needed:false, peakTemp, peakH };

      // 找高峰前 3h 内绿电最佳、电价最低的启动时刻
      let bestScore=-Infinity, startH=Math.max(0,peakH-4);
      for (let h=Math.max(0,peakH-5); h<peakH-1; h++) {
        const s = (1-TARIFF_24H[h])*0.5 + RENEW_24H[h]/100*0.5;
        if (s>bestScore) { bestScore=s; startH=h; }
      }
      const precoolTarget = targetTemp - 2.0;
      const { insulation } = _s.houseModel;
      // 【优化4】保温差时缩短预冷时段，改为即时制冷
      const duration = insulation < 0.4 ? 1 : insulation < 0.65 ? 2 : 3;
      const saving   = +((peakTemp-targetTemp)*0.08*(1-TARIFF_24H[startH]/1.2)).toFixed(2);
      return { needed:true, peakTemp, peakH, startH, precoolTarget:Math.round(precoolTarget*10)/10, duration, insulation, saving };
    },

    // ── 策略H：非线性节能 ────────────────────────────────────
    // 光感联动 / COP 最优区 / 变频平滑
    evalNonlinear(device, hour) {
      if (device.type==="light" || device.type==="tv") {
        // 光感联动：外部光强每+10% → 室内亮度-15%（人眼韦伯定律）
        const outdoor = LUX_24H[hour];
        const baseline= 60; // 用户设定基础亮度%
        const luxRatio = Math.min(1, outdoor / 30000);
        const adjusted = Math.max(10, Math.round(baseline * (1 - luxRatio * 0.6)));
        const savedPct = Math.round((baseline - adjusted) / baseline * 100);
        return { strategy:"光感联动", adjusted, savedPct, outdoor };
      }
      if (device.type==="inverterac") {
        // 变频空调 COP 最优区：频率稳定在 45–55Hz 时效率最高（COP≈4.2）
        const tariffNow = TARIFF_24H[hour];
        const targetHz  = tariffNow <= .5 ? 52 : tariffNow <= .9 ? 48 : 44;
        const copNow    = targetHz >= 50 ? 4.2 : targetHz >= 46 ? 3.9 : 3.5;
        const copBaseline= 3.2;
        const saving    = +((1-copBaseline/copNow)*device.rated/1000).toFixed(3);
        return { strategy:"变频COP优化", targetHz, copNow, copBaseline, saving };
      }
      if (device.type==="airpurifier") {
        // 净化器：PM2.5 低时降低风速 → 功耗 ∝ 风速³ (fan law)
        const speedPct = hour>=8&&hour<=22 ? 60 : 35;
        const savingPct= Math.round((1-(speedPct/100)**3)*100);
        return { strategy:"风机律节能", speedPct, savingPct };
      }
      return null;
    },

    // ── 工具 getter ──────────────────────────────────────────
    getTargetTemp()    { return _s.targetTemp; },
    getComfortWeight() { return _s.comfortWeight; },
    getFeedbackLog()   { return _s.feedbackLog; },
    getHouseModel()    { return _s.houseModel; },
    setInsulation(v)   { _s.houseModel.insulation = v; },
    calibrateCoolingRate(deltaT, hours) {
      // 实测：关空调后 T 小时内温升 deltaT°C → 推算每小时自然升温率
      _s.houseModel.coolingRate = +(deltaT/hours).toFixed(2);
      _s.houseModel.calibrated  = true;
      return _s.houseModel.coolingRate;
    },
  };
})();


// ── 累计节省 + 碳减排 Hook ────────────────────────────────────
function useSavingsCounter() {
  const [totalSaved,   setTotalSaved]   = useState(0);
  const [totalCarbonG, setTotalCarbonG] = useState(0); // g CO₂
  const [flash,        setFlash]        = useState(false);
  const timerRef = useRef(null);
  const addSaving = (yuan, carbonG = 0) => {
    if (yuan > 0)    setTotalSaved(v   => +(v+yuan).toFixed(2));
    if (carbonG > 0) setTotalCarbonG(v => Math.round(v+carbonG));
    setFlash(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlash(false), 900);
  };
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return { totalSaved, totalCarbonG, addSaving, flash };
}


// ══════════════════════════════════════════════════════════════
//  主应用
// ══════════════════════════════════════════════════════════════
export default function HEMSApp() {
  const [devices, setDevices]             = useState([]);
  const [page, setPage]                   = useState("home");
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showAddForm, setShowAddForm]     = useState(null);
  const [formData, setFormData]           = useState({ name:"", room:"", rated:"" });
  const [logs, setLogs]                   = useState([]);
  const [, forceUpdate]                   = useState(0);
  const [insulation, setInsulationState]  = useState(0.6);

  // EV
  const [evSoc, setEvSoc]         = useState(62);
  const [evTarget, setEvTarget]   = useState(90);
  const [evDepHour, setEvDepHour] = useState(8);
  const [evConnected, setEvConn]  = useState(true);
  const [evScheduled, setEvSched] = useState(false);

  const { totalSaved, totalCarbonG, addSaving, flash } = useSavingsCounter();

  const now    = new Date();
  const hour   = now.getHours();
  const tariff = TARIFF_24H[hour];

  const addLog = (msg, matterCmd=null) => {
    const ts = new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    setLogs(prev => [{ ts, msg, matterCmd },...prev].slice(0,100));
  };

  const addDevice = (tpl) => { setShowAddForm(tpl); setFormData({ name:"", room:"", rated:String(tpl.defaultRated) }); };
  const confirmAdd = () => {
    if (!formData.name.trim()||!formData.room.trim()) return;
    const t = showAddForm;
    const d = { id:`dev_${Date.now()}`, name:formData.name.trim(), room:formData.room.trim(),
      type:t.type, icon:t.icon, matterType:t.matterType, matterCluster:t.matterCluster,
      rated:parseInt(formData.rated)||t.defaultRated,
      variable:t.variable, shiftable:t.shiftable, chargeable:t.chargeable, strategy:t.strategy,
      cycleMins:t.cycleMins||0, on:false, power:0, shifted:false, shiftTo:null, brightness:0 };
    setDevices(p=>[...p,d]); setShowAddForm(null); setShowAddModal(false);
    addLog("已添加设备: "+d.name+" ("+t.label+") → "+d.room, MatterBus.send(d,"Identify",{identifyTime:5}));
  };
  const removeDevice = (id) => {
    const d = devices.find(x=>x.id===id);
    setDevices(p=>p.filter(x=>x.id!==id));
    if (d) addLog("已移除: "+d.name, MatterBus.cmdOff(d));
  };
  const requestStart = (id) => {
    const d = devices.find(x=>x.id===id); if (!d||!d.shiftable) return;
    const r = GatewayAPI.evalTimeShift(hour, d);
    setDevices(p=>p.map(x=>{
      if (x.id!==id) return x;
      if (r&&r.shift) {
        const carbonG = Math.round(r.saving/TARIFF_24H[hour]*CARBON_24H[r.to]);
        addSaving(r.saving, carbonG);
        addLog(d.name+" 延迟至 "+r.to+":00 谷价启动 (省 ¥"+r.saving+")", MatterBus.cmdShiftOn(d));
        return {...x, shifted:true, shiftTo:r.to};
      } else {
        addLog(d.name+" 当前低价，立即启动", MatterBus.cmdOn(d));
        return {...x, on:true, power:x.rated};
      }
    }));
  };
  const stopDevice = (id) => {
    const d = devices.find(x=>x.id===id);
    setDevices(p=>p.map(x=>x.id===id?{...x,on:false,power:0,shifted:false,shiftTo:null}:x));
    if (d) addLog(d.name+" 已停止", MatterBus.cmdOff(d));
  };
  const handleFeedback = (type) => {
    const r = GatewayAPI.feedback(type);
    addLog("舒适度反馈: "+(type==="cold"?"偏冷":type==="hot"?"偏热":"舒适")+" → 目标"+r.target+"°C");
    devices.filter(d=>d.type==="ac"&&d.on).forEach(d=>
      addLog("↳ "+d.name+" → "+r.target+"°C", MatterBus.cmdSetTemp(d,r.target)));
    forceUpdate(x=>x+1);
  };
  const handleInsulation = (v) => {
    const val = parseFloat(v);
    setInsulationState(val);
    GatewayAPI.setInsulation(val);
    forceUpdate(x=>x+1);
  };

  const activeDevices  = devices.filter(d=>d.on);
  const shiftedDevices = devices.filter(d=>d.shifted);
  const totalPower     = devices.reduce((s,d)=>s+d.power,0);
  const hasDevices     = devices.length>0;
  const evResult       = GatewayAPI.evalEV({curSoc:evSoc,targetPct:evTarget,depHour:evDepHour,curHour:hour});
  const precoolResult  = GatewayAPI.evalPrecool(GatewayAPI.getTargetTemp());
  const matterCount    = logs.filter(l=>l.matterCmd).length;
  const houseModel     = GatewayAPI.getHouseModel();

  const C = {
    bg:"#f6f7f9", card:"#ffffff", border:"#e8ecf1",
    accent:"#0a84ff", accentBg:"#0a84ff0c",
    green:"#30b861", greenBg:"#30b86112",
    yellow:"#f5a623", yellowBg:"#f5a62312",
    red:"#ff453a",   redBg:"#ff453a10",
    lime:"#8ac926",  limeBg:"#8ac92612",
    purple:"#9b59b6",purpleBg:"#9b59b610",
    teal:"#0bb5a4",  tealBg:"#0bb5a412",
    text:"#1d1d1f", sub:"#6e6e73", dim:"#aeaeb2", card2:"#f2f2f7",
  };
  const font  = "'SF Pro Display','PingFang SC','Noto Sans SC',-apple-system,sans-serif";
  const cardS = { background:C.card, borderRadius:16, padding:20, boxShadow:"0 1px 3px rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.03)" };
  const btnS  = { border:"none", cursor:"pointer", fontFamily:font, fontWeight:600, borderRadius:12, transition:"all .15s" };

  return (
    <div style={{ fontFamily:font, background:C.bg, color:C.text, minHeight:"100vh", maxWidth:480, margin:"0 auto", paddingBottom:92 }}>

      {/* 顶栏 */}
      <div style={{ padding:"16px 16px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", background:C.card, borderBottom:"1px solid "+C.border }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, letterSpacing:-.3 }}>HEMS 能效管家</div>
          <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>Matter 1.x · 边缘本地运行</div>
        </div>
        {page!=="ev" && (
          <button onClick={()=>setShowAddModal(true)} style={{ ...btnS, width:36, height:36, borderRadius:18, background:C.accent, color:"#fff", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>+</button>
        )}
      </div>

      <div style={{ padding:"16px 16px 0" }}>

        {/* ══ 首页 ══ */}
        {page==="home" && <>
          {hasDevices ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              <KPI label="实时功率"   value={(totalPower/1000).toFixed(2)} unit="kW"     color={C.accent} icon="⚡" C={C}/>
              <KPI label="运行设备"   value={activeDevices.length}          unit={"/ "+devices.length} color={C.green} icon="📱" C={C}/>
              <KPI label="延迟排程"   value={shiftedDevices.length}         unit="台"    color={C.yellow} icon="⏰" C={C}/>
              <KPI label="当前碳强度" value={CARBON_24H[hour]}              unit="g/kWh" color={C.lime}   icon="🌱" C={C}/>
            </div>
          ) : (
            <div style={{ ...cardS, textAlign:"center", padding:"48px 24px", marginBottom:16 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🏠</div>
              <div style={{ fontSize:17, fontWeight:700, marginBottom:6 }}>欢迎使用 HEMS 能效管家</div>
              <div style={{ fontSize:13, color:C.sub, lineHeight:1.6, marginBottom:20 }}>添加您的智能家电，AI 自动优化用电排程</div>
              <button onClick={()=>setShowAddModal(true)} style={{ ...btnS, padding:"12px 28px", fontSize:15, background:C.accent, color:"#fff" }}>+ 添加第一台设备</button>
            </div>
          )}

          {/* 【优化1】节能成果卡 */}
          <div style={{ ...cardS, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:C.text }}>今日节能成果</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              {/* 节省电费 */}
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:9, color:C.dim, marginBottom:3 }}>累计省电费</div>
                <div style={{ fontSize:22, fontWeight:700, color:C.green, fontVariantNumeric:"tabular-nums", transition:"text-shadow .3s", textShadow:flash?"0 0 14px #30b86166":"none" }}>
                  ¥{totalSaved.toFixed(2)}
                </div>
                <div style={{ fontSize:9, color:C.dim, marginTop:2 }}>对比峰价方案</div>
              </div>
              {/* 碳减排 */}
              <div style={{ textAlign:"center", borderLeft:"1px solid "+C.border, borderRight:"1px solid "+C.border }}>
                <div style={{ fontSize:9, color:C.dim, marginBottom:3 }}>减排 CO₂</div>
                <div style={{ fontSize:22, fontWeight:700, color:C.lime, fontVariantNumeric:"tabular-nums" }}>
                  {totalCarbonG >= 1000 ? (totalCarbonG/1000).toFixed(2)+"kg" : totalCarbonG+"g"}
                </div>
                <div style={{ fontSize:9, color:C.dim, marginTop:2 }}>
                  {totalCarbonG>=500?"≈ "+Math.round(totalCarbonG/500)+" 棵树/天":"策略 A–H"}
                </div>
              </div>
              {/* Matter 指令数 */}
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:9, color:C.dim, marginBottom:3 }}>AI 指令</div>
                <div style={{ fontSize:22, fontWeight:700, color:C.purple }}>{matterCount}</div>
                <div style={{ fontSize:9, color:C.dim, marginTop:2 }}>Matter 条</div>
              </div>
            </div>

            {/* 减排进度条：目标 1kg/天 = 1000g */}
            <div style={{ marginTop:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:10, color:C.dim }}>今日减排进度</span>
                <span style={{ fontSize:10, color:C.lime }}>{Math.min(100,Math.round(totalCarbonG/1000*100))}% / 1kg 目标</span>
              </div>
              <div style={{ background:C.card2, borderRadius:6, height:6, overflow:"hidden" }}>
                <div style={{ height:"100%", width:Math.min(100,totalCarbonG/10)+"%", background:"linear-gradient(90deg,"+C.lime+","+C.green+")", borderRadius:6, transition:"width .5s" }}/>
              </div>
            </div>
          </div>

          {/* 【优化3】次日预冷预热提示 */}
          {precoolResult.needed && (
            <div style={{ ...cardS, marginBottom:16, borderLeft:"3px solid "+C.yellow }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>🌡️ 明日高温预警</div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:C.yellowBg, color:C.yellow }}>策略G</span>
              </div>
              <div style={{ fontSize:12, color:C.sub, lineHeight:1.6 }}>
                {"明日 "+fmtH(precoolResult.peakH)+" 气温预计达 "+precoolResult.peakTemp+"°C，"}<br/>
                {"建议 "+fmtH(precoolResult.startH)+" 开启预冷（目标 "+precoolResult.precoolTarget+"°C），持续 "+precoolResult.duration+"h"}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:10 }}>
                <div style={{ flex:1, padding:"6px 0", borderRadius:10, background:C.greenBg, textAlign:"center", fontSize:11, color:C.green }}>
                  {"绿电 "+RENEW_24H[precoolResult.startH]+"% · ¥"+TARIFF_24H[precoolResult.startH].toFixed(2)+"/kWh"}
                </div>
                <div style={{ flex:1, padding:"6px 0", borderRadius:10, background:C.yellowBg, textAlign:"center", fontSize:11, color:C.yellow }}>
                  {"预计省 ¥"+precoolResult.saving+" · 保温系数 "+(precoolResult.insulation*100).toFixed(0)+"%"}
                </div>
              </div>
              {precoolResult.insulation < 0.4 && (
                <div style={{ marginTop:8, padding:"6px 10px", borderRadius:8, background:C.redBg, fontSize:11, color:C.red }}>
                  ⚠️ 保温较差，AI 已缩短预冷时长为 1h，改为峰前即时制冷
                </div>
              )}
            </div>
          )}

          {/* 电价走势 */}
          <div style={{ ...cardS, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>今日电价走势</div>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:6, height:6, borderRadius:3, background:tColor(tariff) }}/>
                <span style={{ fontSize:11, color:C.sub }}>当前 </span>
                <span style={{ fontSize:12, fontWeight:700, color:tColor(tariff) }}>{tLabel(tariff)+"价 ¥"+tariff.toFixed(2)+"/kWh"}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:1.5, height:44, alignItems:"flex-end" }}>
              {TARIFF_24H.map((t,i)=>(
                <div key={i} style={{ flex:1, height:(t/1.3*100)+"%", borderRadius:"3px 3px 0 0", background:tColor(t), opacity:hour===i?1:.3, position:"relative" }}>
                  {hour===i&&<div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)", fontSize:7, color:C.accent, fontWeight:700 }}>▼</div>}
                </div>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              {[0,6,12,18,23].map(h=><span key={h} style={{ fontSize:9, color:C.dim }}>{h+":00"}</span>)}
            </div>
          </div>

          {hasDevices && (
            <div style={{ ...cardS, marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>设备状态</span>
                <button onClick={()=>setPage("devices")} style={{ ...btnS, padding:"4px 10px", fontSize:11, background:C.card2, color:C.sub }}>查看全部</button>
              </div>
              {devices.slice(0,4).map(d=><DeviceRow key={d.id} d={d} compact C={C}/>)}
              {devices.length>4&&<div style={{ fontSize:11, color:C.dim, textAlign:"center", marginTop:8 }}>{"还有 "+(devices.length-4)+" 台设备..."}</div>}
            </div>
          )}

          {/* EV 快捷卡 */}
          <div style={{ ...cardS, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>电动汽车充电</span>
              <button onClick={()=>setPage("ev")} style={{ ...btnS, padding:"4px 10px", fontSize:11, background:C.card2, color:C.sub }}>详情</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:evConnected?C.accentBg:C.card2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🔌</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:12, color:C.sub }}>{"当前 "+evSoc+"%"}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:C.accent }}>{"目标 "+evTarget+"%"}</span>
                </div>
                <div style={{ background:C.card2, borderRadius:6, height:7, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:evSoc+"%", background:"linear-gradient(90deg,#34d399,#0a84ff)", borderRadius:6 }}/>
                </div>
              </div>
            </div>
          </div>

          {logs.length>0 && (
            <div style={cardS}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>最近动态</div>
              {logs.slice(0,4).map((l,i)=>(
                <div key={i} style={{ display:"flex", gap:8, fontSize:12, padding:"5px 0", borderBottom:i<3?"1px solid "+C.border:"none" }}>
                  <span style={{ color:C.dim, flexShrink:0, fontVariantNumeric:"tabular-nums" }}>{l.ts}</span>
                  <span style={{ color:C.sub }}>{l.msg}</span>
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ══ 设备管理 ══ */}
        {page==="devices" && <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontSize:17, fontWeight:700 }}>设备管理</div>
            <button onClick={()=>setShowAddModal(true)} style={{ ...btnS, padding:"8px 16px", fontSize:13, background:C.accent, color:"#fff" }}>+ 添加设备</button>
          </div>
          {!hasDevices ? <EmptyState icon="📱" title="暂无设备" desc="点击添加您的智能家电" C={C}/> : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {devices.map(d=>{
                const thermal = d.type==="ac"||d.type==="inverterac" ? GatewayAPI.evalThermal(hour) : null;
                const lightBr = (d.type==="light"||d.type==="tv") ? GatewayAPI.evalLight(hour) : null;
                const nlOpt   = GatewayAPI.evalNonlinear(d, hour);
                const shiftR  = d.shiftable&&!d.on&&!d.shifted ? GatewayAPI.evalTimeShift(hour,d) : null;
                const smallR  = d.chargeable&&!d.on&&!d.shifted ? GatewayAPI.evalSmallDevice(d, hour) : null;
                return (
                  <div key={d.id} style={cardS}>
                    <DeviceRow d={d} C={C}/>
                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
                      {d.shiftable&&!d.on&&!d.shifted&&<button onClick={()=>requestStart(d.id)} style={{ ...btnS, flex:1, padding:"9px 0", fontSize:12, background:C.accentBg, color:C.accent }}>请求启动</button>}
                      {(d.on||d.shifted)&&<button onClick={()=>stopDevice(d.id)} style={{ ...btnS, flex:1, padding:"9px 0", fontSize:12, background:C.redBg, color:C.red }}>停止</button>}
                      <button onClick={()=>removeDevice(d.id)} style={{ ...btnS, padding:"9px 14px", fontSize:12, background:C.card2, color:C.dim }}>移除</button>
                    </div>
                    {thermal&&<StrategyBadge text={"策略B · "+(thermal.mode==="precool"?"🧊 预冷":thermal.mode==="drift"?"📈 漂移":"常规")+" · 目标 "+thermal.target+"°C"} bg={C.card2} color={C.sub}/>}
                    {lightBr!==null&&<StrategyBadge text={"策略C · 自然光 "+LUX_24H[hour]+" lux · 建议 "+lightBr+"%"} bg={C.card2} color={C.sub}/>}
                    {/* 【优化2】小电器策略F */}
                    {smallR&&<StrategyBadge text={"策略F · 建议 "+fmtH(smallR.bestHour)+" 充电，绿电 "+smallR.greenPct+"% · 省¥"+smallR.saving} bg={C.tealBg} color={C.teal}/>}
                    {/* 【优化5】非线性节能 */}
                    {nlOpt&&nlOpt.strategy==="光感联动"&&<StrategyBadge text={"策略H · 光感联动 → 亮度 "+nlOpt.adjusted+"% (省 "+nlOpt.savedPct+"%)"} bg={C.yellowBg} color={C.yellow}/>}
                    {nlOpt&&nlOpt.strategy==="变频COP优化"&&<StrategyBadge text={"策略H · COP优化 "+nlOpt.copBaseline+" → "+nlOpt.copNow+" · 频率 "+nlOpt.targetHz+"Hz · 省 "+nlOpt.saving+"kW"} bg={C.purpleBg} color={C.purple}/>}
                    {nlOpt&&nlOpt.strategy==="风机律节能"&&<StrategyBadge text={"策略H · 风机律节能 · 当前风速 "+nlOpt.speedPct+"% · 省 "+nlOpt.savingPct+"%功耗"} bg={C.tealBg} color={C.teal}/>}
                    {shiftR&&shiftR.shift&&<StrategyBadge text={"策略A · 延至 "+shiftR.to+":00 谷价启动 (省¥"+shiftR.saving+")"} bg={C.yellowBg} color={C.yellow}/>}
                    {((shiftR&&!shiftR.shift)||(d.shiftable&&!d.on&&!d.shifted&&!shiftR&&!d.chargeable))&&<StrategyBadge text="策略A · 当前低价，建议立即运行" bg={C.greenBg} color={C.green}/>}
                  </div>
                );
              })}
            </div>
          )}
        </>}

        {/* ══ 智能排程 ══ */}
        {page==="schedule" && <>
          <div style={{ fontSize:17, fontWeight:700, marginBottom:16 }}>智能排程</div>
          {!hasDevices ? <EmptyState icon="📅" title="暂无排程" desc="添加设备后 AI 将自动优化" C={C}/> : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

              {/* 策略A */}
              <div style={cardS}>
                <StrategyHeader title="策略A · 时移调度" desc="可延迟设备移至谷价时段" C={C}/>
                {devices.filter(d=>d.shiftable&&!d.chargeable).length===0
                  ? <div style={{ fontSize:12, color:C.dim, padding:"12px 0" }}>暂无可延迟设备</div>
                  : devices.filter(d=>d.shiftable&&!d.chargeable).map(d=>{
                    const r=GatewayAPI.evalTimeShift(hour,d);
                    return <ScheduleRow key={d.id} icon={d.icon} name={d.name} status={d.on?"运行中":d.shifted?"→ "+d.shiftTo+":00":r&&r.shift?"延至 "+r.to+":00":"可运行"} color={d.on?C.green:d.shifted?C.yellow:r&&r.shift?C.accent:C.green} C={C}/>;
                  })}
              </div>

              {/* 【优化2】策略F：小电器绿电排程 */}
              <div style={cardS}>
                <StrategyHeader title="策略F · 小电器绿电排程" desc="扫地机、净化器等在绿电高峰时段运行" C={C} badge="绿电优先"/>
                {devices.filter(d=>d.chargeable).length===0
                  ? <div style={{ fontSize:12, color:C.dim, padding:"12px 0" }}>暂无小电器设备</div>
                  : devices.filter(d=>d.chargeable).map(d=>{
                    const r=GatewayAPI.evalSmallDevice(d, hour);
                    return (
                      <div key={d.id} style={{ padding:"8px 0", borderBottom:"1px solid "+C.border }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:13 }}>{d.icon+" "+d.name}</span>
                          <span style={{ fontSize:12, fontWeight:600, color:C.teal }}>{"建议 "+fmtH(r.bestHour)+" 运行"}</span>
                        </div>
                        <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{"绿电 "+r.greenPct+"% · ¥"+r.tariff.toFixed(2)+"/kWh · 省¥"+r.saving}</div>
                      </div>
                    );
                  })}
              </div>

              {/* 【优化3】策略G：预冷预热 */}
              <div style={cardS}>
                <StrategyHeader title="策略G · 预冷/预热" desc="次日天气联动，提前在绿电时段调温" C={C} badge="天气联动"/>
                <div style={{ padding:"8px 10px", borderRadius:10, background:C.card2, fontSize:12, color:C.sub, marginBottom:10 }}>
                  <div style={{ fontWeight:600, marginBottom:4 }}>{"明日天气："+TOMORROW_WEATHER.desc}</div>
                  <div style={{ display:"flex", gap:1, height:28, alignItems:"flex-end" }}>
                    {TOMORROW_WEATHER.hourlyTemp.map((t,i)=>{
                      const h=(t-20)/22; const isPeak=t===Math.max(...TOMORROW_WEATHER.hourlyTemp);
                      return <div key={i} style={{ flex:1, height:(h*100)+"%", minHeight:2, borderRadius:"2px 2px 0 0", background:isPeak?"#ff453a":t>33?"#f5a623":"#34d399", opacity:.7+.3*h }}/>;
                    })}
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:2 }}>
                    {[0,6,12,18,23].map(h=><span key={h} style={{ fontSize:8, color:C.dim }}>{h+":00"}</span>)}
                  </div>
                </div>
                {precoolResult.needed ? (
                  <div>
                    {devices.filter(d=>d.type==="ac"||d.type==="inverterac").length===0
                      ? <div style={{ fontSize:12, color:C.dim }}>暂无空调设备</div>
                      : devices.filter(d=>d.type==="ac"||d.type==="inverterac").map(d=>(
                        <div key={d.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid "+C.border }}>
                          <div>
                            <span style={{ fontSize:13 }}>{d.icon+" "+d.name}</span>
                            <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>
                              {"明日 "+fmtH(precoolResult.startH)+" 预冷至 "+precoolResult.precoolTarget+"°C，持续 "+precoolResult.duration+"h"}
                            </div>
                          </div>
                          <span style={{ fontSize:12, color:C.yellow }}>省 ¥{precoolResult.saving}</span>
                        </div>
                      ))
                    }
                    {/* 【优化4】房屋热力学模型 */}
                    <div style={{ marginTop:10, padding:"10px 12px", borderRadius:10, background:C.purpleBg }}>
                      <div style={{ fontSize:11, fontWeight:600, color:C.purple, marginBottom:6 }}>🏗️ 房屋热力学模型</div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:11, color:C.sub }}>
                        <span>保温系数：{(houseModel.insulation*100).toFixed(0)}%</span>
                        <span>{houseModel.insulation<0.4?"保温差，即时制冷":houseModel.insulation<0.65?"保温中等":"保温良好"}</span>
                      </div>
                      <input type="range" min="0.1" max="1.0" step="0.05" value={insulation} style={{ width:"100%", accentColor:C.purple }} onChange={e=>handleInsulation(e.target.value)}/>
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:3, fontSize:9, color:C.dim }}>
                        <span>差（砖混无保温）</span><span>优（被动房）</span>
                      </div>
                      {houseModel.calibrated&&<div style={{ marginTop:6, fontSize:10, color:C.purple }}>实测升温率：{houseModel.coolingRate}°C/h</div>}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize:12, color:C.dim, padding:"8px 0" }}>明日温度适宜（{Math.max(...TOMORROW_WEATHER.hourlyTemp)}°C），无需预冷</div>
                )}
              </div>

              {/* 策略B */}
              <div style={cardS}>
                <StrategyHeader title="策略B · 热惯性调节" desc="谷价预冷/预热，峰价温度漂移" C={C}/>
                {devices.filter(d=>d.type==="ac"||d.type==="inverterac").length===0
                  ? <div style={{ fontSize:12, color:C.dim, padding:"12px 0" }}>暂无空调设备</div>
                  : devices.filter(d=>d.type==="ac"||d.type==="inverterac").map(d=>{
                    const r=GatewayAPI.evalThermal(hour);
                    return <ScheduleRow key={d.id} icon={d.icon} name={d.name+" ("+d.room+")"} status={"目标 "+r.target+"°C  "+(r.mode==="precool"?"预冷":r.mode==="drift"?"漂移":"常规")} color={r.mode==="precool"?C.green:r.mode==="drift"?C.yellow:C.dim} C={C}/>;
                  })}
              </div>

              {/* 策略C */}
              <div style={cardS}>
                <StrategyHeader title="策略C · 自然光补偿" desc="照度传感器联动，线性补偿亮度" C={C}/>
                {devices.filter(d=>d.type==="light"||d.type==="tv").length===0
                  ? <div style={{ fontSize:12, color:C.dim, padding:"12px 0" }}>暂无照明/显示设备</div>
                  : <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    {devices.filter(d=>d.type==="light"||d.type==="tv").map(d=>{
                      const br=GatewayAPI.evalLight(hour);
                      return (
                        <div key={d.id} style={{ flex:"1 1 110px", padding:"10px 12px", borderRadius:12, background:C.card2 }}>
                          <div style={{ fontSize:12 }}>{d.icon+" "+d.name}</div>
                          <div style={{ fontSize:22, fontWeight:700, color:br>0?C.yellow:C.dim, marginTop:4 }}>{br+"%"}</div>
                          <div style={{ fontSize:10, color:C.dim }}>{"自然光 "+LUX_24H[hour]+" lux"}</div>
                        </div>
                      );
                    })}
                  </div>
                }
              </div>

              {/* 【优化5】策略H：非线性节能 */}
              <div style={cardS}>
                <StrategyHeader title="策略H · 非线性节能" desc="光感联动 / COP优化 / 风机律" C={C} badge="精细控制"/>
                {devices.filter(d=>GatewayAPI.evalNonlinear(d,hour)).length===0
                  ? <div style={{ fontSize:12, color:C.dim, padding:"12px 0" }}>暂无适用设备</div>
                  : devices.filter(d=>GatewayAPI.evalNonlinear(d,hour)).map(d=>{
                    const nl=GatewayAPI.evalNonlinear(d,hour);
                    if (!nl) return null;
                    const txt = nl.strategy==="光感联动"
                      ? "亮度 → "+nl.adjusted+"% (↓"+nl.savedPct+"%)，外部 "+nl.outdoor+" lux"
                      : nl.strategy==="变频COP优化"
                      ? "频率 "+nl.targetHz+"Hz · COP "+nl.copNow+" · 省 "+nl.saving+" kW"
                      : "风速 "+nl.speedPct+"% · 省 "+nl.savingPct+"% 功耗";
                    return <ScheduleRow key={d.id} icon={d.icon} name={d.name} status={txt} color={C.purple} C={C}/>;
                  })}
              </div>
            </div>
          )}
        </>}

        {/* ══ 舒适度 ══ */}
        {page==="comfort" && <>
          <div style={{ fontSize:17, fontWeight:700, marginBottom:16 }}>舒适度调节</div>
          <div style={cardS}>
            <div style={{ fontSize:14, fontWeight:700, color:C.accent, marginBottom:4 }}>策略D · RLHF 舒适度学习</div>
            <div style={{ fontSize:12, color:C.sub, marginBottom:20 }}>您的反馈将实时调整 AI 的「节能 ↔ 舒适」权重</div>
            <div style={{ textAlign:"center", marginBottom:24 }}>
              <div style={{ fontSize:11, color:C.dim }}>AI 目标温度</div>
              <div style={{ fontSize:44, fontWeight:700, color:C.accent, margin:"4px 0" }}>{GatewayAPI.getTargetTemp().toFixed(1)+"°C"}</div>
              <div style={{ fontSize:12, color:C.sub }}>{"舒适权重 "+(GatewayAPI.getComfortWeight()*100).toFixed(0)+"%"}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
              <span style={{ fontSize:11, color:C.green }}>💰 省钱</span>
              <div style={{ flex:1, height:6, borderRadius:3, background:C.card2, position:"relative" }}>
                <div style={{ position:"absolute", left:0, top:0, height:"100%", width:(GatewayAPI.getComfortWeight()*100)+"%", borderRadius:3, background:"linear-gradient(90deg,"+C.green+","+C.accent+")", transition:"width .3s" }}/>
                <div style={{ position:"absolute", top:-4, left:(GatewayAPI.getComfortWeight()*100)+"%", transform:"translateX(-50%)", width:14, height:14, borderRadius:"50%", background:C.accent, border:"3px solid "+C.card, transition:"left .3s" }}/>
              </div>
              <span style={{ fontSize:11, color:C.accent }}>🛋️ 舒适</span>
            </div>
            <div style={{ fontSize:12, color:C.sub, textAlign:"center", marginBottom:14 }}>您现在感觉如何？</div>
            <div style={{ display:"flex", gap:10 }}>
              {[{t:"cold",l:"🥶 偏冷",c:"#60a5fa"},{t:"good",l:"😊 舒适",c:C.green},{t:"hot",l:"🥵 偏热",c:C.red}].map(fb=>(
                <button key={fb.t} onClick={()=>handleFeedback(fb.t)} style={{ ...btnS, flex:1, padding:"14px 0", fontSize:14, background:fb.c+"10", color:fb.c, border:"1px solid "+fb.c+"22" }}>{fb.l}</button>
              ))}
            </div>
          </div>
          {GatewayAPI.getFeedbackLog().length>0 && (
            <div style={{ ...cardS, marginTop:12 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>反馈记录</div>
              {GatewayAPI.getFeedbackLog().slice(0,10).map((fb,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid "+C.border }}>
                  <span style={{ color:C.dim }}>{fb.ts}</span>
                  <span style={{ color:fb.type==="cold"?"#60a5fa":fb.type==="hot"?C.red:C.green }}>{fb.type==="cold"?"偏冷":fb.type==="hot"?"偏热":"舒适"}</span>
                  <span style={{ color:C.accent }}>{"→ "+fb.target+"°C / "+(fb.weight*100).toFixed(0)+"%"}</span>
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ══ 决策日志 ══ */}
        {page==="log" && <>
          <div style={{ fontSize:17, fontWeight:700, marginBottom:16 }}>决策日志</div>
          {logs.length===0 ? <EmptyState icon="📋" title="暂无日志" desc="AI 每一条决策都会记录在此" C={C}/> : (
            <div style={cardS}>
              <div style={{ fontSize:11, color:C.dim, marginBottom:12 }}>所有决策在本地网关执行，数据不上云</div>
              {logs.map((l,i)=>(
                <div key={i} style={{ padding:"8px 0", borderBottom:"1px solid "+C.border }}>
                  <div style={{ display:"flex", gap:10, fontSize:12 }}>
                    <span style={{ color:C.dim, flexShrink:0, fontVariantNumeric:"tabular-nums" }}>{l.ts}</span>
                    <span style={{ color:C.sub }}>{l.msg}</span>
                  </div>
                  {l.matterCmd&&(
                    <div style={{ marginTop:5, marginLeft:52, padding:"5px 10px", borderRadius:7, background:"#1d1d1f07", fontFamily:"'SF Mono','Fira Code',monospace", fontSize:10, color:C.purple, wordBreak:"break-all", lineHeight:1.6 }}>
                      {l.matterCmd}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ══ EV 充电 ══ */}
        {page==="ev" && (
          <EVPage
            evSoc={evSoc} setEvSoc={setEvSoc} evTarget={evTarget} setEvTarget={setEvTarget}
            evDepHour={evDepHour} setEvDepHour={setEvDepHour}
            evConnected={evConnected} setEvConnected={setEvConn}
            evScheduled={evScheduled} setEvScheduled={setEvSched}
            evResult={evResult} hour={hour} addLog={addLog} addSaving={addSaving}
            C={C} font={font} cardS={cardS} btnS={btnS}
          />
        )}
      </div>

      {/* 底部导航 */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:C.card, borderTop:"1px solid "+C.border, display:"flex", padding:"6px 0 env(safe-area-inset-bottom,8px)", zIndex:100 }}>
        {[{id:"home",icon:"🏠",label:"首页"},{id:"devices",icon:"📱",label:"设备"},{id:"schedule",icon:"📅",label:"排程"},
          {id:"comfort",icon:"🌡️",label:"舒适度"},{id:"ev",icon:"🔌",label:"充电"},{id:"log",icon:"📋",label:"日志"}].map(t=>(
          <button key={t.id} onClick={()=>setPage(t.id)} style={{ ...btnS, flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"6px 0", background:"none", color:page===t.id?C.accent:C.dim }}>
            <span style={{ fontSize:18 }}>{t.icon}</span>
            <span style={{ fontSize:9, fontWeight:page===t.id?700:500 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 添加设备 Modal */}
      {showAddModal&&!showAddForm&&(
        <Modal onClose={()=>setShowAddModal(false)} title="添加设备" C={C} font={font}>
          <div style={{ fontSize:12, color:C.sub, marginBottom:16 }}>选择 Matter 设备类型</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {DEVICE_TEMPLATES.map(t=>(
              <button key={t.type} onClick={()=>addDevice(t)} style={{ ...btnS, display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background:C.card2, color:C.text, textAlign:"left", width:"100%" }}>
                <span style={{ fontSize:22 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{t.label}</div>
                  <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{"cluster "+t.matterCluster+" · 策略"+t.strategy+" · "+t.defaultRated+"W"}</div>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {showAddForm&&(
        <Modal onClose={()=>{setShowAddForm(null);setShowAddModal(false);}} title={"添加"+showAddForm.label} C={C} font={font}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Field label="设备名称" placeholder={"如: 客厅"+showAddForm.label} value={formData.name} onChange={v=>setFormData(p=>({...p,name:v}))} C={C} font={font}/>
            <Field label="所属房间" placeholder="如: 客厅、主卧、厨房" value={formData.room} onChange={v=>setFormData(p=>({...p,room:v}))} C={C} font={font}/>
            <Field label="额定功率 (W)" placeholder={String(showAddForm.defaultRated)} value={formData.rated} onChange={v=>setFormData(p=>({...p,rated:v}))} C={C} font={font} type="number"/>
            <div style={{ padding:"10px 14px", borderRadius:12, background:C.accentBg, fontSize:12, color:C.accent }}>
              {"Matter "+showAddForm.matterType+" · cluster "+showAddForm.matterCluster+" · 策略"+showAddForm.strategy+(showAddForm.chargeable?" · 绿电排程":showAddForm.shiftable?" · 可延迟":" · 实时控制")}
            </div>
            <button onClick={confirmAdd} disabled={!formData.name.trim()||!formData.room.trim()} style={{ ...btnS, padding:"14px 0", fontSize:15, background:!formData.name.trim()||!formData.room.trim()?C.dim:C.accent, color:"#fff", width:"100%", marginTop:4 }}>确认添加</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
//  EV 充电页面
// ══════════════════════════════════════════════════════════════
function EVPage({ evSoc,setEvSoc,evTarget,setEvTarget,evDepHour,setEvDepHour,evConnected,setEvConnected,evScheduled,setEvScheduled,evResult,hour,addLog,addSaving,C,font,cardS,btnS }) {
  const BAT_KWH=75;
  const tc=t=>t<=.4?C.green:t<=.8?C.yellow:C.red;
  const tl=t=>t<=.4?"谷价":t<=.8?"平价":"峰价";
  const evDevice={id:"dev_ev_charger",matterCluster:"0x0099",matterType:"0x050C",name:"EV 充电桩"};
  const handleSchedule=()=>{
    const next=!evScheduled; setEvScheduled(next);
    if (next) { addSaving(evResult.saving, Math.round(evResult.saving/0.4*100)); addLog("EV排程 · "+fmtH(evResult.startHour)+" 开始 · 绿电"+evResult.greenPct+"% · 省¥"+evResult.saving,MatterBus.cmdEVStart(evDevice)); }
    else addLog("EV排程已取消",MatterBus.cmdEVStop(evDevice));
  };
  const maxS=Math.max(...evResult.scores), minS=Math.min(...evResult.scores);
  return (<>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <div><div style={{ fontSize:17, fontWeight:700 }}>电动汽车充电</div><div style={{ fontSize:11, color:C.dim, marginTop:2 }}>策略E · 绿电优先 · 谷价时移</div></div>
      <div style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:20, background:evConnected?C.greenBg:C.card2 }}>
        <div style={{ width:6, height:6, borderRadius:3, background:evConnected?C.green:C.dim }}/>
        <span style={{ fontSize:11, fontWeight:600, color:evConnected?C.green:C.dim }}>{evConnected?"已连接":"未连接"}</span>
      </div>
    </div>
    <div style={cardS}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
        <div style={{ width:52, height:52, borderRadius:14, background:evConnected?C.accentBg:C.card2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🚗</div>
        <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:700 }}>我的电动车</div><div style={{ fontSize:11, color:C.sub, marginTop:3 }}>{BAT_KWH+" kWh · 7.4 kW 车载充电"}</div></div>
        <div style={{ textAlign:"right" }}><div style={{ fontSize:28, fontWeight:700, color:C.accent }}>{evSoc+"%"}</div><div style={{ fontSize:10, color:C.dim }}>当前电量</div></div>
      </div>
      <div style={{ background:C.card2, borderRadius:8, height:10, overflow:"hidden", marginBottom:6 }}>
        <div style={{ height:"100%", width:evSoc+"%", background:"linear-gradient(90deg,#34d399,#0a84ff)", borderRadius:8, transition:"width .4s" }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.sub }}>
        <span>当前 <b style={{ color:C.text }}>{(evSoc/100*BAT_KWH).toFixed(1)+" kWh"}</b></span>
        <span>目标 <b style={{ color:C.accent }}>{(evTarget/100*BAT_KWH).toFixed(1)+" kWh ("+evTarget+"%)"}</b></span>
      </div>
    </div>
    <div style={cardS}>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>充电目标设置</div>
      {[{label:"当前电量",display:evSoc+"%",min:10,max:90,step:1,val:evSoc,set:v=>{setEvSoc(parseInt(v));setEvScheduled(false);}},
        {label:"目标电量",display:evTarget+"%",min:70,max:100,step:5,val:evTarget,set:v=>{setEvTarget(parseInt(v));setEvScheduled(false);}},
        {label:"出发时间",display:fmtH(evDepHour),min:5,max:23,step:1,val:evDepHour,set:v=>{setEvDepHour(parseInt(v));setEvScheduled(false);}}
      ].map(s=>(
        <div key={s.label} style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:12, color:C.sub }}>{s.label}</span>
            <span style={{ fontSize:12, fontWeight:600, color:C.accent }}>{s.display}</span>
          </div>
          <input type="range" min={s.min} max={s.max} step={s.step} value={s.val} style={{ width:"100%", accentColor:C.accent }} onChange={e=>s.set(e.target.value)}/>
        </div>
      ))}
    </div>
    {evResult.neededKwh>0?(<>
      <div style={cardS}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700 }}>今夜最优充电窗口</div>
          <div style={{ padding:"3px 10px", borderRadius:20, background:C.greenBg, fontSize:11, fontWeight:600, color:C.green }}>{"省 ¥"+evResult.saving}</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
          {[{label:"建议开始",value:fmtH(evResult.startHour),sub:"¥"+TARIFF_24H[evResult.startHour].toFixed(2),color:C.green},
            {label:"预计完成",value:fmtH(evResult.endHour,evResult.endMin),sub:evResult.neededH+"h",color:C.accent},
            {label:"绿电占比",value:evResult.greenPct+"%",sub:"碳最低",color:C.lime}].map(m=>(
            <div key={m.label} style={{ background:C.card2, borderRadius:12, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:10, color:C.dim, marginBottom:3 }}>{m.label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:m.color, fontVariantNumeric:"tabular-nums" }}>{m.value}</div>
              <div style={{ fontSize:9, color:C.sub, marginTop:2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:C.sub, marginBottom:6 }}>24h 综合评分（绿电45%+电价55%）</div>
        <div style={{ display:"flex", gap:1.5, height:28, alignItems:"flex-end" }}>
          {evResult.scores.map((s,i)=>{
            const norm=maxS===minS?1:(s-minS)/(maxS-minS);
            const isStart=i===evResult.startHour, isCur=i===hour;
            return (<div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", height:"100%", position:"relative" }}>
              <div style={{ width:"100%", height:(norm*100)+"%", minHeight:3, borderRadius:"2px 2px 0 0", background:norm>.65?C.green:norm>.3?C.yellow:C.red, opacity:isStart?1:isCur?.7:.35 }}/>
              {isStart&&<div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", fontSize:7, color:C.green, fontWeight:700 }}>▼</div>}
              {isCur&&!isStart&&<div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", fontSize:7, color:C.accent, fontWeight:700 }}>●</div>}
            </div>);
          })}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
          {[0,6,12,18,23].map(h=><span key={h} style={{ fontSize:9, color:C.dim }}>{h+":00"}</span>)}
        </div>
      </div>
      <div style={cardS}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>分时充电计划</div>
        {evResult.plan.map((p,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<evResult.plan.length-1?"1px solid "+C.border:"none" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:tc(p.tariff), flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:600 }}>{p.timeLabel} <span style={{ fontWeight:400, color:C.sub }}>{tl(p.tariff)}</span></div>
              <div style={{ fontSize:10, color:C.dim, marginTop:1 }}>{"+"+p.kwh+" kWh · 绿电 "+p.renew+"% · ¥"+p.tariff.toFixed(2)+"/kWh"}</div>
            </div>
            <div style={{ textAlign:"right" }}><div style={{ fontSize:13, fontWeight:700, color:C.accent }}>{p.soc+"%"}</div><div style={{ fontSize:9, color:C.dim }}>剩余电量</div></div>
          </div>
        ))}
      </div>
      <div style={cardS}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>本次充电预估</div>
        {[{label:"需补充电量",value:evResult.neededKwh+" kWh",color:C.text},{label:"充电费用",value:"¥"+evResult.cost,color:C.accent},
          {label:"对比峰价",value:"省 ¥"+evResult.saving,color:C.green},{label:"碳排放",value:evResult.carbonKg+" kg CO₂",color:C.lime}].map((r,i,a)=>(
          <div key={r.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<a.length-1?"1px solid "+C.border:"none" }}>
            <span style={{ fontSize:12, color:C.sub }}>{r.label}</span>
            <span style={{ fontSize:13, fontWeight:700, color:r.color }}>{r.value}</span>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:4 }}>
        <button onClick={handleSchedule} disabled={!evConnected} style={{ ...btnS, flex:1, padding:"14px 0", fontSize:14, background:!evConnected?C.dim:evScheduled?C.red:C.accent, color:"#fff" }}>
          {evScheduled?"取消排程":"立即排程"}
        </button>
        <button onClick={()=>{setEvConnected(v=>!v);setEvScheduled(false);}} style={{ ...btnS, padding:"14px 18px", fontSize:13, background:C.card2, color:C.sub }}>
          {evConnected?"断开":"连接"}
        </button>
      </div>
      {evScheduled&&<div style={{ padding:"10px 14px", borderRadius:12, background:C.greenBg, fontSize:12, color:C.green }}>{"✅ 排程已激活 — AI 将在 "+fmtH(evResult.startHour)+" 自动开启充电桩"}</div>}
    </>):(
      <div style={{ ...cardS, textAlign:"center", padding:"32px 24px" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>电量已达目标</div>
        <div style={{ fontSize:12, color:C.sub }}>{"当前 "+evSoc+"% 已满足出发需求"}</div>
      </div>
    )}
  </>);
}


// ── 通用子组件 ───────────────────────────────────────────────
function KPI({ label, value, unit, color, icon, C }) {
  return (
    <div style={{ background:"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 1px 3px rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.03)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:11, color:C.dim }}>{label}</span>
        <span style={{ fontSize:14 }}>{icon}</span>
      </div>
      <div style={{ fontSize:22, fontWeight:700, color, marginTop:4, fontVariantNumeric:"tabular-nums" }}>
        {value}<span style={{ fontSize:12, fontWeight:500, color:C.dim, marginLeft:3 }}>{unit}</span>
      </div>
    </div>
  );
}

function DeviceRow({ d, compact, C }) {
  const sc=d.on?C.green:d.shifted?C.yellow:C.dim;
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:compact?"6px 0":"0" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:sc+"10", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{d.icon}</div>
        <div>
          <div style={{ fontSize:13, fontWeight:600 }}>{d.name}</div>
          <div style={{ fontSize:10, color:C.dim, marginTop:1 }}>{d.room+" · "+d.rated+"W"}</div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:13, fontWeight:600, color:d.on?C.accent:C.dim, fontVariantNumeric:"tabular-nums" }}>{d.on?d.power+"W":"—"}</div>
          <div style={{ fontSize:10, color:sc }}>{d.on?"运行中":d.shifted?"延迟至 "+d.shiftTo+":00":"待机"}</div>
        </div>
        <div style={{ width:7, height:7, borderRadius:"50%", background:sc, boxShadow:d.on?"0 0 6px "+sc+"55":"none" }}/>
      </div>
    </div>
  );
}

function StrategyBadge({ text, bg, color }) {
  return <div style={{ marginTop:8, padding:"7px 12px", borderRadius:10, background:bg, fontSize:11, color }}>{text}</div>;
}

function StrategyHeader({ title, desc, C, badge }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.accent }}>{title}</div>
        {badge&&<span style={{ fontSize:9, padding:"2px 7px", borderRadius:10, background:C.tealBg, color:C.teal, fontWeight:600 }}>{badge}</span>}
      </div>
      <div style={{ fontSize:12, color:C.sub }}>{desc}</div>
    </div>
  );
}

function ScheduleRow({ icon, name, status, color, C }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid "+C.border }}>
      <span style={{ fontSize:13 }}>{icon+" "+name}</span>
      <span style={{ fontSize:12, color }}>{status}</span>
    </div>
  );
}

function EmptyState({ icon, title, desc, C }) {
  return (
    <div style={{ background:"#fff", borderRadius:16, padding:"48px 24px", textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.03)" }}>
      <div style={{ fontSize:40, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:13, color:C.sub }}>{desc}</div>
    </div>
  );
}

function Modal({ onClose, title, children, C, font }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:C.card, borderRadius:"20px 20px 0 0", width:"100%", maxWidth:480, maxHeight:"85vh", overflow:"auto", padding:"20px 20px 32px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:36, height:4, borderRadius:2, background:C.dim, margin:"0 auto 16px", opacity:.3 }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:17, fontWeight:700 }}>{title}</div>
          <button onClick={onClose} style={{ border:"none", background:C.card2, width:28, height:28, borderRadius:14, cursor:"pointer", fontSize:14, color:C.dim, fontFamily:font, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, C, font, type="text" }) {
  return (
    <div>
      <div style={{ fontSize:12, fontWeight:600, color:C.sub, marginBottom:5 }}>{label}</div>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%", padding:"11px 14px", borderRadius:12, border:"1px solid "+C.border, fontSize:14, fontFamily:font, color:C.text, background:C.card2, outline:"none", boxSizing:"border-box" }}/>
    </div>
  );
}
