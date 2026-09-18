const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
function load(rel, ctx){ vm.runInContext(fs.readFileSync(path.join(ROOT,rel),'utf8'), ctx, {filename:rel}); }
function assert(cond,msg){ if(!cond) throw new Error(msg); console.log('✓',msg); }
const ctx={console,window:{},Math,Set,Map,Array,Float64Array,Uint8Array,Infinity,Number,String,Object,JSON,Date};
vm.createContext(ctx);
load('data/map-data.js',ctx);
load('data/gate-730-extension.js',ctx);
load('data/airport-reference.js',ctx);
load('js/phraseology.js',ctx);
vm.runInContext(`globalThis.EXPORTS={nodes:AIR_GRAPH_NODES,edges:AIR_GRAPH_EDGES,gates:GATES,airfield:AIRFIELD_GEOJSON,ref:window.MEM_ATC_REFERENCE,phrase:window.MEMPhraseology}`,ctx);
const x=ctx.EXPORTS;
assert(x.nodes.length>1500,`aircraft graph has ${x.nodes.length} nodes`);
assert(x.edges.length>2000,`aircraft graph has ${x.edges.length} edges`);
assert(x.gates.features.some(f=>String(f.properties?.gate)==='730'),'Gate 730 is present after extension');
assert(x.airfield.features.filter(f=>f.properties?.kind==='runway').length===4,'four physical runway polygons are present');
assert(x.ref.runways['36L'].opposite==='18R','operational west runway pairing is 36L/18R');
assert(x.ref.runways['36R'].opposite==='18L','operational east runway pairing is 36R/18L');
assert(x.ref.frequencies.ground['09_27']==='121.0','Runway 09/27 Ground frequency reference is 121.0');
const c=x.phrase.scoreGroundClearance('FDX1500 runway 9 taxi via Victor November hold short runway 9',{callsign:'FDX1500',runway:'9',taxiways:['V','N'],holdShort:'9'});
assert(c.percent===100,'Ground clearance parser accepts V → N route with hold short');
const r=x.phrase.scorePilotReadback('runway 9 hold short runway 9 FedEx 1500',{callsign:'FDX1500',runway:'9',holdShort:'9'});
assert(r.percent===100,'pilot runway hold-short readback parser passes complete readback');
const a=x.phrase.parse('FDX423 turn right heading 250 descend and maintain 4000 speed 180');
assert(a.heading===250&&a.altitude===4000&&a.speed===180,'radar instruction parser extracts heading, altitude and speed');
console.log('\nMEM ATC Trainer validation passed.');
