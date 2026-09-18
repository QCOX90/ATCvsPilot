(() => {
'use strict';
const $=id=>document.getElementById(id);
const state={experience:'freeplay',traffic:'relaxed',environment:'day',timer:null,spawned:[],started:false};
const profiles={
 relaxed:{max:4,interval:45000}, normal:{max:7,interval:28000}, rush:{max:11,interval:16000}, chaos:{max:16,interval:9000}
};
const gates=['730','731','732'];
const runways=['9','27','18C','36C'];
const types=['A300','B757','B767','MD11','B777'];
const destinations=['IND','DFW','ATL','MIA','EWR','LAX','SDF','ORD','IAH','PHX'];
const pick=a=>a[Math.floor(Math.random()*a.length)];
function bindPicker(id,key){
 const box=$(id); if(!box)return;
 box.addEventListener('click',e=>{const b=e.target.closest('button[data-'+key+']');if(!b)return;
  box.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state[key]=b.dataset[key];
  if(key==='experience') $('freeplayOptions')?.classList.toggle('hidden',state.experience!=='freeplay');
  if(key==='environment') applyEnvironment();
 });
}
function applyEnvironment(){
 document.body.dataset.environment=state.environment;
 if(window.MEMSurface?.setLightMode) MEMSurface.setLightMode(state.environment==='day');
}
function callsign(){return 'FDX'+String(100+Math.floor(Math.random()*9800));}
function spawnTraffic(){
 if(state.experience!=='freeplay'||!window.MEMSurface?.createPlane)return;
 const p=profiles[state.traffic]||profiles.relaxed;
 state.spawned=state.spawned.filter(x=>MEMSurface.state.planes.has(x.id));
 if(state.spawned.length>=p.max)return;
 const gate=pick(gates), coord=MEMSurface.gateCoord(gate); if(!coord)return;
 const cs=callsign(), type=pick(types), rw=pick(runways), dest=pick(destinations);
 const plane=MEMSurface.createPlane({label:cs,type,coord,state:'at-gate',meta:{gate,runway:rw,destination:dest,freeplay:true}});
 state.spawned.push(plane);
 addStrip(plane);
 const log=$('radioLog'); if(log){const d=document.createElement('div');d.className='radio-line pilot';d.innerHTML='<strong>PILOT</strong>'+cs+' · Gate '+gate+' · '+type+' · MEM → '+dest+' · ready for taxi, runway '+rw+'.';log.appendChild(d);log.scrollTop=log.scrollHeight;}
}
function addStrip(p){
 const box=$('flightStrips');if(!box)return;
 const el=document.createElement('div');el.className='flight-strip freeplay-strip';el.dataset.simPlane=p.id;
 el.innerHTML='<div class="strip-top"><span>'+p.label+'</span><span>'+p.type+'</span></div><div class="strip-meta"><span>GATE '+p.meta.gate+'</span><span>RWY '+p.meta.runway+'</span><span>MEM → '+p.meta.destination+'</span><span>CPU TRAFFIC</span></div><div class="strip-state">READY / MONITORING</div>';
 box.appendChild(el);
}
function clear(){
 if(state.timer){clearInterval(state.timer);state.timer=null}
 document.querySelectorAll('.freeplay-strip').forEach(x=>x.remove());
 if(window.MEMSurface) for(const p of state.spawned) MEMSurface.removePlane(p);
 state.spawned=[];
}
function startFreeplay(){
 clear(); state.started=true; applyEnvironment();
 const prof=profiles[state.traffic]||profiles.relaxed;
 const initial=state.traffic==='relaxed'?2:state.traffic==='normal'?4:state.traffic==='rush'?6:8;
 for(let i=0;i<initial;i++)setTimeout(spawnTraffic,i*900);
 state.timer=setInterval(spawnTraffic,prof.interval);
 const status=$('trainingStatus');if(status)status.textContent='FREE PLAY · '+state.traffic.toUpperCase()+' traffic · '+state.environment.toUpperCase()+' · no score pressure';
 const inst=$('instructorText');if(inst)inst.textContent='Free Play is active. Work or observe traffic at your own pace. More dynamic taxi, runway and arrival behavior will build on this traffic engine.';
 const score=$('scoreValue');if(score)score.textContent='—';
}
function boot(){
 bindPicker('experiencePicker','experience');bindPicker('trafficPicker','traffic');bindPicker('environmentPicker','environment');
 const launch=$('launchBtn'); if(launch)launch.addEventListener('click',()=>{setTimeout(()=>{if(state.experience==='freeplay')startFreeplay();else clear()},650)});
}
boot();window.MEMSimulator={state,startFreeplay,spawnTraffic,clear};
})();