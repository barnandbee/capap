/* Capitalist Apocalypse — async modal dialogs (browser only).
   modal()/pickOrg()/note() return Promises that resolve on the player's choice,
   so the flow layer can `await` decisions mid-turn. */
import { SIZES } from "../engine/data.js";
import { fmt, orgValue } from "../engine/value.js";

export function modal({title,desc,options,cancel="Cancel",allowCancel=true}){
  return new Promise(res=>{
    const m=document.getElementById("modalMount");
    const wrap=document.createElement("div");wrap.className="modal";
    wrap.innerHTML=`<div class="box"><h3>${title}</h3>${desc?`<div class="desc">${desc}</div>`:""}
      <div class="opts"></div>
      <div class="modal-foot">${allowCancel?`<button class="btn ghost" style="color:var(--ink);border-color:var(--ink)">${cancel}</button>`:""}</div></div>`;
    const opts=wrap.querySelector(".opts");
    options.forEach(o=>{
      const b=document.createElement("button");b.className="opt";
      b.innerHTML=`<b>${o.label}</b>${o.sub?`<small>${o.sub}</small>`:""}`;
      b.onclick=()=>{cleanup();res(o.value);};
      opts.appendChild(b);
    });
    if(allowCancel) wrap.querySelector(".modal-foot .btn").onclick=()=>{cleanup();res(null);};
    function cleanup(){wrap.remove();}
    m.appendChild(wrap);
  });
}
export async function pickOrg(title,list,desc){
  if(!list.length){await modal({title,desc:"No valid organisations.",options:[],allowCancel:true,cancel:"OK"});return null;}
  const sel=await modal({title,desc,options:list.map(x=>({label:`${x.o.def.name} · ${SIZES[x.o.size]}`,sub:`${x.owner.name} · ${fmt(orgValue(x.o,x.owner))}`,value:x.o.uid})),});
  if(sel==null)return null;
  for(const x of list) if(x.o.uid===sel) return x;
  return null;
}
export function note(title,desc){return modal({title,desc,options:[],allowCancel:true,cancel:"OK"});}
