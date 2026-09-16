/* ============================================================
   PL.04 · 自演化戴森知识球
   均匀球壳、点位详情、自动观测与自主复盘。
   ============================================================ */
import { AGENTS, DOCS, TOPICS } from '../data/documents.js';
import { dateKey } from './time.js';

(function () {
  'use strict';
  const cv = document.getElementById('nebula');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const PAPER = '#070b14';
  const INK = '#aebcd2';
  const rgba = (hex, a) => { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${a})`; };
  const norm = p => { const m = Math.hypot(p.x, p.y, p.z) || 1; return { x:p.x/m, y:p.y/m, z:p.z/m }; };
  const dot = (a,b) => a.x*b.x + a.y*b.y + a.z*b.z;
  const fib = (i,n) => { const y = 1 - (i / Math.max(1,n-1))*2; const r = Math.sqrt(Math.max(0,1-y*y)); const a=i*GOLDEN; return {x:Math.cos(a)*r,y,z:Math.sin(a)*r}; };
  const agentByKey = new Map(AGENTS.map(a => [a.key, a]));
  const anchors = AGENTS.map((a,i) => ({ id:`agent-${a.key}`, key:a.key, color:a.color, p:fib(i + .5, AGENTS.length + 1), pulse:0, pulseAt:0 }));
  const anchorByKey = new Map(anchors.map(a => [a.key,a]));
  const points = [];
  const events = new Set();
  const ripples = [];
  let links = [];
  let cursor = 0;
  let inspecting = null;
  let inspectCount = 0;
  let improveCount = 0;
  let W=0,H=0,CX=0,CY=0,R=220;
  let rotY=.18, rotX=-.12, spinY=reduced?0:.075, spinX=reduced?0:.009;
  let visible=false, raf=0,lastMs=0,hoverId=null;
  let userHoldUntil=0;
  const readout=document.getElementById('neb-readout');
  const pop=document.getElementById('sphere-pop');
  const popAgent=document.getElementById('pop-agent');
  const popTitle=document.getElementById('pop-title');
  const popConf=document.getElementById('pop-conf');
  let popId=null;

  const bestTemplate = (p) => `${agentByKey.get(p.agentKey)?.name || '智能体'}提炼「${p.title}」：保留可复用结论，先校验输入与验收口径，再将稳定结果同步到相关知识节点。`;
  const nowLabel = () => new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  function spherePoint(i, total) {
    const base=fib(i,total); const layer=i%20===0?.90:(i%7===0?.95:1); return {x:base.x*layer,y:base.y*layer,z:base.z*layer};
  }
  function addPoint(agentKey,title,sourceTask,position) {
    const key=anchorByKey.has(agentKey)?agentKey:AGENTS[0].key;
    const p={id:`knowledge-${points.length+1}`,agentKey:key,title:title||'自主综合知识',sourceTask:sourceTask||title||'自主综合知识',bestAnswer:'',createdAt:nowLabel(),updatedAt:nowLabel(),confidence:.72+((points.length*17)%22)/100,learningScore:48+((points.length*13)%44),revisionCount:0,lastInspectedAt:'—',status:'learned',p:position||spherePoint(points.length, Math.max(190, points.length+1)),radius:position?.radius||1,birth:performance.now()};
    p.bestAnswer=bestTemplate(p); points.push(p); ripples.push({p:p.p,color:anchorByKey.get(key).color,born:performance.now()}); rebuildLinks(); emit('point:add',p); updateReadout(); kick(); return p;
  }
  function seed() {
    DOCS.forEach(d => { addPoint(d.agent,d.title,d.title); (TOPICS[d.id]||[]).forEach(t => addPoint(d.agent,t,d.title)); });
  }
  function rebuildLinks() {
    links=[];
    points.forEach((p,i)=>{
      const a=anchorByKey.get(p.agentKey); links.push({a:a,b:p,family:'agent'});
      const near=points.map((q,j)=>({q,j,d:1-dot(p.p,q.p)})).filter(x=>x.j!==i).sort((x,y)=>x.d-y.d).slice(0, points.length>130?4:3);
      near.forEach(x=>{if(i<x.j && x.d<.22) links.push({a:p,b:x.q,family:'mesh'});});
    });
  }
  function targetCount(){ const kb=window.World?.state?.kb?.total||1284; return Math.min(230,Math.max(points.length,70+Math.floor(Math.sqrt(kb)*3.5))); }
  function evolve(){ if(!visible || points.length>=targetCount()) return; const key=AGENTS[cursor++%AGENTS.length].key; addPoint(key,'自主合成知识点','自主学习'); }
  function emit(type,payload){ events.forEach(fn=>{try{fn({type,payload});}catch(e){console.warn('[nebula]',e);}}); }
  function chooseNext(){ if(!points.length)return null; const fresh=points.filter(p=>p.status==='learned'&&p.revisionCount===0); if(fresh.length && Math.random()<.4)return fresh[Math.floor(Math.random()*fresh.length)]; const low=points.slice().sort((a,b)=>a.confidence-b.confidence).slice(0,Math.max(1,Math.ceil(points.length*.25))); if(Math.random()<.25)return low[Math.floor(Math.random()*low.length)]; return points[Math.floor(Math.random()*points.length)]; }
  function inspect(id){ const p=typeof id==='string'?points.find(x=>x.id===id):id; if(!p)return null; inspecting=p; p.status='observing'; p.lastInspectedAt=nowLabel(); inspectCount++; emit('inspect:start',p); showPop(p); kick(); setTimeout(()=>{if(inspecting!==p)return; p.status='thinking'; refreshPop(); emit('inspect:thinking',p);},700); setTimeout(()=>{if(inspecting!==p)return; improve(p.id);},1700); return p; }
  function improve(id,result){ const p=points.find(x=>x.id===id); if(!p)return null; const answer=result||bestTemplate(p); if(answer.length>=p.bestAnswer.length || Math.random()<.82){p.bestAnswer=answer;p.confidence=Math.min(.99,p.confidence+.025);p.learningScore=Math.min(100,p.learningScore+3);} p.revisionCount++;p.updatedAt=nowLabel();p.lastInspectedAt=nowLabel();p.status='improved';improveCount++; ripples.push({p:p.p,color:anchorByKey.get(p.agentKey).color,born:performance.now()}); emit('inspect:written',p); emit('inspect:improved',p); refreshPop(); rebuildLinks(); updateReadout(); kick(); return p; }
  function inspectNext(){ const p=chooseNext(); return p&&inspect(p); }
  function getPoint(id){ return points.find(p=>p.id===id)||null; }
  function stats(){ return {points:points.length+anchors.length,links:links.length,coverage:Math.min(100,Math.round(points.length/targetCount()*100)),inspected:inspectCount,improved:improveCount,current:inspecting?.id||null}; }
  function showPop(p){ if(!pop||!p)return; popId=p.id; pop.hidden=false; if(popAgent){const a=agentByKey.get(p.agentKey);popAgent.textContent=a?.name||'智能体';popAgent.style.color=a?.color||'';} if(popTitle)popTitle.textContent=p.title; refreshPop(); }
  function refreshPop(){ if(!pop||pop.hidden||!popId)return; const p=points.find(x=>x.id===popId); if(!p){hidePop();return;} const s=project(p.p); pop.style.left=Math.round(s.x)+'px'; pop.style.top=Math.round(s.y)+'px'; if(popConf)popConf.textContent=`置信度 ${Math.round(p.confidence*100)}%`; }
  function hidePop(){ popId=null; if(pop)pop.hidden=true; }
  function resize(){ const r=cv.parentElement.getBoundingClientRect(); const dpr=Math.min(devicePixelRatio||1,3); W=Math.max(2,r.width);H=Math.max(2,r.height);cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0); const pad=Math.max(28,Math.min(84,W*.032)); const cat=W>=1920?Math.min(320,W*.22):Math.min(258,W*.215); const fig=W>=1920?Math.min(430,W*.30):Math.min(318,W*.245); const left=pad+cat+46,right=W-pad-fig-40,top=138,bottom=H-88;CX=(left+right)/2;CY=(top+bottom)/2;R=Math.max(150,Math.min((right-left)/2,(bottom-top)/2));kick();}
  function rotate(p){const cy=Math.cos(rotY),sy=Math.sin(rotY);let x=p.x*cy-p.z*sy,z=p.x*sy+p.z*cy;const cx=Math.cos(rotX),sx=Math.sin(rotX);return{x,y:p.y*cx-z*sx,z:p.y*sx+z*cx};}
  function project(p){const q=rotate(p),s=1/(1+q.z*.28);return{x:CX+q.x*R*s,y:CY+q.y*R*s,z:q.z,s};}
  function render(ms){ctx.clearRect(0,0,W,H);ctx.fillStyle=PAPER;ctx.fillRect(0,0,W,H);const grad=ctx.createRadialGradient(CX-R*.2,CY-R*.3,R*.05,CX,CY,R*1.12);grad.addColorStop(0,'rgba(64,132,220,.12)');grad.addColorStop(.62,'rgba(13,28,55,.05)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(CX,CY,R*1.08,0,TAU);ctx.fill();
    const P=new Map();anchors.forEach(a=>P.set(a.id,project(a.p)));points.forEach(p=>P.set(p.id,project(p.p)));
    ctx.save();ctx.strokeStyle='rgba(127,181,255,.10)';ctx.lineWidth=.55;for(let k=-2;k<=2;k++){ctx.beginPath();ctx.ellipse(CX,CY,R,Math.abs(k)*R*.26+R*.12,0,0,TAU);ctx.stroke();ctx.beginPath();ctx.ellipse(CX,CY,Math.abs(k)*R*.26+R*.12,R,0,0,TAU);ctx.stroke();}ctx.restore();
    links.forEach(l=>{const a=P.get(l.a.id),b=P.get(l.b.id);if(!a||!b)return;const active=inspecting&&(l.a===inspecting||l.b===inspecting);ctx.strokeStyle=l.family==='agent'?rgba(anchorByKey.get(l.a.agentKey||l.a.key)?.color||INK,active?.62:.22):rgba(INK,active?.42:.12);ctx.lineWidth=active?1.15:.65;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();});
    const items=anchors.map(a=>({o:a,s:P.get(a.id),anchor:true})).concat(points.map(p=>({o:p,s:P.get(p.id),anchor:false}))).sort((a,b)=>a.s.z-b.s.z);items.forEach(({o,s,anchor})=>{const color=anchor?o.color:anchorByKey.get(o.agentKey).color;const depth=.5+(s.z+1)*.25;ctx.globalAlpha=.3+depth*.65;if(anchor){const rr=7*s.s;ctx.fillStyle=color;ctx.beginPath();ctx.arc(s.x,s.y,rr,0,TAU);ctx.fill();ctx.strokeStyle=rgba(color,.8);ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(s.x,s.y,rr+4,0,TAU);ctx.stroke();if(o.pulse){ctx.strokeStyle=rgba(color,o.pulse*.7);ctx.beginPath();ctx.arc(s.x,s.y,rr+(1-o.pulse)*24,0,TAU);ctx.stroke();}}else{const rr=(2.1+depth*2.3)*s.s;ctx.fillStyle=color;ctx.beginPath();ctx.arc(s.x,s.y,rr,0,TAU);ctx.fill();if(o.id===hoverId||o===inspecting){ctx.strokeStyle=rgba(color,.95);ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(s.x,s.y,rr+5,0,TAU);ctx.stroke();}}});
    ripples.splice(0,ripples.length,...ripples.filter(x=>ms-x.born<1100));ripples.forEach(x=>{const s=project(x.p),age=(ms-x.born)/1100;ctx.strokeStyle=rgba(x.color,1-age);ctx.lineWidth=1;ctx.beginPath();ctx.arc(s.x,s.y,5+age*25,0,TAU);ctx.stroke();});ctx.globalAlpha=1;refreshPop();updateReadout();
  }
  function updateReadout(){if(!readout)return;const s=stats();readout.textContent=`节点 ${s.points} · 球状连接 ${s.links} · 覆盖率 ${s.coverage}%`+(s.current?` · 自动观测 ${s.inspected}`:'');}
  function frame(ms){raf=0;if(!visible){lastMs=0;return;}if(!lastMs)lastMs=ms;const dt=Math.min(.05,(ms-lastMs)/1000);lastMs=ms;if(!reduced){rotY+=spinY*dt;rotX+=spinX*dt;}render(ms);if(!reduced||ripples.length||inspecting)kick();}
  function kick(){if(!raf&&visible)raf=requestAnimationFrame(frame);}
  function pulse(key){const a=anchorByKey.get(key);if(a){a.pulse=1;a.pulseAt=performance.now();kick();}}
  cv.addEventListener('pointerdown',e=>{cv._drag={x:e.clientX,y:e.clientY};cv.setPointerCapture?.(e.pointerId);cv.classList.add('is-dragging');});
  cv.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();if(cv._drag){rotY+=(e.clientX-cv._drag.x)*.006;rotX+=(e.clientY-cv._drag.y)*.006;cv._drag={x:e.clientX,y:e.clientY};kick();return;}let best=null,bd=18;points.forEach(p=>{const s=project(p.p),d=Math.hypot(e.clientX-r.left-s.x,e.clientY-r.top-s.y);if(d<bd){bd=d;best=p.id;}});hoverId=best;});
  cv.addEventListener('pointerup',e=>{if(cv._drag){const r=cv.getBoundingClientRect();let best=null,bd=20;points.forEach(p=>{const s=project(p.p),d=Math.hypot(e.clientX-r.left-s.x,e.clientY-r.top-s.y);if(d<bd){bd=d;best=p.id;}});if(best)inspect(best);else hidePop();userHoldUntil=performance.now()+6000;}cv._drag=null;cv.classList.remove('is-dragging');});
  cv.addEventListener('pointerleave',()=>{cv._drag=null;hoverId=null;cv.classList.remove('is-dragging');});
  /* 知识目录条目：图谱定位改为「双击」触发；单击已让位给 window2 的交付审阅弹窗 */
  const rows=[...document.querySelectorAll('.atlas-catalog .shelf-row[data-doc]')];rows.forEach(row=>row.addEventListener('dblclick',()=>{const d=DOCS.find(x=>x.id===row.dataset.doc);if(d){const p=points.find(x=>x.sourceTask===d.title)||points.find(x=>x.agentKey===d.agent);if(p)inspect(p);}userHoldUntil=performance.now()+6000;}));
  function loopPulse(){anchors.forEach(a=>{const age=performance.now()-a.pulseAt;a.pulse=a.pulseAt?Math.max(0,1-age/1100):0;});}
  setInterval(()=>{loopPulse();if(visible&&performance.now()>userHoldUntil)inspectNext();},reduced?9000:5200);
  seed();resize();
  const page=cv.closest('.reel__page');new IntersectionObserver(es=>es.forEach(e=>{visible=e.isIntersecting;if(visible){kick();}}),{threshold:.05}).observe(page||cv);
  window.addEventListener('resize',resize);
  // 仅导出被外部调用的 API；inspectNext/improve/focus/unfocus/debug 为内部实现（见 ARCHITECTURE-REVIEW.md P1-10）
  window.Nebula={addKnowledge:(key,title,meta)=>addPoint(key,title,meta?.sourceTask||title),pulse,inspect,getPoint,stats,on:fn=>{events.add(fn);return()=>events.delete(fn);},docs:()=>DOCS};
  updateReadout();render(performance.now());
})();
const Nebula=window.Nebula;export{Nebula};