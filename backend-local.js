
/* =================== Backend: runs the engine above inside the browser =================== */
const Backend={
 kind:"local",
 async info(){return{mock:true,stages:STAGES,reasons:REASONS,rulebook_version:currentRb().version,can_reset:true}},
 async run(name,company,rep,pick,onEvent){let result=null;
  for await(const e of run(name,company,rep,pick)){
   if(e.result){result=e.result;const id=(DB.runs.at(-1)?.id||0)+1;result.run_id=id;result.review="pending";
    DB.runs.push({id,ts:Date.now(),name:result.name,company:result.company,status:result.status,review:"pending",version:result.rulebook_version,cost:result.cost.usd,duration:result.duration,result});persist()}
   else onEvent(e)}
  return result},
 async review(id,pl){const row=DB.runs.find(r=>r.id===id);if(!row)throw new Error("Run not found.");
  if(pl.action==="edited"&&!(pl.body||"").trim())throw new Error("The edited email is empty.");
  row.review=pl.action;row.result.review=pl.action;
  if(pl.action==="edited"){row.result.original_body=row.result.original_body||row.result.body;row.result.body=pl.body}
  persist();let proposal=null,message=null;
  if(pl.reason){try{proposal=propose(row,pl.reason,pl.detail)}catch(e){message=e.message}}
  return{ok:true,proposal,message}},
 async runs(){return[...DB.runs].reverse().map(r=>({...r,result:{...r.result,run_id:r.id,review:r.review}}))},
 async proposals(){return DB.proposals.filter(p=>p.state==="open").reverse()},
 async acceptProposal(id){const p=DB.proposals.find(x=>x.id==id);if(!p||p.state!=="open")throw new Error("This change is no longer open.");
  const v=saveRb(p.yaml,"Learned: "+p.note);p.state="accepted";persist();return{version:v}},
 async dismissProposal(id){const p=DB.proposals.find(x=>x.id==id);if(p){p.state="dismissed";persist()}return{ok:true}},
 async rulebook(){const c=currentRb();return{version:c.version,yaml:c.yaml,versions:[...DB.versions].reverse().map(v=>({version:v.version,ts:v.ts,note:v.note}))}},
 async saveRulebook(yaml,note){return{version:saveRb(yaml,note||"Edited by hand")}},
 async evalAll(){return runEval()},
 async reset(){DB={runs:[],versions:[{version:1,ts:Date.now(),yaml:document.getElementById("rb-default").textContent,note:"Starting rulebook"}],proposals:[]};persist();return{ok:true}}
};
