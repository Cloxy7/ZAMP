
/* =================== Backend: talks to the Python server (app.py) =================== */
const Backend={
 kind:"http",
 async _j(path,opts={}){const r=await fetch(path,{headers:{"Content-Type":"application/json"},...opts});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.detail||`Request failed (${r.status})`);return j},
 async info(){return{...(await this._j("/mode")),can_reset:true}},
 run(name,company,rep,pick,onEvent){return new Promise((resolve,reject)=>{
  const q=new URLSearchParams({name,company,rep});if(pick!=null)q.set("pick",pick);
  const es=new EventSource("/run?"+q);
  es.onmessage=m=>{const e=JSON.parse(m.data);if(e.result){es.close();e.result.review="pending";resolve(e.result)}else onEvent(e)};
  es.onerror=()=>{es.close();reject(new Error("Lost the connection to the server. Check the terminal for an error."))}})},
 async review(id,pl){return this._j(`/runs/${id}/review`,{method:"POST",body:JSON.stringify(pl)})},
 async runs(){return(await this._j("/runs")).map(r=>({...r,ts:r.ts*1000}))},
 async proposals(){return this._j("/proposals")},
 async acceptProposal(id){return this._j(`/proposals/${id}/accept`,{method:"POST"})},
 async dismissProposal(id){return this._j(`/proposals/${id}/dismiss`,{method:"POST"})},
 async rulebook(){const r=await this._j("/rulebook");r.versions=r.versions.map(v=>({...v,ts:v.ts*1000}));return r},
 async saveRulebook(yaml,note){return this._j("/rulebook",{method:"PUT",body:JSON.stringify({yaml,note})})},
 async evalAll(){return this._j("/eval",{method:"POST"})},
 async reset(){return this._j("/reset",{method:"POST"})}
};
