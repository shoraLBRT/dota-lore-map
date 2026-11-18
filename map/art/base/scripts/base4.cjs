const fs=require('fs');const [layoutPath,schemaPath,outClean,outKey]=process.argv.slice(2);
const l=JSON.parse(fs.readFileSync(layoutPath,'utf8'));if(!Array.isArray(l.regions))l.regions=Object.entries(l.regions).map(([k,v])=>({key:k,...v}));
const polys=[...fs.readFileSync(schemaPath,'utf8').matchAll(/<polygon points="([^"]*)" fill="(#[0-9a-f]+)"/gi)].map(m=>({pts:m[1].trim().split(/\s+/).map(p=>p.split(',').map(Number)),fill:m[2]}));
const DY=260-118, H=1280;
const raw=r=>r.polygon.map(q=>[(q[0]??q.x)*1600,(q[1]??q.y)*1000]);
const P=r=>raw(r).map(([x,y])=>[x,y+DY]);
const colorOf=r=>{const q=raw(r);const hit=polys.find(p=>p.pts.length===q.length&&q.every(c=>p.pts.some(b=>Math.hypot(c[0]-b[0],c[1]-b[1])<0.6)));return hit?hit.fill:'#ff00ff'};
const mute=h=>{let r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);const m=(r+g+b)/3;const k=0.5;r=m+(r-m)*k;g=m+(g-m)*k;b=m+(b-m)*k;const f=0.92;return '#'+[r,g,b].map(v=>Math.round(v*f).toString(16).padStart(2,'0')).join('')};
const south=new Set(['hoven','fellstrath','empire-of-bone','scintillant','druud','wailing-mountains','shadeshore','tomokan']);
const tiers=new Set(['heavens','planes','underdark','hells']);const sea=new Set(['the-deep']);
const land=l.regions.filter(r=>!tiers.has(r.key)&&!sea.has(r.key));
const north=land.filter(r=>!south.has(r.key)&&!['cladd','tropic-isles','uncharted'].includes(r.key));
const d2seg=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
const nearNorth=p=>north.some(r=>{const q=P(r);return q.some((a,i)=>d2seg(p,a,q[(i+1)%q.length])<3)});
const strait=[];for(const r of land.filter(r=>south.has(r.key))){const q=P(r);q.forEach((a,i)=>{const b=q[(i+1)%q.length];const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(nearNorth(m)&&nearNorth(a)&&nearNorth(b))strait.push([a,b])})}
const pts=q=>q.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ');
const SEA='#27343c';
let body=`<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#030208"/><stop offset="0.22" stop-color="#151026"/><stop offset="0.48" stop-color="#2c2748"/><stop offset="0.62" stop-color="#4b5d7c"/><stop offset="0.82" stop-color="#8296ab"/><stop offset="1" stop-color="${SEA}"/></linearGradient>
<linearGradient id="deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SEA}"/><stop offset="0.18" stop-color="#2f3530"/><stop offset="0.45" stop-color="#25221f"/><stop offset="0.6" stop-color="#5a2416"/><stop offset="0.8" stop-color="#3a0f08"/><stop offset="1" stop-color="#070202"/></linearGradient>
<filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="vsoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="28"/></filter>
<clipPath id="landclip">${land.map(r=>`<polygon points="${pts(P(r))}"/>`).join('')}</clipPath></defs>
<rect width="1600" height="${H}" fill="${SEA}"/>
<rect y="0" width="1600" height="300" fill="url(#sky)"/>
<rect y="${H-300}" width="1600" height="300" fill="url(#deep)"/>
<g filter="url(#vsoft)">${l.regions.filter(r=>sea.has(r.key)).map(r=>`<polygon points="${pts(P(r))}" fill="#1c262e"/>`).join('')}</g>
<g clip-path="url(#landclip)"><g filter="url(#soft)">${land.map(r=>{const c=mute(colorOf(r));return `<polygon points="${pts(P(r))}" fill="${c}" stroke="${c}" stroke-width="14" stroke-linejoin="round"/>`}).join('')}</g></g>
${strait.map(([a,b])=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${SEA}" stroke-width="48" stroke-linecap="round"/>`).join('')}`;
const svg=b=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 ${H}">${b}</svg>\n`;
fs.writeFileSync(outClean,svg(body));
const order=['icewrack','radiant-lands','nightsilver','stonehall','free-cities','western-forests','slom-elze','middle-kingdoms','hazhadal','quoidge','hoven','fellstrath','empire-of-bone','scintillant','druud','tomokan','wailing-mountains','shadeshore','tropic-isles','cladd','uncharted','the-deep'];
let key='';
const num=(n,x,y)=>`<circle cx="${x}" cy="${y}" r="26" fill="#000" fill-opacity="0.75" stroke="#fff" stroke-width="3"/><text x="${x}" y="${y+11}" font-family="Arial" font-weight="bold" font-size="30" fill="#fff" text-anchor="middle">${n}</text>`;
order.forEach((k,i)=>{const r=l.regions.find(r=>r.key===k);const lb=r.label;const x=(lb[0]??lb.x)*1600,y=(lb[1]??lb.y)*1000+DY;key+=num(i+1,Math.round(x),Math.round(y+(k==="hoven"?40:0)))});
key+=num(23,800,200)+num(24,800,90)+num(25,800,H-200)+num(26,800,H-80);
fs.writeFileSync(outKey,svg(body+key));
console.log('strait',strait.length,'unmatched',land.filter(r=>colorOf(r)==='#ff00ff').map(r=>r.key));
