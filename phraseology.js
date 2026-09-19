(() => {
  'use strict';

  const wordNums={zero:'0',oh:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'};
  const taxiWords={alpha:'A',bravo:'B',charlie:'C',delta:'D',echo:'E',hotel:'H',juliett:'J',juliet:'J',kilo:'K',lima:'L',mike:'M',november:'N',papa:'P',romeo:'R',sierra:'S',tango:'T',uniform:'U',victor:'V',xray:'X','x-ray':'X',yankee:'Y'};
  const actionPatterns={
    holdShort:/\bhold\s+short\b/,
    cross:/\bcross(?:ing)?\b/,
    lineUpWait:/\b(?:line\s+up\s+(?:and\s+)?wait|luaw)\b/,
    takeoff:/\bcleared\s+(?:for\s+)?takeoff\b/,
    land:/\bcleared\s+(?:to\s+)?land\b/,
    goAround:/\bgo\s+around\b/,
    taxi:/\btaxi(?:ing)?\b/,
    contact:/\bcontact\b/,
    monitor:/\bmonitor\b/,
    maintain:/\bmaintain\b/,
    descend:/\bdescend\b/,
    climb:/\bclimb\b/,
    turn:/\bturn\b/,
    direct:/\b(?:proceed\s+)?direct\b/
  };

  function normalize(raw){
    let s=String(raw||'').toLowerCase().replace(/[.,;:!?]/g,' ').replace(/\s+/g,' ').trim();
    for(const [w,n] of Object.entries(wordNums))s=s.replace(new RegExp(`\\b${w}\\b`,'g'),n);
    return s;
  }
  function compactCallsign(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
  function extractRunways(text){
    const s=normalize(text);const out=new Set();
    const rx=/\brunway\s+(?:0?)(9|27|18\s*[lcr]|36\s*[lcr]|18|36)\b/gi;let m;
    while((m=rx.exec(s))){let r=m[1].replace(/\s+/g,'').toUpperCase();if(r==='9')r='9';out.add(r)}
    const verbal=/\brunway\s+(zero\s*nine|nine|two\s*seven|one\s*eight\s*(?:left|center|right)?|three\s*six\s*(?:left|center|right)?)/gi;
    const raw=String(text||'').toLowerCase();while((m=verbal.exec(raw))){const v=m[1];let r='';if(/zero\s*nine|\bnine\b/.test(v))r='9';else if(/two\s*seven/.test(v))r='27';else if(/one\s*eight/.test(v))r='18'+(/left/.test(v)?'L':/center/.test(v)?'C':/right/.test(v)?'R':'');else if(/three\s*six/.test(v))r='36'+(/left/.test(v)?'L':/center/.test(v)?'C':/right/.test(v)?'R':'');if(r)out.add(r)}
    return [...out];
  }
  function extractTaxiways(text){
    const raw=String(text||'').toLowerCase();const n=normalize(raw);const found=[];
    for(const [word,letter] of Object.entries(taxiWords)){
      const rx=new RegExp(`\\b${word}(?:\\s+(one|two|three|four|five|six|seven|eight|nine|[1-9]))?\\b`,'g');let m;
      while((m=rx.exec(raw))){let suffix=m[1]||'';if(wordNums[suffix])suffix=wordNums[suffix];found.push(letter+suffix)}
    }
    const viaIndex=n.indexOf('via ');if(viaIndex>=0){const tail=n.slice(viaIndex+4);for(const tok of tail.split(/\s+/)){const t=tok.toUpperCase();if(/^[A-Z](?:[1-9]|81)?$/.test(t)&&!['I','O','Q','G','F','W','Z'].includes(t[0]))found.push(t);if(/^(A5|C[1-7]|M[1-9]|P[12]|R[12]|S[1-7]|V[1-3]|Y[1-3]|[ABCDEHJKLMNPRSTUVXY])$/.test(t))found.push(t)}}
    return [...new Set(found)];
  }
  function extractHeading(text){const s=normalize(text);let m=s.match(/\bheading\s+(\d{1,3})\b/);if(!m)m=s.match(/\bturn\s+(?:left|right)\s+(?:heading\s+)?(\d{1,3})\b/);return m?((Number(m[1])%360)||360):null;}
  function extractAltitude(text){const raw=String(text||'').toLowerCase();let m=raw.match(/\b(?:descend|climb)(?:\s+and)?\s+maintain\s+([\d,]+)(?:\s*(?:feet|ft))?/);if(!m)m=raw.match(/\bmaintain\s+([\d,]+)(?:\s*(?:feet|ft))?/);if(m)return Number(m[1].replace(/,/g,''));m=raw.match(/\b(?:descend|climb)(?:\s+and)?\s+maintain\s+(one|two|three|four|five|six|seven|eight|nine)\s+thousand\b/);if(m)return Number(wordNums[m[1]])*1000;return null;}
  function extractSpeed(text){const s=normalize(text);let m=s.match(/\b(?:speed|reduce(?:\s+speed)?\s+to|maintain)\s+(\d{2,3})\s*(?:knots|kts)?\b/);return m?Number(m[1]):null;}
  function extractTurnDirection(text){const s=normalize(text);if(/\bturn\s+left\b/.test(s))return'left';if(/\bturn\s+right\b/.test(s))return'right';return null;}
  function hasCallsign(text,callsign){
    const raw=String(text||''), compact=compactCallsign(raw), cs=compactCallsign(callsign);
    if(compact.includes(cs))return true;
    const expectedDigits=(cs.match(/\d+/)||[''])[0];
    const spokenDigits=normalize(raw).split(/\s+/).filter(x=>/^\d$/.test(x)).join('');
    const numericRuns=(normalize(raw).match(/\d+/g)||[]).join('');
    const prefix=cs.replace(/\d/g,'');
    const airlineOK=prefix==='FDX'?/\b(?:fedex|fed\s*ex|fdx)\b/i.test(raw):prefix==='UPS'?/\bups\b/i.test(raw):true;
    return expectedDigits.length>=3&&airlineOK&&(compact.includes(expectedDigits)||spokenDigits.includes(expectedDigits)||numericRuns.includes(expectedDigits));
  }
  function parse(text){const s=normalize(text);const actions={};for(const [k,rx] of Object.entries(actionPatterns))actions[k]=rx.test(s);return {raw:String(text||''),normalized:s,actions,runways:extractRunways(text),taxiways:extractTaxiways(text),heading:extractHeading(text),altitude:extractAltitude(text),speed:extractSpeed(text),turnDirection:extractTurnDirection(text)};}
  function scoreGroundClearance(text,expect){
    const p=parse(text),checks=[];const add=(name,ok,weight,detail)=>checks.push({name,ok,weight,detail});
    add('Callsign',hasCallsign(text,expect.callsign),15,expect.callsign);
    add('Runway assignment',p.runways.includes(expect.runway),20,`Runway ${expect.runway}`);
    add('Taxi instruction',p.actions.taxi,10,'Taxi');
    const taxis=(expect.taxiways||[]);for(const tx of taxis)add(`Taxiway ${tx}`,p.taxiways.includes(tx),8,tx);
    if(expect.holdShort)add('Hold-short instruction',p.actions.holdShort&&p.runways.includes(expect.holdShort),30,`Hold short Runway ${expect.holdShort}`);
    const total=checks.reduce((a,c)=>a+c.weight,0),earned=checks.reduce((a,c)=>a+(c.ok?c.weight:0),0);return {percent:Math.round(earned/Math.max(1,total)*100),checks,parsed:p};
  }
  function scorePilotReadback(text,expect){
    const p=parse(text),checks=[];const add=(name,ok,weight,detail)=>checks.push({name,ok,weight,detail});
    add('Callsign',hasCallsign(text,expect.callsign),20,expect.callsign);
    add('Runway',p.runways.includes(expect.runway),25,`Runway ${expect.runway}`);
    if(expect.holdShort)add('Hold short',p.actions.holdShort&&p.runways.includes(expect.holdShort),45,`Hold short Runway ${expect.holdShort}`);
    if(expect.lineUpWait)add('Line up and wait',p.actions.lineUpWait,45,'Line up and wait');
    const total=checks.reduce((a,c)=>a+c.weight,0),earned=checks.reduce((a,c)=>a+(c.ok?c.weight:0),0);return {percent:Math.round(earned/Math.max(1,total)*100),checks,parsed:p};
  }
  function callsignSpoken(callsign){
    const s=String(callsign||'').toUpperCase();let prefix=s.replace(/\d/g,''),digits=s.replace(/\D/g,'');const airline=prefix==='FDX'?'FedEx':prefix==='UPS'?'UPS':prefix||'';const nums=digits.split('').map(d=>({'0':'zero','1':'one','2':'two','3':'three','4':'four','5':'five','6':'six','7':'seven','8':'eight','9':'nine'}[d])).join(' ');return `${airline} ${nums}`.trim();
  }
  function runwaySpoken(r){const s=String(r).toUpperCase();const digitNames={'0':'zero','1':'one','2':'two','3':'three','4':'four','5':'five','6':'six','7':'seven','8':'eight','9':'nine'};let base=s.replace(/[LCR]/g,'');if(base==='9')base='09';let t=base.split('').map(d=>digitNames[d]).join(' ');if(s.endsWith('L'))t+=' left';if(s.endsWith('C'))t+=' center';if(s.endsWith('R'))t+=' right';return t;}
  function taxiSpoken(tx){const t=String(tx).toUpperCase(),letter=t[0],suffix=t.slice(1);const word=Object.entries(taxiWords).find(([,v])=>v===letter)?.[0]||letter;const preferred={juliett:'juliett',xray:'x-ray'}[word]||word;return preferred+(suffix?` ${suffix.split('').join(' ')}`:'');}

  window.MEMPhraseology={normalize,parse,scoreGroundClearance,scorePilotReadback,hasCallsign,callsignSpoken,runwaySpoken,taxiSpoken};
})();


// FAA Pilot/Controller Glossary-aligned interaction vocabulary (PCG terminology authority).
window.MEM_PCG={source:'FAA Pilot/Controller Glossary',url:'https://www.faa.gov/air_traffic/publications/atpubs/pcg_html/',terms:['roger','wilco','unable','stand by','say again','affirmative','negative','go around','hold short','line up and wait','cleared for takeoff','cleared to land','taxi','cross','maintain','climb','descend','contact','monitor','ident','traffic','proceed direct']};
