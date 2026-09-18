(() => {
  'use strict';
  const NM_M=1852;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const norm=d=>(d%360+360)%360;
  const diff=(a,b)=>((b-a+540)%360)-180;

  class RadarEngine{
    constructor(canvas){
      this.canvas=canvas;this.ctx=canvas.getContext('2d');this.tracks=new Map();this.running=false;this.last=0;this.raf=null;this.rangeNm=20;this.center={x:0,y:0};this.selected=null;this.onTrackClick=null;this.onUpdate=null;this._resizeObserver=new ResizeObserver(()=>this.resize());this._resizeObserver.observe(canvas);this.resize();this.bind();
    }
    resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.max(1,Math.round(r.width*dpr));this.canvas.height=Math.max(1,Math.round(r.height*dpr));this.ctx.setTransform(dpr,0,0,dpr,0,0);this.w=r.width;this.h=r.height;this.draw();}
    bind(){this.canvas.addEventListener('pointerdown',e=>{const r=this.canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=null;for(const t of this.tracks.values()){const p=this.toScreen(t.x,t.y),d=Math.hypot(p.x-x,p.y-y);if(d<28&&(!best||d<best.d))best={t,d};}if(best){this.selected=best.t.id;this.onTrackClick?.(best.t);this.draw();}});}
    addTrack(o){const t={id:o.id,label:o.label||o.id,x:o.x||0,y:o.y||0,heading:norm(o.heading||0),targetHeading:norm(o.heading||0),altitude:o.altitude||5000,targetAltitude:o.altitude||5000,speed:o.speed||210,targetSpeed:o.speed||210,turnRate:o.turnRate||3,climbRate:o.climbRate||1500,state:o.state||'vector',color:o.color||null,meta:o.meta||{}};this.tracks.set(t.id,t);if(!this.selected)this.selected=t.id;this.draw();return t;}
    clear(){this.tracks.clear();this.selected=null;this.draw();}
    command(id,cmd={}){const t=this.tracks.get(id);if(!t)return null;if(Number.isFinite(cmd.heading))t.targetHeading=norm(cmd.heading);if(Number.isFinite(cmd.altitude))t.targetAltitude=Math.max(0,cmd.altitude);if(Number.isFinite(cmd.speed))t.targetSpeed=clamp(cmd.speed,60,350);if(cmd.state)t.state=cmd.state;return t;}
    start(){if(this.running)return;this.running=true;this.last=0;const loop=ts=>{if(!this.running)return;const dt=this.last?Math.min(.25,(ts-this.last)/1000):0;this.last=ts;this.step(dt);this.draw();this.raf=requestAnimationFrame(loop)};this.raf=requestAnimationFrame(loop);}
    stop(){this.running=false;if(this.raf)cancelAnimationFrame(this.raf);this.raf=null;}
    step(dt){for(const t of this.tracks.values()){const d=diff(t.heading,t.targetHeading),max=t.turnRate*dt;t.heading=norm(t.heading+clamp(d,-max,max));const altRate=(t.targetAltitude-t.altitude)>=0?1800:1600;const da=clamp(t.targetAltitude-t.altitude,-altRate*dt/60,altRate*dt/60);t.altitude+=da;const ds=clamp(t.targetSpeed-t.speed,-8*dt,8*dt);t.speed+=ds;const nmps=t.speed/3600;const h=t.heading*Math.PI/180;t.x+=Math.sin(h)*nmps*dt;t.y+=Math.cos(h)*nmps*dt;}this.onUpdate?.([...this.tracks.values()]);}
    toScreen(x,y){const s=Math.min(this.w,this.h)*.43/this.rangeNm;return{x:this.w/2+x*s,y:this.h/2-y*s};}
    draw(){const c=this.ctx,w=this.w||0,h=this.h||0;if(!w||!h)return;c.clearRect(0,0,w,h);c.fillStyle='#03100c';c.fillRect(0,0,w,h);const center=this.toScreen(0,0),s=Math.min(w,h)*.43/this.rangeNm;c.save();c.strokeStyle='rgba(89,190,140,.19)';c.lineWidth=1;for(let r=5;r<=this.rangeNm;r+=5){c.beginPath();c.arc(center.x,center.y,r*s,0,Math.PI*2);c.stroke();c.fillStyle='rgba(122,210,166,.5)';c.font='10px ui-monospace,Consolas,monospace';c.fillText(`${r}`,center.x+4,center.y-r*s+11)}for(let deg=0;deg<360;deg+=30){const a=deg*Math.PI/180;c.beginPath();c.moveTo(center.x,center.y);c.lineTo(center.x+Math.sin(a)*this.rangeNm*s,center.y-Math.cos(a)*this.rangeNm*s);c.stroke()}c.restore();this.drawRunways(c,center,s);for(const t of this.tracks.values())this.drawTrack(c,t);}
    drawRunways(c,center,s){const rw=MEM_ATC_REFERENCE.runways;const seen=new Set();c.save();c.strokeStyle='rgba(225,240,230,.6)';c.lineWidth=2;for(const key of ['9','36L','36C','36R']){const r=rw[key],id=r.physicalKey;if(seen.has(id))continue;seen.add(id);const lenNm=id==='09_27'?1.47:id==='18C_36C'?1.83:1.53;const hdg=r.heading*Math.PI/180;const dx=Math.sin(hdg)*lenNm*s*.5,dy=-Math.cos(hdg)*lenNm*s*.5;c.beginPath();c.moveTo(center.x-dx,center.y-dy);c.lineTo(center.x+dx,center.y+dy);c.stroke()}c.fillStyle='rgba(225,240,230,.72)';c.font='10px ui-monospace,Consolas,monospace';c.fillText('MEM',center.x+7,center.y-7);c.restore();}
    drawTrack(c,t){const p=this.toScreen(t.x,t.y),sel=t.id===this.selected;c.save();c.strokeStyle=sel?'#e8fff4':'#77ddb0';c.fillStyle=sel?'#e8fff4':'#77ddb0';c.lineWidth=sel?2:1.4;c.beginPath();c.rect(p.x-3,p.y-3,6,6);c.stroke();const trail=17,hr=t.heading*Math.PI/180;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-Math.sin(hr)*trail,p.y+Math.cos(hr)*trail);c.stroke();c.font='11px ui-monospace,Consolas,monospace';const alt=Math.round(t.altitude/100),spd=Math.round(t.speed/10)*10;c.fillText(t.label,p.x+9,p.y-10);c.fillText(`${String(alt).padStart(3,'0')} ${spd}`,p.x+9,p.y+3);const hdg=String(Math.round(t.heading)%360||360).padStart(3,'0');c.fillText(`H${hdg}`,p.x+9,p.y+16);c.restore();}
  }

  window.MEMRadar={RadarEngine};
})();
