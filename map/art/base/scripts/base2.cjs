const fs=require('fs');const [layoutPath,schemaPath,out]=process.argv.slice(2);
const l=JSON.parse(fs.readFileSync(layoutPath,'utf8'));if(!Array.isArray(l.regions))l.regions=Object.entries(l.regions).map(([k,v])=>({key:k,...v}));
const polys=[...fs.readFileSync(schemaPath,'utf8').matchAll(/<polygon points="([^"]*)" fill="(#[0-9a-f]+)"/gi)].map(m=>({pts:m[1].trim().split(/\s+/).map(p=>p.split(',').map(Number)),fill:m[2]}));
const P=r=>r.polygon.map(q=>[(q[0]??q.x)*1600,(q[1]??q.y)*1000]);
const colorOf=r=>{const a=P(r)[0];const q=P(r);const hit=polys.find(p=>p.pts.length===q.length&&q.every(c=>p.pts.some(b=>Math.hypot(c[0]-b[0],c[1]-b[1])<0.6)));return hit?hit.fill:'#ff00ff'};
const south=new Set(['hoven','fellstrath','empire-of-bone','scintillant','druud','wailing-mountains','shadeshore','tomokan']);
const tiers=new Set(['heavens','planes','underdark','hells']);
const land=l.regions.filter(r=>!tiers.has(r.key));
const north=land.filter(r=>!south.has(r.key)&&!['the-deep','cladd','tropic-isles','uncharted'].includes(r.key));
const d2seg=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
const nearNorth=p=>north.some(r=>{const q=P(r);return q.some((a,i)=>d2seg(p,a,q[(i+1)%q.length])<3)});
const strait=[];
for(const r of land.filter(r=>south.has(r.key))){const q=P(r);q.forEach((a,i)=>{const b=q[(i+1)%q.length];const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(nearNorth(m)&&nearNorth(a)&&nearNorth(b))strait.push([a,b])})}
const pts=q=>q.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ');
const up=l.regions.filter(r=>r.key==='heavens'||r.key==='planes'),dn=l.regions.filter(r=>r.key==='underdark'||r.key==='hells');
let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><defs>
<linearGradient id="up" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05030c"/><stop offset="0.25" stop-color="#2a1550"/><stop offset="0.5" stop-color="#3b2a7a"/><stop offset="0.5" stop-color="#4a6fb0"/><stop offset="1" stop-color="#9cc3e6"/></linearGradient>
<linearGradient id="dn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4a3a"/><stop offset="0.5" stop-color="#22302a"/><stop offset="0.5" stop-color="#b8380f"/><stop offset="0.8" stop-color="#6a1408"/><stop offset="1" stop-color="#140303"/></linearGradient></defs>
<rect width="1600" height="1000" fill="#1d3550"/>\n`;
for(const r of up)s+=`<polygon points="${pts(P(r))}" fill="url(#up)" stroke="none"/>\n`;
for(const r of dn)s+=`<polygon points="${pts(P(r))}" fill="url(#dn)" stroke="none"/>\n`;
for(const r of land){const c=colorOf(r);s+=`<polygon points="${pts(P(r))}" fill="${c}" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>\n`}
for(const [a,b] of strait)s+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#1d3550" stroke-width="48" stroke-linecap="round"/>\n`;
s+='</svg>\n';fs.writeFileSync(out,s);console.log('strait edges',strait.length,'unmatched colors',land.filter(r=>colorOf(r)==='#ff00ff').map(r=>r.key));
