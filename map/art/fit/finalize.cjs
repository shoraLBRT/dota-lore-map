const fs=require('fs');const [fit,out]=process.argv.slice(2);
const {L}=JSON.parse(fs.readFileSync(fit,'utf8'));
const r2=v=>Math.round(v*100)/100, r4=v=>Math.round(v*10000)/10000;
for(const r of Object.values(L.regions)){const xs=r.polygon.map(p=>p[0]),ys=r.polygon.map(p=>p[1]);const bw=Math.max(...xs)-Math.min(...xs),bh=Math.max(...ys)-Math.min(...ys);
 r.camera={x:r4((Math.max(...xs)+Math.min(...xs))/2),y:r4((Math.max(...ys)+Math.min(...ys))/2),zoom:r2(Math.min(6,Math.max(1.2,Math.min(0.7/bh,0.9/bw))))};}
const o={aspect:1,regions:L.regions,places:L.places};
let s=JSON.stringify(o,null,2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g,'[$1,$2]').replace(/\[\s+((?:\[[^\]]*\],?\s*)+)\]/g,(m,inner)=>'['+inner.replace(/\s+/g,'')+']').replace(/"camera": \{\s+"x": ([\d.]+),\s+"y": ([\d.]+),\s+"zoom": ([\d.]+)\s+\}/g,'"camera": { "x": $1, "y": $2, "zoom": $3 }').replace(/\{\s+"pos": (\[[^\]]*\])\s+\}/g,'{ "pos": $1 }');
fs.writeFileSync(out,s+'\n');
