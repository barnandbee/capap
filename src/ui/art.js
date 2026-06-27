/* Capitalist Apocalypse — card art (browser only: uses <canvas>).
   Seeded Julia-set illustrations, one deterministic image per card name. */
import { TYPE_COLORS } from "../engine/data.js";

const fractalCache=new Map();
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function hx(h){h=h.replace("#","");return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function lerp(a,b,t){return a+(b-a)*t;}
function makeFractal(seed,colorHex){
  const W=144,H=58;
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const ctx=cv.getContext("2d");
  const img=ctx.createImageData(W,H);
  const h=hashStr(seed);
  // c sits on a circle near the Julia boundary → reliably attractive shapes
  const theta=(h%1000)/1000*Math.PI*2;
  const radius=0.62+((h>>>10)%150)/1000;        // 0.62 – 0.77
  const cx=radius*Math.cos(theta), cy=radius*Math.sin(theta);
  const span=1.3+((h>>>4)%60)/100;              // viewport half-width
  const rot=((h>>>7)%628)/100;                  // 0 – 2π
  const maxIter=70;
  const [pr,pg,pb]=hx("#efe7d6");               // parchment (fast escape)
  const [tr,tg,tb]=hx(colorHex);                // sector tint (near boundary)
  const dr=tr*0.22,dg=tg*0.22,db=tb*0.22;       // ink (interior)
  const cosr=Math.cos(rot),sinr=Math.sin(rot),aspect=W/H;
  for(let py=0;py<H;py++){
    for(let px=0;px<W;px++){
      const x=((px/W)*2-1)*span*aspect, y=((py/H)*2-1)*span;
      let zx=x*cosr-y*sinr, zy=x*sinr+y*cosr, i=0;
      while(zx*zx+zy*zy<=4 && i<maxIter){const xt=zx*zx-zy*zy+cx;zy=2*zx*zy+cy;zx=xt;i++;}
      const idx=(py*W+px)*4;
      if(i>=maxIter){img.data[idx]=dr;img.data[idx+1]=dg;img.data[idx+2]=db;img.data[idx+3]=255;}
      else{
        const m=zx*zx+zy*zy;
        let nu=Math.log(Math.log(m)/2/Math.log(2))/Math.log(2);
        if(!isFinite(nu))nu=0;
        let t=(i+1-nu)/maxIter; t=t<0?0:t>1?1:t;
        const e=Math.pow(t,0.6);
        img.data[idx]=lerp(pr,tr,e);img.data[idx+1]=lerp(pg,tg,e);img.data[idx+2]=lerp(pb,tb,e);img.data[idx+3]=255;
      }
    }
  }
  ctx.putImageData(img,0,0);
  return cv.toDataURL("image/png");
}
function artColor(card){
  if(card.cat==="Organisation")return TYPE_COLORS[card.type]||"#7a5a2e";
  if(card.cat==="Higher Power")return TYPE_COLORS["Higher Power"];
  return TYPE_COLORS.Action;
}
export function cardArt(card){
  const key=card.def.name;
  if(fractalCache.has(key))return fractalCache.get(key);
  const url=makeFractal(key,artColor(card));
  fractalCache.set(key,url);
  return url;
}
