(() => {
  'use strict';

  const R = 6371008.8;
  const rad = d => d * Math.PI / 180;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const lerp = (a,b,t) => a + (b-a)*t;
  const norm360 = d => (d % 360 + 360) % 360;
  const angleDiff = (a,b) => ((b-a+540)%360)-180;

  function haversine(a,b){
    const p1=rad(a[1]),p2=rad(b[1]),dp=rad(b[1]-a[1]),dl=rad(b[0]-a[0]);
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }
  function localVector(a,b){
    const lat=rad((a[1]+b[1])/2);
    return [(b[0]-a[0])*111320*Math.cos(lat),(b[1]-a[1])*110540];
  }
  function headingDeg(a,b){const [e,n]=localVector(a,b);return norm360(Math.atan2(e,n)*180/Math.PI);}
  function metersToCoord(origin,east,north){return [origin[0]+east/(111320*Math.cos(rad(origin[1]))),origin[1]+north/110540];}
  function coordAtLineDistance(coords,d){
    if(!coords?.length)return null;
    if(coords.length===1)return coords[0].slice();
    let left=Math.max(0,d);
    for(let i=1;i<coords.length;i++){
      const seg=haversine(coords[i-1],coords[i]);
      if(left<=seg){const t=seg?left/seg:0;return [lerp(coords[i-1][0],coords[i][0],t),lerp(coords[i-1][1],coords[i][1],t)];}
      left-=seg;
    }
    return coords[coords.length-1].slice();
  }
  function lineDistance(coords){let d=0;for(let i=1;i<coords.length;i++)d+=haversine(coords[i-1],coords[i]);return d;}

  class MinHeap{
    constructor(){this.a=[]}
    push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p][0]<=v[0])break;a[i]=a[p];i=p}a[i]=v}
    pop(){const a=this.a;if(!a.length)return null;const r=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;while(true){let l=i*2+1,rn=l+1,s=i;if(l<a.length&&a[l][0]<a[s][0])s=l;if(rn<a.length&&a[rn][0]<a[s][0])s=rn;if(s===i)break;[a[i],a[s]]=[a[s],a[i]];i=s}}return r}
    get length(){return this.a.length}
  }

  const state={
    map:null,adj:[],edgeById:new Map(),three:{scene:null,camera:null,renderer:null,loader:null,template:null,layer:null},
    planes:new Map(),routeSourceReady:false,labelsReady:false,selectedPlane:null
  };

  function buildAdj(){
    state.adj=Array.from({length:AIR_GRAPH_NODES.length},()=>[]);
    state.edgeById.clear();
    for(const e of AIR_GRAPH_EDGES){state.edgeById.set(e.id,e);state.adj[e.a].push({to:e.b,edge:e});state.adj[e.b].push({to:e.a,edge:e});}
  }


  function buildSurfaceMarkings(){
    const features=[];
    const seen=new Set();
    // Runway designators from the FAA-aligned airport reference data.
    for(const [name,r] of Object.entries(MEM_ATC_REFERENCE.runways||{})){
      features.push({type:'Feature',properties:{kind:'runway-label',name},geometry:{type:'Point',coordinates:r.threshold}});
    }
    // Surface hold bars are generated at both ends of graph edges that cross a runway.
    // This makes runway boundaries visible throughout the playable graph while keeping movement tied to MEMSim geometry.
    for(const e of AIR_GRAPH_EDGES){
      if(!e.runways?.length || !e.coords?.length) continue;
      for(const endpoint of [0,e.coords.length-1]){
        const c=e.coords[endpoint], other=e.coords[endpoint===0?Math.min(1,e.coords.length-1):Math.max(0,e.coords.length-2)];
        const key=e.runways.join('/')+':'+c.map(v=>v.toFixed(6)).join(','); if(seen.has(key))continue; seen.add(key);
        const h=headingDeg(c,other)+90, hr=h*Math.PI/180, half=10;
        const a=metersToCoord(c,Math.sin(hr)*half,Math.cos(hr)*half), b=metersToCoord(c,-Math.sin(hr)*half,-Math.cos(hr)*half);
        features.push({type:'Feature',properties:{kind:'holdbar',runway:e.runways.join('/')},geometry:{type:'LineString',coordinates:[a,b]}});
      }
    }
    return {type:'FeatureCollection',features};
  }

  function addMapSources(){
    const map=state.map;
    map.addSource('satellite',{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Tiles © Esri'});
    map.addLayer({id:'satellite-imagery',type:'raster',source:'satellite',layout:{visibility:'none'},paint:{'raster-opacity':.94,'raster-saturation':-.08,'raster-contrast':.08}});
    map.addSource('hub-polygons',{type:'geojson',data:HUB_POLYGONS});
    map.addSource('hub-labels',{type:'geojson',data:HUB_LABELS});
    map.addSource('gates',{type:'geojson',data:GATES});
    map.addSource('airfield',{type:'geojson',data:AIRFIELD_GEOJSON});
    map.addSource('atc-taxi-labels',{type:'geojson',data:{type:'FeatureCollection',features:MEM_ATC_REFERENCE.taxiwayLabels.map((x,i)=>({type:'Feature',properties:{name:x.name,id:i},geometry:{type:'Point',coordinates:x.coord}}))}});
    map.addSource('atc-route',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addSource('atc-hold',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addSource('atc-surface-markings',{type:'geojson',data:buildSurfaceMarkings()});
    map.addSource('atc-planes',{type:'geojson',data:{type:'FeatureCollection',features:[]}});

    map.addLayer({id:'atc-runways',type:'fill',source:'airfield',filter:['==',['get','kind'],'runway'],paint:{'fill-color':'#3e4851','fill-opacity':.82}});
    map.addLayer({id:'atc-runway-outline',type:'line',source:'airfield',filter:['==',['get','kind'],'runway'],paint:{'line-color':'#97a6b1','line-width':['interpolate',['linear'],['zoom'],10,.7,17,2.2],'line-opacity':.72}});
    map.addLayer({id:'atc-taxi',type:'line',source:'airfield',filter:['==',['get','kind'],'taxi-centerline'],paint:{'line-color':'#d4a82d','line-width':['interpolate',['linear'],['zoom'],10,.55,15,1.5,19,4.2],'line-opacity':.9}});
    map.addLayer({id:'atc-buildings',type:'fill-extrusion',source:'hub-polygons',minzoom:11,paint:{'fill-extrusion-color':'#253544','fill-extrusion-height':['coalesce',['get','height'],7],'fill-extrusion-opacity':.78}});
    map.addLayer({id:'atc-gates',type:'circle',source:'gates',paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,1.5,17,5.5],'circle-color':'#7cc7ef','circle-stroke-color':'#07131f','circle-stroke-width':1.4}});
    map.addLayer({id:'atc-route-line',type:'line',source:'atc-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#5ce1e6','line-width':['interpolate',['linear'],['zoom'],10,2,17,6],'line-opacity':.82,'line-dasharray':[1.5,1.4]}});
    map.addLayer({id:'atc-hold-bars',type:'line',source:'atc-surface-markings',filter:['==',['get','kind'],'holdbar'],layout:{'line-cap':'butt'},paint:{'line-color':'#ffd21f','line-width':['interpolate',['linear'],['zoom'],10,1.5,15,3.2,19,7],'line-opacity':.96}});
    map.addLayer({id:'atc-runway-designators',type:'symbol',source:'atc-surface-markings',filter:['==',['get','kind'],'runway-label'],minzoom:10,layout:{'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],10,11,15,16,19,23],'text-font':['Open Sans Bold'],'text-allow-overlap':true},paint:{'text-color':'#ffffff','text-halo-color':'#101820','text-halo-width':3}});
    map.addLayer({id:'atc-hold-circle',type:'circle',source:'atc-hold',paint:{'circle-radius':['interpolate',['linear'],['zoom'],10,3,17,9],'circle-color':'#ffbf47','circle-stroke-color':'#ffffff','circle-stroke-width':2}});
    map.addLayer({id:'atc-taxiway-labels',type:'symbol',source:'atc-taxi-labels',minzoom:10,layout:{'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],10,10,14,13,17,17,19,20],'text-font':['Open Sans Bold'],'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#ffd21f','text-halo-color':'#050b10','text-halo-width':3}});
    map.addLayer({id:'atc-plane-labels',type:'symbol',source:'atc-planes',layout:{'text-field':['get','label'],'text-size':12,'text-offset':[0,1.5],'text-font':['Open Sans Bold'],'text-allow-overlap':true,'text-ignore-placement':true},paint:{'text-color':'#ffffff','text-halo-color':'#31105b','text-halo-width':2}});
    state.routeSourceReady=true;state.labelsReady=true;
  }

  function initThree(){
    if(!window.THREE||!THREE.GLTFLoader)return;
    const map=state.map,three=state.three;
    three.scene=new THREE.Scene();three.camera=new THREE.Camera();
    three.scene.add(new THREE.HemisphereLight(0xffffff,0x334455,2.2));
    const sun=new THREE.DirectionalLight(0xffffff,2.4);sun.position.set(80,-80,150);three.scene.add(sun);
    three.layer={id:'atc-aircraft-3d',type:'custom',renderingMode:'3d',onAdd:(m,gl)=>{three.renderer=new THREE.WebGLRenderer({canvas:m.getCanvas(),context:gl,antialias:true});three.renderer.autoClear=false;},render:(gl,matrix)=>{if(!three.renderer)return;three.camera.projectionMatrix=new THREE.Matrix4().fromArray(matrix);three.renderer.resetState?.();three.renderer.render(three.scene,three.camera);if(state.planes.size)map.triggerRepaint();}};
    map.addLayer(three.layer);
    three.loader=new THREE.GLTFLoader();
    three.loader.load('./a300.glb',gltf=>{
      const source=gltf.scene;source.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(source),size=new THREE.Vector3();box.getSize(size);const scale=54.1/Math.max(.001,size.z);source.scale.multiplyScalar(scale);source.rotation.x+=Math.PI/2;source.updateMatrixWorld(true);const b2=new THREE.Box3().setFromObject(source),center=new THREE.Vector3();b2.getCenter(center);source.position.x-=center.x;source.position.y-=center.y;source.position.z-=b2.min.z;source.updateMatrixWorld(true);const group=new THREE.Group();group.add(source);group.traverse(o=>{if(o.isMesh){o.frustumCulled=false;o.castShadow=false;o.receiveShadow=false}});three.template=group;
      for(const p of state.planes.values())ensureMesh(p);map.triggerRepaint();
    },undefined,err=>console.warn('Aircraft GLB failed to load; map labels remain usable.',err));
  }

  const typeLengths={A300:54.1,B757:47.3,B767:54.9,B777:63.7,MD11:61.2,ATR42:22.7,CARGO:54.1};
  function ensureMesh(p){
    if(p.mesh||!state.three.template||!state.three.scene)return;
    p.mesh=state.three.template.clone(true);p.mesh.matrixAutoUpdate=false;state.three.scene.add(p.mesh);updateMesh(p);
  }
  function updateMesh(p){
    if(!p.mesh||!window.THREE)return;
    const mc=maplibregl.MercatorCoordinate.fromLngLat(p.coord,Math.max(0,p.altitude||0));
    const meter=mc.meterInMercatorCoordinateUnits();const sizeScale=(typeLengths[p.type]||54.1)/54.1;
    const t=new THREE.Matrix4().makeTranslation(mc.x,mc.y,mc.z),s=new THREE.Matrix4().makeScale(meter*sizeScale,-meter*sizeScale,meter*sizeScale),h=new THREE.Matrix4().makeRotationZ(-rad(p.heading||0)),pitch=new THREE.Matrix4().makeRotationX(rad(p.pitch||0)),bank=new THREE.Matrix4().makeRotationY(rad(p.bank||0));
    p.mesh.matrix.copy(t).multiply(s).multiply(h).multiply(pitch).multiply(bank);p.mesh.matrixWorldNeedsUpdate=true;
  }
  function refreshPlaneLabels(){
    if(!state.map?.getSource('atc-planes'))return;
    const features=[...state.planes.values()].filter(p=>!p.hidden).map(p=>({type:'Feature',properties:{id:p.id,label:p.label,state:p.state||''},geometry:{type:'Point',coordinates:p.coord}}));
    state.map.getSource('atc-planes').setData({type:'FeatureCollection',features});
  }

  function createPlane(opts={}){
    const p={id:opts.id||`p-${Date.now()}-${Math.random().toString(16).slice(2)}`,label:opts.label||'FDX1500',type:opts.type||'A300',coord:(opts.coord||MEM_ATC_REFERENCE.airport.center).slice(),heading:opts.heading||0,altitude:opts.altitude||0,pitch:0,bank:0,state:opts.state||'parked',speedKt:opts.speedKt||0,targetSpeedKt:0,mesh:null,meta:opts.meta||{}};
    state.planes.set(p.id,p);ensureMesh(p);updateMesh(p);refreshPlaneLabels();return p;
  }
  function removePlane(p){if(!p)return;if(p.mesh&&state.three.scene)state.three.scene.remove(p.mesh);state.planes.delete(p.id);refreshPlaneLabels();}
  function clearPlanes(){for(const p of [...state.planes.values()])removePlane(p);}
  function updatePlane(p,patch){Object.assign(p,patch||{});updateMesh(p);refreshPlaneLabels();}

  function gateCoord(gate){const f=GATES.features.find(x=>String(x.properties?.gate||'')===String(gate));return f?f.geometry.coordinates.slice():null;}
  function nearestNode(coord){let node=-1,d=Infinity;for(let i=0;i<AIR_GRAPH_NODES.length;i++){const x=haversine(coord,AIR_GRAPH_NODES[i]);if(x<d){d=x;node=i}}return {node,distance:d};}
  function nearestTaxiLabel(coord,maxMeters=70){let best=null;for(const item of MEM_ATC_REFERENCE.taxiwayLabels||[]){const d=haversine(coord,item.coord);if(d<=maxMeters&&(!best||d<best.distance))best={name:item.name,coord:item.coord.slice(),distance:d};}return best;}

  function pathfind(startNode,targetNode,options={}){
    const avoidRunways=new Set(options.avoidRunways||[]),blockedEdges=new Set(options.blockedEdges||[]),N=state.adj.length;
    const dist=new Float64Array(N);dist.fill(Infinity);dist[startNode]=0;const prev=Array(N).fill(null),seen=new Uint8Array(N),heap=new MinHeap();heap.push([0,startNode]);
    while(heap.length){const [du,u]=heap.pop();if(seen[u])continue;seen[u]=1;if(u===targetNode)break;for(const it of state.adj[u]){if(blockedEdges.has(it.edge.id))continue;if((it.edge.runways||[]).some(r=>avoidRunways.has(r)))continue;const nd=du+(it.edge.distance||lineDistance(it.edge.coords));if(nd<dist[it.to]){dist[it.to]=nd;prev[it.to]={node:u,edge:it.edge};heap.push([nd,it.to]);}}}
    if(!isFinite(dist[targetNode]))return null;
    const steps=[];let cur=targetNode;while(cur!==startNode){const p=prev[cur];if(!p)return null;steps.push({from:p.node,to:cur,edge:p.edge});cur=p.node}steps.reverse();
    const coords=[];for(const st of steps){const cs=st.edge.a===st.from&&st.edge.b===st.to?st.edge.coords:st.edge.coords.slice().reverse();for(const c of cs){const last=coords[coords.length-1];if(!last||haversine(last,c)>.2)coords.push(c.slice())}}
    return {distance:dist[targetNode],steps,coords};
  }

  function findHoldTarget(startCoord,runwayDesignation){
    const rw=MEM_ATC_REFERENCE.runways[runwayDesignation],physical=rw.physicalKey,threshold=rw.threshold,start=nearestNode(startCoord).node;
    const candidates=[];
    for(const e of AIR_GRAPH_EDGES){if(!(e.runways||[]).includes(physical))continue;let md=Infinity;for(const c of e.coords)md=Math.min(md,haversine(c,threshold));candidates.push({edge:e,d:md});}
    candidates.sort((a,b)=>a.d-b.d);
    let best=null;
    for(const c of candidates.slice(0,20))for(const node of [c.edge.a,c.edge.b]){
      const route=pathfind(start,node,{avoidRunways:[physical]});if(!route)continue;
      const score=c.d*.9+route.distance*.08;
      if(!best||score<best.score)best={node,coord:AIR_GRAPH_NODES[node].slice(),entryEdge:c.edge,route,score,thresholdDistance:c.d};
    }
    return best;
  }

  function showRoute(coords,visible=true){const src=state.map?.getSource('atc-route');if(src)src.setData({type:'FeatureCollection',features:visible&&coords?.length>1?[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}]:[]});}
  function showHold(coord,label='HOLD SHORT'){const src=state.map?.getSource('atc-hold');if(src)src.setData({type:'FeatureCollection',features:coord?[{type:'Feature',properties:{label},geometry:{type:'Point',coordinates:coord}}]:[]});}

  function createManualDriver(plane,startNode,opts={}){
    const driver={plane,node:startNode,prevNode:null,edge:null,toNode:null,edgeCoords:null,edgeDistance:0,progress:0,speedKt:0,targetKt:0,maxKt:opts.maxKt||20,accelKtSec:opts.accelKtSec||3.2,brakeKtSec:opts.brakeKtSec||8,waitingChoice:true,clearedRunways:new Set(opts.clearedRunways||[]),expectedEdgeIds:new Set(opts.expectedEdgeIds||[]),onEvent:opts.onEvent||(()=>{}),lastTs:0,raf:null,active:true};
    plane.coord=AIR_GRAPH_NODES[startNode].slice();plane.state='taxi';updateMesh(plane);refreshPlaneLabels();
    const loop=ts=>{if(!driver.active)return;const dt=driver.lastTs?Math.min(.08,(ts-driver.lastTs)/1000):0;driver.lastTs=ts;stepDriver(driver,dt);driver.raf=requestAnimationFrame(loop)};driver.raf=requestAnimationFrame(loop);return driver;
  }
  function driverChoices(driver){
    if(driver.edge)return[];const here=driver.node,ph=driver.plane.heading||0;
    return state.adj[here].map(it=>{const c=it.edge.a===here?it.edge.coords:it.edge.coords.slice().reverse();const h=headingDeg(c[0],c[Math.min(c.length-1,1)]),delta=angleDiff(ph,h);return {to:it.to,edge:it.edge,heading:h,delta,runways:it.edge.runways||[],back:it.to===driver.prevNode};}).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
  }
  function chooseDriverEdge(driver,edgeId){
    const choice=driverChoices(driver).find(x=>String(x.edge.id)===String(edgeId));if(!choice)return false;
    const runway=choice.runways.find(r=>!driver.clearedRunways.has(r));if(runway){driver.onEvent({type:'runway-incursion',runway,edge:choice.edge});return false;}
    const coords=choice.edge.a===driver.node?choice.edge.coords.map(c=>c.slice()):choice.edge.coords.slice().reverse().map(c=>c.slice());
    driver.edge=choice.edge;driver.toNode=choice.to;driver.edgeCoords=coords;driver.edgeDistance=choice.edge.distance||lineDistance(coords);driver.progress=0;driver.waitingChoice=false;
    if(driver.expectedEdgeIds.size&&!driver.expectedEdgeIds.has(choice.edge.id))driver.onEvent({type:'route-deviation',edge:choice.edge});
    return true;
  }
  function stepDriver(d,dt){
    const desired=d.waitingChoice?0:d.targetKt;const rate=desired<d.speedKt?d.brakeKtSec:d.accelKtSec;d.speedKt+=clamp(desired-d.speedKt,-rate*dt,rate*dt);if(Math.abs(d.speedKt)<.04)d.speedKt=0;d.plane.speedKt=d.speedKt;
    if(!d.edge){d.waitingChoice=true;d.plane.state='holding-position';return}
    const mps=d.speedKt*0.514444;d.progress+=mps*dt;
    if(d.progress>=d.edgeDistance){d.prevNode=d.node;d.node=d.toNode;d.plane.coord=AIR_GRAPH_NODES[d.node].slice();d.plane.heading=headingDeg(d.edgeCoords[Math.max(0,d.edgeCoords.length-2)],d.edgeCoords[d.edgeCoords.length-1]);d.edge=null;d.toNode=null;d.progress=0;d.waitingChoice=true;d.targetKt=0;d.onEvent({type:'node-arrival',node:d.node});}
    else{d.plane.coord=coordAtLineDistance(d.edgeCoords,d.progress);const look=coordAtLineDistance(d.edgeCoords,Math.min(d.edgeDistance,d.progress+6));d.plane.heading=headingDeg(d.plane.coord,look);d.plane.state='taxi';}
    updateMesh(d.plane);refreshPlaneLabels();
  }
  function stopDriver(d){if(!d)return;d.active=false;if(d.raf)cancelAnimationFrame(d.raf);d.raf=null;}

  function autoTaxi(plane,route,opts={}){
    if(!route?.coords?.length)return Promise.resolve(false);let i=0,segStart=0;const coords=route.coords,speedKt=opts.speedKt||16,speed=speedKt*.514444,total=lineDistance(coords),duration=Math.max(1,total/speed);plane.state='taxi';
    return new Promise(resolve=>{let t0=null;function frame(ts){if(!t0)t0=ts;const elapsed=(ts-t0)/1000,dist=Math.min(total,elapsed*speed);plane.coord=coordAtLineDistance(coords,dist);const look=coordAtLineDistance(coords,Math.min(total,dist+8));plane.heading=headingDeg(plane.coord,look);plane.speedKt=dist<total?speedKt:0;updateMesh(plane);refreshPlaneLabels();opts.onProgress?.(dist/total,plane);if(dist>=total){plane.state='hold-short';plane.speedKt=0;updateMesh(plane);refreshPlaneLabels();opts.onDone?.(plane);resolve(true)}else requestAnimationFrame(frame)}requestAnimationFrame(frame)});
  }

  function fitAirport(mode='full'){
    const map=state.map;if(!map)return;
    if(mode==='hub')map.fitBounds([[-89.9905,35.052],[-89.949,35.0695]],{padding:70,duration:500,maxZoom:15.7});
    else map.fitBounds([[-89.9925,35.019],[-89.9485,35.0695]],{padding:55,duration:500,maxZoom:14.6});
  }
  function focusCoords(coords,padding=100){if(!coords?.length)return;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const c of coords){minX=Math.min(minX,c[0]);minY=Math.min(minY,c[1]);maxX=Math.max(maxX,c[0]);maxY=Math.max(maxY,c[1]);}state.map.fitBounds([[minX,minY],[maxX,maxY]],{padding,duration:450,maxZoom:17.3});}
  function setView(topDown=false){state.map.easeTo({pitch:topDown?0:55,bearing:topDown?0:-10,duration:350});}
  function setTaxiLabels(on){if(state.map?.getLayer('atc-taxiway-labels'))state.map.setLayoutProperty('atc-taxiway-labels','visibility',on?'visible':'none');}
  function setBuildings(on){if(state.map?.getLayer('atc-buildings'))state.map.setLayoutProperty('atc-buildings','visibility',on?'visible':'none');}

  async function init(container='map'){
    buildAdj();
    const map=new maplibregl.Map({container,style:{version:8,glyphs:'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#061018'}}]},center:MEM_ATC_REFERENCE.airport.center,zoom:13.2,pitch:55,bearing:-10,maxPitch:70,renderWorldCopies:false,antialias:true});
    state.map=map;map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-right');
    await new Promise(resolve=>map.on('load',resolve));addMapSources();initThree();fitAirport('full');
    return map;
  }

  
  function setMapMode(mode='diagram'){
    const map=state.map;if(!map)return;
    const sat=mode==='satellite';
    try{if(map.getLayer('satellite-imagery'))map.setLayoutProperty('satellite-imagery','visibility',sat?'visible':'none')}catch(e){}
    const opacity=sat?.28:.82;try{map.setPaintProperty('atc-runways','fill-opacity',opacity)}catch(e){}
    try{map.setPaintProperty('atc-buildings','fill-extrusion-opacity',sat?.36:.78)}catch(e){}
  }

  function setLightMode(light){
    const map=state.map;if(!map)return;
    const set=(id,prop,val)=>{try{if(map.getLayer(id))map.setPaintProperty(id,prop,val)}catch(e){}};
    set('bg','background-color',light?'#dbe7ee':'#061018');
    set('atc-runways','fill-color',light?'#77838c':'#3e4851');
    set('atc-runway-outline','line-color',light?'#39454e':'#97a6b1');
    set('atc-buildings','fill-extrusion-color',light?'#aebdca':'#253544');
  }

window.MEMSurface={setMapMode,setLightMode,state,init,createPlane,removePlane,clearPlanes,updatePlane,gateCoord,nearestNode,pathfind,findHoldTarget,showRoute,showHold,createManualDriver,driverChoices,chooseDriverEdge,stopDriver,autoTaxi,focusCoords,fitAirport,setView,setTaxiLabels,setBuildings,haversine,headingDeg,angleDiff,metersToCoord,nearestTaxiLabel};
})();
