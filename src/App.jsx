import { useState, useEffect, useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
const KEY='pos_v1';
const COLORS=['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899'];
const SEED={cats:['餐點','飲品'],products:[
{id:'p1',name:'招牌便當',price:120,cat:'餐點',color:COLORS[0]},
{id:'p2',name:'滷肉飯',price:60,cat:'餐點',color:COLORS[1]},
{id:'p3',name:'炸雞排',price:85,cat:'餐點',color:COLORS[2]},
{id:'p4',name:'珍珠奶茶',price:55,cat:'飲品',color:COLORS[4]},
{id:'p5',name:'冬瓜茶',price:35,cat:'飲品',color:COLORS[3]},
{id:'p6',name:'美式咖啡',price:60,cat:'飲品',color:COLORS[5]}],orders:[]};
const load=()=>{try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.products)return d}catch(e){}return SEED};
const p2=n=>String(n).padStart(2,'0');
const dkey=t=>{const d=new Date(t);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())};
const tkey=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes())};
const shift=(k,n)=>{const[y,m,d]=k.split('-').map(Number);return dkey(new Date(y,m-1,d+n))};
const $=n=>'$'+Math.round(n).toLocaleString('en-US');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const WD='日一二三四五六';
const wk=k=>{const[y,m,d]=k.split('-').map(Number);return '週'+WD[new Date(y,m-1,d).getDay()]};

async function save(filename,blob,say){
  if(Capacitor.isNativePlatform()){
    // Android / iOS App：寫入暫存檔後開啟系統分享（可存到檔案、傳到 Line、雲端等）
    try{
      const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob)});
      const f=await Filesystem.writeFile({path:filename,data,directory:Directory.Cache});
      await Share.share({title:filename,url:f.uri});
    }catch(e){if(!/cancel/i.test(String(e&&e.message)))say('無法匯出檔案')}
    return;
  }
  try{
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){say('此裝置無法下載檔案')}
}

function Modal({children,onClose}){return (<div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}><div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92%] overflow-y-auto" style={{paddingBottom:'calc(1.25rem + env(safe-area-inset-bottom,0px))'}} onClick={e=>e.stopPropagation()}>{children}</div></div>)}

