// MEMSim 730 / 731 / 732 preload expansion.
// This file runs immediately after map-data.js and BEFORE map-core.js / aircraft-engine.js.
// It mutates the shared source data and routing graphs before MapLibre sources or adjacency lists are created.
(() => {
  'use strict';

  const GATE_POINTS = {
    '730': [-89.97938, 35.061906],
    '731': [-89.980025, 35.06193],
    '732': [-89.980721, 35.06194]
  };

  const DRIVE_LANES_730 = [
    {name:'730 South Drive Lane', coordinates:[[-89.981291,35.060758],[-89.978537,35.060683]]},
    {name:'730 North Drive Lane', coordinates:[[-89.981278,35.062244],[-89.978501,35.062174]]}
  ];

  const TAXI_730 = [[-89.977868,35.060745],[-89.977866,35.060908],[-89.977879,35.061054],[-89.977908,35.061088],[-89.977982,35.061122],[-89.978097,35.061126],[-89.978259,35.061119],[-89.980741,35.061197]];


  const SPSS_BUILDING_730 = [[-89.964136,35.063725],[-89.964179,35.062278],[-89.9642,35.062278],[-89.964203,35.062181],[-89.962887,35.062142],[-89.962884,35.06224],[-89.962861,35.062845],[-89.962781,35.062843],[-89.962777,35.062916],[-89.962769,35.062916],[-89.962752,35.06328],[-89.962762,35.06328],[-89.96276,35.063312],[-89.96284,35.063315],[-89.962824,35.063693],[-89.964136,35.063725]];
  const SPSS_BUILDING_CENTER_730 = [-89.96348620714609,35.06293596020201];

  const GATE_LINES_730 = [
    [[-89.980716,35.061942],[-89.98075,35.060741]],
    [[-89.980025,35.061932],[-89.980085,35.060725]],
    [[-89.97938,35.06191],[-89.979412,35.060707]]
  ];

  const R = 6371008.8;
  const hav = (a,b) => {
    const p1=a[1]*Math.PI/180,p2=b[1]*Math.PI/180,dp=(b[1]-a[1])*Math.PI/180,dl=(b[0]-a[0])*Math.PI/180;
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  };
  const projectSegment = (p,a,b) => {
    const lat0=(p[1]+a[1]+b[1])/3*Math.PI/180, sx=111320*Math.cos(lat0), sy=110540;
    const px=p[0]*sx,py=p[1]*sy,ax=a[0]*sx,ay=a[1]*sy,bx=b[0]*sx,by=b[1]*sy;
    const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
    const t=den?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/den)):0;
    const q=[(ax+t*dx)/sx,(ay+t*dy)/sy];
    return {coord:q,t,distance:Math.hypot(px-(ax+t*dx),py-(ay+t*dy))};
  };
  const metrics = coords => {
    const cum=[0];
    for(let i=1;i<coords.length;i++)cum.push(cum[i-1]+hav(coords[i-1],coords[i]));
    return {cum,distance:cum[cum.length-1]||0};
  };
  const pointAt = (coords,cum,d) => {
    d=Math.max(0,Math.min(cum[cum.length-1]||0,d));
    for(let i=1;i<cum.length;i++)if(d<=cum[i]){
      const span=cum[i]-cum[i-1],t=span?(d-cum[i-1])/span:0;
      return [coords[i-1][0]+(coords[i][0]-coords[i-1][0])*t,coords[i-1][1]+(coords[i][1]-coords[i-1][1])*t];
    }
    return coords[coords.length-1].slice();
  };
  const slice = (coords,cum,d1,d2) => {
    const forward=d2>=d1,lo=Math.min(d1,d2),hi=Math.max(d1,d2),out=[pointAt(coords,cum,lo)];
    for(let i=1;i<cum.length-1;i++)if(cum[i]>lo&&cum[i]<hi)out.push(coords[i].slice());
    out.push(pointAt(coords,cum,hi));
    return forward?out:out.reverse();
  };
  const polyProject = (p,coords) => {
    const m=metrics(coords); let best=null;
    for(let i=1;i<coords.length;i++){
      const pr=projectSegment(p,coords[i-1],coords[i]), seg=m.cum[i]-m.cum[i-1], along=m.cum[i-1]+pr.t*seg;
      if(!best||pr.distance<best.distance)best={...pr,distanceAlong:along,segment:i-1,cum:m.cum,total:m.distance};
    }
    return best;
  };
  const cross=(u,v)=>u[0]*v[1]-u[1]*v[0];
  const segHit=(a,b,c,d)=>{
    const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=cross(r,s);
    if(Math.abs(den)<1e-14)return null;
    const ca=[c[0]-a[0],c[1]-a[1]],t=cross(ca,s)/den,u=cross(ca,r)/den;
    if(t<-1e-9||t>1+1e-9||u<-1e-9||u>1+1e-9)return null;
    return [a[0]+r[0]*t,a[1]+r[1]*t];
  };
  const lineHit=(A,B)=>{
    for(let i=1;i<A.length;i++)for(let j=1;j<B.length;j++){
      const h=segHit(A[i-1],A[i],B[j-1],B[j]); if(h)return h;
    }
    return null;
  };

  // SPSS building: exact single Polygon from the supplied GeoJSON.
  // Keep this as ONE feature/footprint; do not split the outline into internal pieces.
  if(!HUB_POLYGONS.features.some(f=>f?.properties?.name==='SPSS Building')){
    HUB_POLYGONS.features.push({
      type:'Feature',
      properties:{name:'SPSS Building',height:8.3,featureType:'Building / polygon',source:'730 preload v3'},
      geometry:{type:'Polygon',coordinates:[SPSS_BUILDING_730.map(c=>c.slice())]}
    });
  }
  if(Array.isArray(HUB_LABELS?.features)&&!HUB_LABELS.features.some(f=>f?.properties?.name==='SPSS Building')){
    HUB_LABELS.features.push({
      type:'Feature',
      properties:{name:'SPSS Building',featureType:'Building / polygon',source:'730 preload v3'},
      geometry:{type:'Point',coordinates:SPSS_BUILDING_CENTER_730.slice()}
    });
  }
  if(Array.isArray(SEARCH_INDEX)&&!SEARCH_INDEX.some(x=>x?.name==='SPSS Building')){
    const xs=SPSS_BUILDING_730.map(c=>c[0]), ys=SPSS_BUILDING_730.map(c=>c[1]);
    SEARCH_INDEX.push({
      name:'SPSS Building',
      type:'Building / polygon',
      coord:SPSS_BUILDING_CENTER_730.slice(),
      bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]
    });
  }

  // 1) Gate dots + search entries are present BEFORE map-core builds its sources/index helpers.
  for(const gate of ['730','731','732']){
    const coord=GATE_POINTS[gate].slice();
    if(!GATES.features.some(f=>String(f?.properties?.gate||'')===gate)){
      GATES.features.push({type:'Feature',properties:{gate,name:`Gate ${gate}`,featureType:'Aircraft gate',source:'730 preload v3'},geometry:{type:'Point',coordinates:coord.slice()}});
    }
    if(Array.isArray(SEARCH_INDEX)&&!SEARCH_INDEX.some(x=>x?.name===`Gate ${gate}`)){
      SEARCH_INDEX.push({name:`Gate ${gate}`,type:'Aircraft gate',coord:coord.slice(),bbox:[coord[0],coord[1],coord[0],coord[1]]});
    }
  }

  // 2) Drive lanes are in the initial blue drive-lane GeoJSON before MapLibre source creation.
  for(const lane of DRIVE_LANES_730){
    if(!DRIVE_LANES.features.some(f=>f?.properties?.label===lane.name)){
      DRIVE_LANES.features.push({type:'Feature',properties:{label:lane.name,source:'730 preload v3',oneWay:0},geometry:{type:'LineString',coordinates:lane.coordinates.map(c=>c.slice())}});
    }
  }

  // 3) Aircraft taxi lane + 3 gate centerlines are in the initial yellow airfield source.
  if(!AIRFIELD_GEOJSON.features.some(f=>f?.properties?.name==='730 Taxi Lane')){
    AIRFIELD_GEOJSON.features.push({type:'Feature',properties:{kind:'taxi-centerline',name:'730 Taxi Lane',source:'730 preload v3'},geometry:{type:'LineString',coordinates:TAXI_730.map(c=>c.slice())}});
  }

  // Pair each mapped vertical line to the nearest gate dot.
  const unused=new Set([0,1,2]);
  const pairs=[];
  for(const gate of ['730','731','732']){
    let best=null;
    for(const i of unused){
      const ln=GATE_LINES_730[i],d=Math.min(hav(GATE_POINTS[gate],ln[0]),hav(GATE_POINTS[gate],ln[ln.length-1]));
      if(!best||d<best.d)best={i,d,line:ln.map(c=>c.slice())};
    }
    if(best){unused.delete(best.i);pairs.push({gate,line:best.line});}
  }

  const intersections=[];
  for(const pair of pairs){
    let h=lineHit(pair.line,TAXI_730);
    if(!h)h=polyProject(GATE_POINTS[pair.gate],TAXI_730)?.coord;
    if(!h)continue;
    const tp=polyProject(h,TAXI_730);
    intersections.push({...pair,hit:tp.coord,distanceAlong:tp.distanceAlong});

    let raw=pair.line.map(c=>c.slice()),dot=GATE_POINTS[pair.gate].slice();
    if(hav(dot,raw[raw.length-1])<hav(dot,raw[0]))raw.reverse();
    if(hav(dot,raw[0])>.5)raw.unshift(dot); else raw[0]=dot;
    if(!AIRFIELD_GEOJSON.features.some(f=>f?.properties?.name===`Gate ${pair.gate} centerline`)){
      AIRFIELD_GEOJSON.features.push({type:'Feature',properties:{kind:'taxi-centerline',name:`Gate ${pair.gate} centerline`,gate:pair.gate,source:'730 preload v3'},geometry:{type:'LineString',coordinates:raw}});
    }
  }

  // 4) Build aircraft routing graph BEFORE aircraft-engine creates AIR_GRAPH_ADJ.
  // Connect the east end of the new taxi lane to the nearest existing aircraft graph segment.
  const originalAirEdgeCount=AIR_GRAPH_EDGES.length;
  const addAirNode=coord=>{AIR_GRAPH_NODES.push(coord.slice());return AIR_GRAPH_NODES.length-1;};
  const addAirEdge=(a,b,coords,source)=>{
    const m=metrics(coords); if(a===b||m.distance<.05)return null;
    const edge={id:AIR_GRAPH_EDGES.length,a,b,distance:m.distance,coords:coords.map(c=>c.slice()),virtual:0,runways:[],source};
    AIR_GRAPH_EDGES.push(edge); return edge;
  };
  const nearNode=(coord,limit=AIR_GRAPH_NODES.length,snap=1.5)=>{
    let node=-1,d=Infinity; for(let i=0;i<limit;i++){const x=hav(coord,AIR_GRAPH_NODES[i]);if(x<d){d=x;node=i;}}
    return d<=snap?{node,d}:null;
  };
  const existingOrNew=(coord,snap=1.5)=>nearNode(coord,AIR_GRAPH_NODES.length,snap)?.node ?? addAirNode(coord);

  function connectPointToOriginalAirGraph(coord){
    const nodeSnap=nearNode(coord,AIR_GRAPH_NODES.length,2.0); if(nodeSnap)return nodeSnap.node;
    let best=null;
    for(let ei=0;ei<originalAirEdgeCount;ei++){
      const e=AIR_GRAPH_EDGES[ei],m=metrics(e.coords);
      for(let i=1;i<e.coords.length;i++){
        const pr=projectSegment(coord,e.coords[i-1],e.coords[i]),seg=m.cum[i]-m.cum[i-1],along=m.cum[i-1]+pr.t*seg;
        if(!best||pr.distance<best.distance)best={e,coord:pr.coord,distance:pr.distance,along,cum:m.cum};
      }
    }
    if(!best||best.distance>12)return existingOrNew(coord,1.5);
    const junction=existingOrNew(best.coord,1.0);
    if(junction!==best.e.a)addAirEdge(junction,best.e.a,slice(best.e.coords,best.cum,best.along,0),'730 connection split A');
    if(junction!==best.e.b)addAirEdge(junction,best.e.b,slice(best.e.coords,best.cum,best.along,best.cum[best.cum.length-1]),'730 connection split B');
    if(hav(coord,best.coord)<=1.0)return junction;
    const endpoint=existingOrNew(coord,1.0); addAirEdge(endpoint,junction,[coord,best.coord],'730 taxi connector'); return endpoint;
  }

  const taxiM=metrics(TAXI_730);
  const breaks=[{distance:0,coord:TAXI_730[0].slice(),node:connectPointToOriginalAirGraph(TAXI_730[0])}];
  for(const it of intersections)breaks.push({distance:it.distanceAlong,coord:it.hit.slice(),node:existingOrNew(it.hit,1.0)});
  breaks.push({distance:taxiM.distance,coord:TAXI_730[TAXI_730.length-1].slice(),node:existingOrNew(TAXI_730[TAXI_730.length-1],1.0)});
  breaks.sort((a,b)=>a.distance-b.distance);
  const clean=[];
  for(const b of breaks){
    const p=clean[clean.length-1];
    if(p&&Math.abs(p.distance-b.distance)<.15)continue;
    clean.push(b);
  }
  for(let i=1;i<clean.length;i++)addAirEdge(clean[i-1].node,clean[i].node,slice(TAXI_730,taxiM.cum,clean[i-1].distance,clean[i].distance),'730 Taxi Lane');

  for(const it of intersections){
    let raw=it.line.map(c=>c.slice()),dot=GATE_POINTS[it.gate].slice();
    if(hav(dot,raw[raw.length-1])<hav(dot,raw[0]))raw.reverse();
    if(hav(dot,raw[0])>.5)raw.unshift(dot); else raw[0]=dot;
    const gm=metrics(raw),gp=polyProject(it.hit,raw),usable=Math.max(0,gp?.distanceAlong??gm.distance);
    const gateNode=existingOrNew(dot,1.0),hitNode=existingOrNew(it.hit,1.0),stage=Math.min(28,Math.max(8,usable*.55));
    const stageCoord=pointAt(raw,gm.cum,stage),stageNode=existingOrNew(stageCoord,1.0);
    if(stage>.5)addAirEdge(gateNode,stageNode,slice(raw,gm.cum,0,stage),`Gate ${it.gate} entry`);
    if(usable-stage>.5)addAirEdge(stageNode,hitNode,slice(raw,gm.cum,stage,usable),`Gate ${it.gate} entry`);
  }

  window.MEM_730_PRELOAD_V3={loaded:true,gates:['730','731','732'],driveLanes:2,taxiLanes:1,gateLines:intersections.length,spssBuilding:true};
})();
