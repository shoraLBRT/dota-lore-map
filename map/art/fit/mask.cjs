const fs=require('fs');const S=process.argv[2];const N=1000;
const b=fs.readFileSync(S+'/w1000.rgb');
let m=new Uint8Array(N*N);
for(let i=0;i<N*N;i++){const r=b[i*3],g=b[i*3+1],bl=b[i*3+2];const s=bl-(r+g)/2,br=(r+g+bl)/3;m[i]=(s>12&&br<75)?0:1;}
// majority filter radius 3, twice
const maj=(a,R)=>{const o=new Uint8Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){let c=0,t=0;for(let dy=-R;dy<=R;dy++){const yy=y+dy;if(yy<0||yy>=N)continue;for(let dx=-R;dx<=R;dx++){const xx=x+dx;if(xx<0||xx>=N)continue;t++;c+=a[yy*N+xx]}}o[y*N+x]=c*2>t?1:0}return o};
m=maj(m,3);m=maj(m,3);
// only keep components touching the land box region (y .25..1, exclude tiers): label components
const lab=new Int32Array(N*N).fill(-1);const comps=[];
for(let i=0;i<N*N;i++){if(!m[i]||lab[i]>=0)continue;const id=comps.length;let st=[i];lab[i]=id;let n=0,sx=0,sy=0,minx=N,maxx=0,miny=N,maxy=0;while(st.length){const j=st.pop();n++;const x=j%N,y=(j/N)|0;sx+=x;sy+=y;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);for(const k of [j-1,j+1,j-N,j+N]){if(k<0||k>=N*N)continue;if(Math.abs((k%N)-x)>1)continue;if(m[k]&&lab[k]<0){lab[k]=id;st.push(k)}}}comps.push({id,n,cx:sx/n/N,cy:sy/n/N,box:[minx,miny,maxx,maxy].map(v=>v/N)})}
const big=comps.filter(c=>c.n>300).sort((a,b)=>b.n-a.n);console.log(big.slice(0,25).map(c=>`${c.id} n=${c.n} c=(${c.cx.toFixed(3)},${c.cy.toFixed(3)}) box=${c.box.map(v=>v.toFixed(3))}`).join('\n'));
fs.writeFileSync(S+'/lab.json',JSON.stringify({comps:big}));fs.writeFileSync(S+'/lab.bin',Buffer.from(lab.buffer));
const out=Buffer.alloc(N*N*3);for(let i=0;i<N*N;i++){const v=m[i]?200:30;out[i*3]=v;out[i*3+1]=m[i]?v:60;out[i*3+2]=m[i]?v:90}fs.writeFileSync(S+'/mask.rgb',out);