export default function App(){
const[db,setDb]=useState(load);
const[tab,setTab]=useState(0);
const[toast,setToast]=useState(null);
useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}},[db]);
useEffect(()=>{try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}},[]);
const tt=useRef();
const[conf,setConf]=useState(null);
const ask=(msg,fn)=>setConf({msg,fn});
const say=m=>{setToast(m);clearTimeout(tt.current);tt.current=setTimeout(()=>setToast(null),1800)};
const nav=[['🧾','收銀'],['📊','銷售查詢'],['⚙️','商品管理']];
return (<div className="h-full flex flex-col max-w-3xl mx-auto bg-slate-100">
<main className="flex-1 min-h-0 overflow-hidden">
{tab===0&&(<Pos db={db} setDb={setDb} say={say} ask={ask}/>)}
{tab===1&&(<Report db={db} setDb={setDb} say={say}/>)}
{tab===2&&(<Manage db={db} setDb={setDb} say={say} ask={ask}/>)}
</main>
<nav className="grid grid-cols-3 bg-slate-900 text-white" style={{paddingBottom:'env(safe-area-inset-bottom,0px)'}}>
{nav.map((n,i)=>(<button key={i} onClick={()=>setTab(i)} className={'py-2.5 flex flex-col items-center text-sm font-bold '+(tab===i?'bg-blue-600':'text-slate-300')}><span className="text-2xl leading-none">{n[0]}</span>{n[1]}</button>))}
</nav>
{conf&&(<Modal onClose={()=>setConf(null)}><div className="text-xl font-extrabold text-center mb-5">{conf.msg}</div><div className="grid grid-cols-2 gap-3"><button onClick={()=>setConf(null)} className="h-14 rounded-2xl bg-slate-200 font-bold">取消</button><button onClick={()=>{const f=conf.fn;setConf(null);f()}} className="h-14 rounded-2xl bg-red-600 text-white font-bold">確定</button></div></Modal>)}
{toast&&(<div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-xl" style={{marginTop:'env(safe-area-inset-top,0px)'}}>{toast}</div>)}
</div>)}

function Pos({db,setDb,say,ask}){
const[cat,setCat]=useState('全部');
const[cart,setCart]=useState({});
const[pay,setPay]=useState(false);
const[recv,setRecv]=useState(0);
const[showCart,setShowCart]=useState(true);
const list=db.products.filter(p=>cat==='全部'||p.cat===cat);
const lines=Object.entries(cart).map(([id,q])=>({p:db.products.find(x=>x.id===id),q})).filter(l=>l.p);
const total=lines.reduce((s,l)=>s+l.p.price*l.q,0);
const count=lines.reduce((s,l)=>s+l.q,0);
const add=(id,d)=>setCart(c=>{const q=(c[id]||0)+d;const n={...c};if(q<=0)delete n[id];else n[id]=q;return n});
const rm=id=>setCart(c=>{const n={...c};delete n[id];return n});
const confirm=()=>{
const items=lines.map(l=>({id:l.p.id,name:l.p.name,price:l.p.price,qty:l.q}));
setDb(d=>({...d,orders:[...d.orders,{id:uid(),ts:Date.now(),items,total}]}));
setCart({});setPay(false);say('結帳成功！')};
const cash=[['剛好',total],['100',100],['500',500],['1000',1000]];
return (<div className="h-full flex flex-col">
<div className="flex gap-2 overflow-x-auto noscroll p-3 bg-white shadow-sm shrink-0">
{['全部',...db.cats].map(c=>(<button key={c} onClick={()=>setCat(c)} className={'shrink-0 px-5 py-2.5 rounded-full font-bold text-base '+(cat===c?'bg-blue-600 text-white':'bg-slate-200 text-slate-700')}>{c}</button>))}
</div>
<div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
{list.length===0&&(<div className="col-span-full text-center text-slate-400 py-10">此分類沒有商品</div>)}
{list.map(p=>(<button key={p.id} onClick={()=>add(p.id,1)} className="relative h-28 rounded-2xl text-left p-3 flex flex-col justify-between shadow border-l-8 bg-white" style={{borderColor:p.color}}>
<span className="text-lg font-bold text-slate-800 leading-tight">{p.name}</span>
<span className="text-xl font-extrabold" style={{color:p.color}}>{$(p.price)}</span>
{cart[p.id]&&(<span className="absolute -top-2 -right-2 min-w-[32px] h-8 px-2 rounded-full bg-red-600 text-white font-bold flex items-center justify-center shadow">{cart[p.id]}</span>)}
</button>))}
</div>
<div className="bg-white shadow-[0_-4px_12px_rgba(0,0,0,.12)] shrink-0">
<div className="flex items-center justify-between px-4 pt-2">
<button onClick={()=>setShowCart(!showCart)} className="font-bold text-slate-600 py-1">🛒 購物車（{count}）{showCart?'▾':'▴'}</button>
{count>0&&(<button onClick={()=>ask('確定清空購物車？',()=>setCart({}))} className="text-red-600 font-bold px-3 py-1">清空</button>)}
</div>
{showCart&&(<div className="max-h-40 overflow-y-auto px-3">
{lines.length===0&&(<div className="text-center text-slate-400 py-3">點選商品加入購物車</div>)}
{lines.map(l=>(<div key={l.p.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100">
<div className="flex-1 min-w-0"><div className="font-bold truncate">{l.p.name}</div><div className="text-sm text-slate-500">{$(l.p.price)} × {l.q} = {$(l.p.price*l.q)}</div></div>
<button onClick={()=>add(l.p.id,-1)} className="w-11 h-11 rounded-xl bg-slate-200 text-2xl font-bold">−</button>
<span className="w-8 text-center font-bold text-lg">{l.q}</span>
<button onClick={()=>add(l.p.id,1)} className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 text-2xl font-bold">+</button>
<button onClick={()=>rm(l.p.id)} className="w-11 h-11 rounded-xl bg-red-100 text-red-600 text-lg">🗑</button>
</div>))}</div>)}
<div className="flex items-center gap-3 p-3">
<div className="flex-1"><div className="text-sm text-slate-500">總金額</div><div className="text-3xl font-extrabold text-slate-900">{$(total)}</div></div>
<button disabled={total===0} onClick={()=>{setRecv(0);setPay(true)}} className="h-16 px-10 rounded-2xl bg-green-600 disabled:bg-slate-300 text-white text-2xl font-extrabold">結帳</button>
</div></div>
{pay&&(<Modal onClose={()=>setPay(false)}>
<div className="text-center"><div className="text-slate-500 font-bold">應收總金額</div><div className="text-5xl font-extrabold text-slate-900 my-2">{$(total)}</div></div>
<div className="grid grid-cols-4 gap-2 my-4">
{cash.map(([l,v])=>(<button key={l} onClick={()=>setRecv(v)} className={'h-14 rounded-xl font-bold text-lg '+(recv===v?'bg-blue-600 text-white':'bg-blue-100 text-blue-800')}>{l}</button>))}
</div>
<input type="number" inputMode="numeric" placeholder="其他實收金額" value={recv||''} onInput={e=>setRecv(Math.max(0,Math.round(Number(e.target.value)||0)))} className="w-full h-14 border-2 border-slate-300 rounded-xl px-4 text-xl text-center mb-3"/>
<div className={'rounded-2xl p-4 text-center mb-4 '+(recv>=total?'bg-green-100 text-green-800':'bg-slate-100 text-slate-500')}>
<div className="font-bold">找零金額</div><div className="text-4xl font-extrabold">{recv>=total?$(recv-total):'—'}</div></div>
<div className="grid grid-cols-3 gap-3"><button onClick={()=>setPay(false)} className="h-16 rounded-2xl bg-slate-200 font-bold text-lg">取消</button>
<button disabled={recv<total} onClick={confirm} className="col-span-2 h-16 rounded-2xl bg-green-600 disabled:bg-slate-300 text-white font-extrabold text-xl">確認收款</button></div>
</Modal>)}
</div>)}

function Report({db,setDb,say}){
const today=dkey(Date.now());
const[day,setDay]=useState(today);
const[del,setDel]=useState(null);
const orders=useMemo(()=>db.orders.filter(o=>dkey(o.ts)===day).sort((a,b)=>b.ts-a.ts),[db.orders,day]);
const sum=orders.reduce((s,o)=>s+o.total,0);
const stats=useMemo(()=>{const m={};orders.forEach(o=>o.items.forEach(i=>{const r=m[i.name]||(m[i.name]={name:i.name,qty:0,amt:0});r.qty+=i.qty;r.amt+=i.qty*i.price}));return Object.values(m).sort((a,b)=>b.amt-a.amt)},[orders]);
const remove=()=>{setDb(d=>({...d,orders:d.orders.filter(o=>o.id!==del)}));setDel(null);say('訂單已作廢')};
const btn='h-12 rounded-xl font-bold bg-white border-2 border-slate-300 text-slate-700';
const[mode,setMode]=useState('day');
const thisMon=today.slice(0,7);
const[mon,setMon]=useState(thisMon);
const sm=(m,n)=>{const[y,mo]=m.split('-').map(Number);const d=new Date(y,mo-1+n,1);return d.getFullYear()+'-'+p2(d.getMonth()+1)};
const mOrders=useMemo(()=>db.orders.filter(o=>dkey(o.ts).slice(0,7)===mon),[db.orders,mon]);
const mSum=mOrders.reduce((s,o)=>s+o.total,0);
const byDay=useMemo(()=>{const m={};mOrders.forEach(o=>{const k=dkey(o.ts);const r=m[k]||(m[k]={k,n:0,amt:0});r.n++;r.amt+=o.total});return Object.values(m).sort((a,b)=>b.k.localeCompare(a.k))},[mOrders]);
const mStats=useMemo(()=>{const m={};mOrders.forEach(o=>o.items.forEach(i=>{const r=m[i.name]||(m[i.name]={name:i.name,qty:0,amt:0});r.qty+=i.qty;r.amt+=i.qty*i.price}));return Object.values(m).sort((a,b)=>b.amt-a.amt)},[mOrders]);
const modeBar=(<div className="grid grid-cols-2 gap-1 bg-slate-200 p-1 rounded-xl">{[['day','日報'],['month','月報']].map(([k,l])=>(<button key={k} onClick={()=>setMode(k)} className={'h-11 rounded-lg font-bold '+(mode===k?'bg-white shadow text-blue-700':'text-slate-500')}>{l}</button>))}</div>);
if(mode==='month'){const mx=Math.max(1,...byDay.map(d=>d.amt));return (<div className="h-full overflow-y-auto p-3 space-y-3">{modeBar}
<div className="grid grid-cols-3 gap-2">
<button className={btn} onClick={()=>setMon(sm(mon,-1))}>‹ 上個月</button>
<label className="h-12 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center relative overflow-hidden">📅 {mon.replace('-','年')}月
<input type="month" value={mon} max={thisMon} onChange={e=>e.target.value&&setMon(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full"/></label>
<button className={btn+' disabled:opacity-40'} disabled={mon>=thisMon} onClick={()=>setMon(sm(mon,1))}>下個月 ›</button>
</div>
<button onClick={()=>setMon(thisMon)} disabled={mon===thisMon} className="w-full h-11 rounded-xl bg-slate-800 text-white font-bold disabled:opacity-40">回到本月</button>
<div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 shadow-lg">
<div className="font-bold opacity-80">{mon.replace('-','年')}月 總銷售金額</div>
<div className="text-5xl font-extrabold my-1">{$(mSum)}</div>
<div className="font-bold opacity-90">成交 {mOrders.length} 筆 ・ 營業 {byDay.length} 天{byDay.length>0?' ・ 日均 '+$(mSum/byDay.length):''}</div></div>
<section className="bg-white rounded-2xl shadow p-3">
<h2 className="font-extrabold text-lg mb-2">📅 每日銷售 <span className="text-xs font-normal text-slate-400">點選可查看當日明細</span></h2>
{byDay.length===0&&(<div className="text-slate-400 text-center py-4">本月無銷售紀錄</div>)}
{byDay.map(d=>(<button key={d.k} onClick={()=>{setDay(d.k);setMode('day')}} className="w-full text-left py-2 border-b border-slate-100">
<div className="flex justify-between"><span className="font-bold">{d.k.slice(5)} {wk(d.k)}<span className="text-sm font-normal text-slate-400"> {d.n} 筆</span></span><span className="font-extrabold text-emerald-700">{$(d.amt)}</span></div>
<div className="h-2 rounded bg-slate-100 mt-1"><div className="h-2 rounded bg-emerald-500" style={{width:(d.amt/mx*100)+'%'}}></div></div></button>))}
</section>
<section className="bg-white rounded-2xl shadow p-3">
<h2 className="font-extrabold text-lg mb-2">📦 本月品項統計</h2>
{mStats.length===0?(<div className="text-slate-400 text-center py-4">本月無銷售紀錄</div>):<><div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm font-bold text-slate-500 border-b pb-1"><span>品項</span><span className="text-right">數量</span><span className="text-right">銷售額</span></div>
{mStats.map(s=>(<div key={s.name} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-2 border-b border-slate-100"><span className="font-bold truncate">{s.name}</span><span className="text-right">{s.qty}</span><span className="text-right font-bold text-emerald-700">{$(s.amt)}</span></div>))}</>}
</section></div>)}
return (<div className="h-full overflow-y-auto p-3 space-y-3">{modeBar}
<div className="grid grid-cols-3 gap-2">
<button className={btn} onClick={()=>setDay(shift(day,-1))}>‹ 前一天</button>
<label className="h-12 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center relative overflow-hidden">📅 {day.slice(5)} {wk(day)}
<input type="date" value={day} max={today} onChange={e=>e.target.value&&setDay(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full"/></label>
<button className={btn+' disabled:opacity-40'} disabled={day>=today} onClick={()=>setDay(shift(day,1))}>後一天 ›</button>
</div>
<button onClick={()=>setDay(today)} disabled={day===today} className="w-full h-11 rounded-xl bg-slate-800 text-white font-bold disabled:opacity-40">回到今天</button>
<div className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 shadow-lg">
<div className="font-bold opacity-80">{day===today?'今日':day} 總銷售金額</div>
<div className="text-5xl font-extrabold my-1">{$(sum)}</div>
<div className="font-bold opacity-90">成交 {orders.length} 筆</div></div>
<section className="bg-white rounded-2xl shadow p-3">
<h2 className="font-extrabold text-lg mb-2">📦 品項統計 <span className="text-xs font-normal text-slate-400">依銷售額排序</span></h2>
{stats.length===0?(<div className="text-slate-400 text-center py-4">當日無銷售紀錄</div>):<><div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm font-bold text-slate-500 border-b pb-1"><span>品項</span><span className="text-right">數量</span><span className="text-right">銷售額</span></div>
{stats.map(s=>(<div key={s.name} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-2 border-b border-slate-100"><span className="font-bold truncate">{s.name}</span><span className="text-right">{s.qty}</span><span className="text-right font-bold text-blue-700">{$(s.amt)}</span></div>))}</>}
</section>
<section className="bg-white rounded-2xl shadow p-3">
<h2 className="font-extrabold text-lg mb-2">🧾 交易明細</h2>
{orders.length===0&&(<div className="text-slate-400 text-center py-4">當日無交易</div>)}
{orders.map(o=>(<div key={o.id} className="flex items-start gap-3 py-3 border-b border-slate-100">
<div className="font-mono font-bold text-slate-500 pt-0.5">{tkey(o.ts)}</div>
<div className="flex-1 text-sm min-w-0">{o.items.map(i=>(<div key={i.id}>{i.name} × {i.qty}</div>))}</div>
<div className="text-right"><div className="font-extrabold text-lg">{$(o.total)}</div>
<button onClick={()=>setDel(o.id)} className="mt-1 px-3 h-9 rounded-lg bg-red-100 text-red-700 text-sm font-bold">作廢</button></div>
</div>))}
</section>
{del&&(<Modal onClose={()=>setDel(null)}>
<div className="text-xl font-extrabold text-center mb-2">確定作廢此訂單？</div>
<div className="text-center text-slate-500 mb-4">作廢後無法復原，當日統計將重新計算。</div>
<div className="grid grid-cols-2 gap-3"><button onClick={()=>setDel(null)} className="h-14 rounded-2xl bg-slate-200 font-bold">取消</button><button onClick={remove} className="h-14 rounded-2xl bg-red-600 text-white font-bold">確定作廢</button></div></Modal>)}
</div>)}

function Manage({db,setDb,say,ask}){
const[ed,setEd]=useState(null);
const[newCat,setNewCat]=useState('');
const[csvDay,setCsvDay]=useState(dkey(Date.now()));
const fileRef=useRef();
const saveP=()=>{
const name=ed.name.trim(),price=Math.round(Number(ed.price));
if(!name||!(price>=0)||ed.price==='')return say('請填寫品名與價格');
const p={...ed,name,price};
setDb(d=>({...d,products:d.products.some(x=>x.id===p.id)?d.products.map(x=>x.id===p.id?p:x):[...d.products,p]}));
setEd(null);say('商品已儲存')};
const delP=()=>ask('確定刪除「'+ed.name+'」？（歷史訂單不受影響）',()=>{setDb(d=>({...d,products:d.products.filter(x=>x.id!==ed.id)}));setEd(null);say('商品已刪除')});
const addCat=()=>{const c=newCat.trim();if(!c||db.cats.includes(c))return;setDb(d=>({...d,cats:[...d.cats,c]}));setNewCat('')};
const delCat=c=>ask('刪除分類「'+c+'」？該分類商品將變為未分類',()=>setDb(d=>({...d,cats:d.cats.filter(x=>x!==c),products:d.products.map(p=>p.cat===c?{...p,cat:''}:p)})));
const csv=all=>{
const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
const rows=[['日期','時間','訂單編號','品項','單價','數量','小計','訂單總額']];
db.orders.filter(o=>all||dkey(o.ts)===csvDay).sort((a,b)=>a.ts-b.ts).forEach(o=>o.items.forEach(i=>rows.push([dkey(o.ts),tkey(o.ts),o.id,i.name,i.price,i.qty,i.price*i.qty,o.total])));
if(rows.length===1)return say('沒有可匯出的資料');
save(all?'sales_all.csv':'sales_'+csvDay+'.csv',new Blob(['\uFEFF'+rows.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),say)};
const expJson=()=>save('pos_backup_'+dkey(Date.now())+'.json',new Blob([JSON.stringify(db)],{type:'application/json'}),say);
const impJson=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.products)||!Array.isArray(d.orders)||!Array.isArray(d.cats))throw 0;
ask('匯入將覆蓋目前所有資料，確定嗎？',()=>{setDb(d);say('匯入成功')})}catch(x){say('檔案格式錯誤')}};
r.readAsText(f);e.target.value=''};
const inp='w-full h-12 border-2 border-slate-300 rounded-xl px-3 text-lg';
const big='h-12 rounded-xl font-bold px-3';
return (<div className="h-full overflow-y-auto p-3 space-y-3">
<section className="bg-white rounded-2xl shadow p-3">
<div className="flex items-center justify-between mb-2"><h2 className="font-extrabold text-lg">🛍 商品設定</h2>
<button onClick={()=>setEd({id:uid(),name:'',price:'',cat:db.cats[0]||'',color:COLORS[5]})} className={big+' bg-blue-600 text-white'}>＋ 新增商品</button></div>
{db.products.map(p=>(<button key={p.id} onClick={()=>setEd({...p})} className="w-full flex items-center gap-3 py-3 border-b border-slate-100 text-left">
<span className="w-4 h-10 rounded" style={{background:p.color}}></span>
<span className="flex-1 font-bold">{p.name}<span className="block text-xs font-normal text-slate-400">{p.cat||'未分類'}</span></span>
<span className="font-extrabold">{$(p.price)}</span><span className="text-slate-400">✎</span></button>))}
</section>
<section className="bg-white rounded-2xl shadow p-3">
<h2 className="font-extrabold text-lg mb-2">🏷 分類</h2>
<div className="flex flex-wrap gap-2 mb-3">{db.cats.map(c=>(<span key={c} className="bg-slate-200 rounded-full pl-4 pr-1 h-10 flex items-center gap-1 font-bold">{c}<button onClick={()=>delCat(c)} className="w-8 h-8 rounded-full bg-slate-300 text-slate-700">×</button></span>))}</div>
<div className="flex gap-2"><input className={inp} placeholder="新分類名稱" value={newCat} onInput={e=>setNewCat(e.target.value)}/><button onClick={addCat} className={big+' bg-slate-800 text-white shrink-0'}>新增</button></div>
</section>
<section className="bg-white rounded-2xl shadow p-3 space-y-3">
<h2 className="font-extrabold text-lg">💾 匯出與備份</h2>
<div className="flex gap-2 items-center"><input type="date" value={csvDay} onChange={e=>e.target.value&&setCsvDay(e.target.value)} className={inp}/><button onClick={()=>csv(false)} className={big+' bg-green-600 text-white shrink-0'}>匯出當日 CSV</button></div>
<button onClick={()=>csv(true)} className={big+' w-full bg-green-100 text-green-800'}>匯出全部銷售明細 CSV</button>
<div className="grid grid-cols-2 gap-2"><button onClick={expJson} className={big+' bg-indigo-600 text-white'}>匯出 JSON 備份</button>
<button onClick={()=>fileRef.current.click()} className={big+' bg-indigo-100 text-indigo-800'}>匯入 JSON 備份</button></div>
<input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={impJson}/>
<div className="text-xs text-slate-400">資料自動儲存於此瀏覽器（localStorage）。目前共 {db.orders.length} 筆訂單。</div>
</section>
{ed&&(<Modal onClose={()=>setEd(null)}>
<div className="text-xl font-extrabold mb-3">{db.products.some(p=>p.id===ed.id)?'編輯商品':'新增商品'}</div>
<label className="text-sm font-bold text-slate-500">品名</label><input className={inp+' mb-3'} value={ed.name} onInput={e=>setEd({...ed,name:e.target.value})}/>
<label className="text-sm font-bold text-slate-500">價格（NT$）</label><input type="number" inputMode="numeric" className={inp+' mb-3'} value={ed.price} onInput={e=>setEd({...ed,price:e.target.value})}/>
<label className="text-sm font-bold text-slate-500">分類</label>
<select className={inp+' mb-3 bg-white'} value={ed.cat} onChange={e=>setEd({...ed,cat:e.target.value})}><option value="">未分類</option>{db.cats.map(c=>(<option key={c} value={c}>{c}</option>))}</select>
<label className="text-sm font-bold text-slate-500">卡片顏色</label>
<div className="flex gap-2 flex-wrap my-2 mb-4">{COLORS.map(c=>(<button key={c} onClick={()=>setEd({...ed,color:c})} className={'w-11 h-11 rounded-full '+(ed.color===c?'ring-4 ring-offset-2 ring-slate-800':'')} style={{background:c}}></button>))}</div>
<div className="grid grid-cols-3 gap-2">
{db.products.some(p=>p.id===ed.id)?(<button onClick={delP} className="h-14 rounded-2xl bg-red-100 text-red-700 font-bold">刪除</button>):(<button onClick={()=>setEd(null)} className="h-14 rounded-2xl bg-slate-200 font-bold">取消</button>)}
<button onClick={saveP} className="col-span-2 h-14 rounded-2xl bg-blue-600 text-white font-extrabold text-lg">儲存</button></div>
</Modal>)}
</div>)}
