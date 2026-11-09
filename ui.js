
/* =================== Interface (same for the browser demo and the Python app) =================== */
(()=>{
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ROLE=["Code","API","AI + code","Code","Code","Code","Code","AI","Code","You"];
const SVG=p=>`<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC={check:SVG('<path d="M3.5 8.5l3 3 6-7"/>'),warn:SVG('<path d="M8 3.5v5.5"/><path d="M8 12.2v.1"/>'),stop:SVG('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
 chev:SVG('<path d="M6 3.5l4.5 4.5L6 12.5"/>'),user:SVG('<circle cx="8" cy="5.5" r="2.6"/><path d="M3 13.5c.7-2.6 2.7-3.8 5-3.8s4.3 1.2 5 3.8"/>'),
 pen:SVG('<path d="M10.5 2.8l2.7 2.7L6 12.7l-3.3.6.6-3.3z"/>'),play:SVG('<path d="M5 3.5l7 4.5-7 4.5z" fill="currentColor"/>'),
 spark:SVG('<path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2"/>'),search:SVG('<circle cx="7" cy="7" r="4"/><path d="M10 10l3.5 3.5"/>'),
 shield:SVG('<path d="M8 2l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4z"/>'),mail:SVG('<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="M2.5 4.5L8 9l5.5-4.5"/>')};
const ST={"Ready for review":{c:"s-ok",i:"check",k:"ready"},"Review with flags":{c:"s-warn",i:"warn",k:"flags"},"Needs attention":{c:"s-warn",i:"warn",k:"attn"},
 "Not a buyer":{c:"s-bad",i:"user",k:"nb"},"Stopped":{c:"s-bad",i:"stop",k:"stop"}};
const status=(s,big=true)=>{const m=ST[s]||{c:"s-run",i:"spark"};return big?`<span class="status ${m.c}">${IC[m.i]||""}${esc(s)}</span>`:`<span class="small-status ${m.c}">${esc(s)}</span>`};
const SCEN=[
 {t:"hp",l:"Normal case",n:"Priya Raman",c:"Lumen Freight",d:"Good news to work with. One made-up fact gets caught and thrown out."},
 {t:"edge",l:"Wrong person",n:"Kevin Park",c:"Orbit Pay",d:"An engineer, not a buyer. It finds the right person at the same company."},
 {t:"edge",l:"Sources disagree",n:"Tom Reyes",c:"Vantage Retail",d:"Two articles give different numbers, so neither is used."},
 {t:"edge",l:"Tricky web page",n:"Grace Lin",c:"Solace Pharma",d:"A page hides orders aimed at the AI. That page is ignored."},
 {t:"edge",l:"AI makes something up",n:"Ravi Kumar",c:"Pinecrest Health",d:"The writer adds a number nobody said. The check catches it."},
 {t:"edge",l:"Same name",n:"Sam Lee",c:"Northwind",d:"Two people share the name. It asks you which one."},
 {t:"edge",l:"Changed jobs",n:"Dana Ortiz",c:"Brightwell Foods",d:"Moved to a new company last month. It notices."},
 {t:"edge",l:"Bad news",n:"Meera Iyer",c:"Halden Logistics",d:"The top news is layoffs. It is never mentioned."},
 {t:"edge",l:"Nothing to say",n:"Arjun Mehta",c:"Corvel Textiles",d:"No recent news. It doesn't pretend to know them."},
 {t:"rule",l:"Legal rule",n:"Claire Dubois",c:"Maple Ledger",d:"Lives in Canada, where cold email needs consent first."},
 {t:"rule",l:"Already a customer",n:"Jordan Blake",c:"Acme Robotics",d:"Stopped before any research at all."},
 {t:"fail",l:"Tool breaks",n:"Test Outage",c:"Outage Co",d:"The search tool is down. It stops instead of guessing."}];
const TOUR=[["priya","Priya Raman: see a normal draft"],["lena","Kevin Park: wrong person, then try Lena"],["tom","Tom Reyes: two sources disagree"],
 ["learn","Reject Priya's draft and teach it a rule"],["eval","Dashboard: run the test set"]];
const STEP_INFO=["Checks both fields and the do-not-contact list. No cost if it stops here.","Four searches at once: the person, company news, hiring, funding. Pages with hidden instructions to the AI are removed.",
 "The AI pulls out facts, each with an exact quote. Code checks the quote and every number really are on that page.","Exactly one match? Still at that company? Allowed to email in their country?",
 "Is this job title someone who buys what we sell? If not, it suggests the finance person it found.","Removes sensitive, personal, old, conflicting and off-target facts, and says why.",
 "Scores each fact on topic priority, recency and source trust. Picks a hook, a support fact and an angle for the role.","The AI writes a short email from only the chosen facts. Code adds the opt-out footer.",
 "Checks every number is from a verified fact, plus length, banned phrases, name, links and source tags.","You approve, edit or reject. A reason turns into a proposed rule change, replayed on past prospects first."];
const PHASES=[{t:"Look them up",s:[0,1],idle:"Search the web for news about them and their company"},
 {t:"Check the facts",s:[2,3,4,5],idle:"Keep only facts it can prove, about the right person"},
 {t:"Write the email",s:[6,7,8],idle:"Open with the most useful fact, then check the draft"},
 {t:"Your turn",s:[9],idle:"You approve, edit or reject. Nothing is sent on its own"}];
const TOPIC_WHY={"hiring-ap":"They are hiring people for accounts payable, which is exactly the work Zamp takes on.",
 "pain-close":"It's a problem they talked about themselves.","chargebacks":"Their dispute workload is growing, and they handle it by hand.",
 "erp":"They are changing their finance software, a natural moment to fix invoice work.","new-role":"They just started a new job, when people look hard at how things run.",
 "funding":"They just raised money, which usually means more vendors and more invoices.","expansion":"They are opening new sites, which brings more invoices.",
 "award":"General company news, only loosely related.","other":"Not related to what Zamp sells."};
const SAFETY=[["Made-up facts","Every fact needs an exact quote that code finds on the page. Every number in the email must come from a chosen fact."],
 ["Hidden instructions in web pages","Pages that try to give orders to the AI are removed before it reads anything. Page text is marked as data in the prompt."],
 ["Sensitive and personal topics","Layoffs, lawsuits, illness, family and hobbies are never used as a hook."],
 ["Cold-email law","Every draft gets an opt-out footer. Countries that need consent first are blocked. No contact details are collected."],
 ["Too many people at one company","Warns when someone else at the same company got a draft in the last 14 days."],
 ["Services failing","Each call retries once. If it still fails the run stops and says so. It never fills the gap with a guess."],
 ["Stale research","Saved search answers expire after 7 days."]];

let INFO=null,RB=null,cur=null,busy=false,stepState=[],tour=new Set(),evalDone=null;
try{tour=new Set(JSON.parse(localStorage.getItem("od-tour")||"[]"))}catch(e){}
const saveTour=()=>{try{localStorage.setItem("od-tour",JSON.stringify([...tour]))}catch(e){}};
const mark=k=>{if(!tour.has(k)){tour.add(k);saveTour();renderTour()}};
const rep=()=>($("#fRep").value||"Rep").trim();
const initials=n=>(n||"?").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("");
const ago=ts=>{const m=Math.round((Date.now()-ts)/6e4);return m<1?"just now":m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"};
const reduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const first=r=>((r.person&&r.person.name)||r.name||"").split(" ")[0];
const plural=(n,w)=>`${n} ${w}${n===1?"":"s"}`;

/* ---------- details switch ---------- */
function setDetails(on){document.body.classList.toggle("details",on);$("#detailsToggle").checked=on;try{localStorage.setItem("od-details",on?"1":"0")}catch(e){}}
$("#detailsToggle").onchange=e=>setDetails(e.target.checked);
try{setDetails(localStorage.getItem("od-details")==="1")}catch(e){setDetails(false)}

/* ---------- header, tabs, tour ---------- */
async function loadRb(){const r=await Backend.rulebook();RB={...r,data:jsyaml.load(r.yaml)};$("#verChip").textContent="Rulebook v"+r.version;return RB}
function header(){const c=$("#modeChip");c.classList.toggle("live",!INFO.mock);c.lastElementChild.textContent=INFO.mock?"Demo data · nothing is sent":"Live research · nothing is sent"}
function tab(t){$$(".tabs button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===t)));
 ["run","dash","rules","how"].forEach(x=>{$("#tab-"+x).hidden=x!==t});if(t==="dash")renderDash();if(t==="rules")renderRules()}
$$(".tabs button").forEach(b=>b.onclick=()=>tab(b.dataset.tab));
function renderTour(){$("#tour").innerHTML=TOUR.map(([k,t],i)=>`<li class="${tour.has(k)?"done":""}"><span class="n">${tour.has(k)?IC.check:i+1}</span><span>${esc(t)}</span></li>`).join("")}

/* ---------- scenarios ---------- */
function seenSet(){try{return new Set(JSON.parse(sessionStorage.getItem("od-seen")||"[]"))}catch(e){return new Set()}}
function seen(n){try{const s=seenSet();s.add(n);sessionStorage.setItem("od-seen",JSON.stringify([...s]))}catch(e){}}
function renderScen(sel){const sn=seenSet();
 $("#scen").innerHTML=SCEN.map((s,i)=>`<button class="sc" type="button" data-i="${i}" aria-pressed="${sel===s.n}">
  <span class="row1"><span class="tag ${s.t}">${esc(s.l)}</span>${sn.has(s.n)?`<span class="seen" title="Already tried">${IC.check}</span>`:""}</span>
  <b>${esc(s.n)}</b><span class="co">${esc(s.c)}</span><p>${esc(s.d)}</p></button>`).join("")
  +`<button class="sc custom" type="button" id="customBtn"><span class="tag">Your own</span><b>Type a name</b><p>${INFO&&!INFO.mock?"Researches the real web.":"Only the made-up people above have data in this demo."}</p></button>`;
 $$("#scen .sc[data-i]").forEach(b=>b.onclick=()=>{const s=SCEN[+b.dataset.i];go(s.n,s.c)});
 $("#customBtn").onclick=()=>{$("#custom").hidden=!$("#custom").hidden;if(!$("#custom").hidden)$("#fName").focus()}}
$("#custom").onsubmit=e=>{e.preventDefault();const n=$("#fName").value.trim(),c=$("#fCo").value.trim();if(n&&c)go(n,c)};

/* ---------- banner ---------- */
function banner(r,working){const b=$("#banner");
 if(!r){b.innerHTML=`<div class="avatar idle">${IC.user}</div><div class="who"><h2 class="faint">Nobody picked yet</h2><div class="sub">Choose a person above and watch it work.</div></div>`;return}
 const p=r.person||{};const title=p.title?`${esc(p.title)} · ${esc(p.current_company||r.company)}`:esc(r.company);
 b.innerHTML=`<div class="avatar">${esc(initials(p.name||r.name))}</div><div class="who"><h2>${esc(p.name||r.name)}</h2><div class="sub">${title}</div>
  ${r.cost?`<div class="meta num det"><span>${r.duration}s</span><span>est. $${r.cost.usd.toFixed(3)}</span><span>${r.cost.searches} searches</span><span>rulebook v${r.rulebook_version}</span>${r.angle?`<span>angle: ${esc(r.angle)}</span>`:""}</div>`:""}</div>
  ${working?`<span class="status s-run"><span class="spin"></span>Working</span>`:status(r.status)}`}

/* ---------- steps: simple 4 phases + detailed 10 steps ---------- */
const lineText=l=>l.slice(l.indexOf("|")+1);
const logOf=i=>stepState[i]?.log||[];
function phaseState(ph){
 /* Throwing out a bad fact (steps 3 and 6) is the system working, so the simple view shows it as done */
 const st=ph.s.map(i=>{const s=stepState[i].state;return(i===2||i===5)&&s==="flag"?"done":s});
 const anyRun=stepState.some(s=>s.state);
 if(st.includes("stop"))return"stop";if(st.includes("run"))return"run";
 if(st.every(s=>!s))return(!busy&&anyRun)?"skip":"";
 if(st.some(s=>!s)){if(busy)return"run";const set=st.filter(Boolean);return set.includes("flag")?"flag":set.includes("wait")?"wait":"done"}
 if(st.includes("wait"))return"wait";if(st.includes("flag"))return"flag";return"done"}
function phaseText(k,state){if(state==="run")return"Working on it…";if(state==="skip"||!state)return state==="skip"?"Not needed":PHASES[k].idle;
 const bad=ph=>PHASES[ph].s.flatMap(logOf).filter(l=>l.startsWith("bad|")).map(lineText);
 if(k===0){if(state==="stop")return bad(0)[0]||"Stopped";const pages=(lineText(logOf(1).at(-1)||"").match(/\d+/)||["0"])[0];
  const blocked=logOf(1).filter(l=>l.includes("hidden instructions")).length;
  return`Searched the web 4 ways and found ${plural(+pages,"page")}.`+(blocked?` Ignored ${plural(blocked,"page")} that tried to trick the AI.`:"")}
 if(k===1){if(logOf(3).some(l=>/people match/.test(l))&&!stepState[4].state)return"More than one person has this name. Pick one to continue.";
  if(state==="stop")return bad(1)[0]||"Stopped";
  const n=(lineText(logOf(2)[0]||"").match(/\d+/g)||[0,0]);const ex=(lineText(logOf(5)[0]||"").match(/\d+/g)||[0,0]);
  const thrown=+n[0]-+n[1],parts=[];if(thrown)parts.push(`threw out ${thrown} it couldn't prove`);if(+ex[1])parts.push(`set aside ${ex[1]} it shouldn't use`);
  return`Found ${plural(+n[0],"fact")}`+(parts.length?`, ${parts.join(" and ")}.`:+n[0]===1?". It checked out.":". All of them checked out.")}
 if(k===2){const h=logOf(6).find(l=>lineText(l).startsWith("Hook:"));const fails=logOf(8).filter(l=>l.startsWith("bad|")).length;
  return(h?`Opened with: ${lineText(h).slice(6)}.`:"No fact was strong enough, so it wrote a general email.")+(fails?` ${plural(fails,"check")} failed.`:" All checks passed.")}
 if(k===3)return state==="wait"?"Waiting for you to approve, edit or reject.":lineText(logOf(9)[0]||"Reviewed")}
function renderSteps(){stepState=INFO.stages.map(()=>({state:"",log:[]}));
 $("#phases").innerHTML=PHASES.map((p,k)=>`<li class="ph" id="ph${k}"><span class="tl-ico">${k+1}</span><div><b>${esc(p.t)}</b><p>${esc(p.idle)}</p></div></li>`).join("");
 $("#timeline").innerHTML=INFO.stages.map((s,i)=>{const r=ROLE[i];const rc=r.startsWith("AI")?"ai":r==="You"?"you":"";
  return`<li class="tl" id="tl${i}"><button class="tl-head" type="button" aria-expanded="false" aria-controls="tlog${i}">
  <span class="tl-ico">${i+1}</span><span><span class="tl-title">${esc(s[0])}<span class="role ${rc}">${r}</span></span><span class="tl-sum">${esc(STEP_INFO[i])}</span></span>
  <span class="chev">${IC.chev}</span></button><div class="tl-log" id="tlog${i}" hidden></div></li>`}).join("");
 $$(".tl-head").forEach(h=>h.onclick=()=>{const open=h.getAttribute("aria-expanded")!=="true";h.setAttribute("aria-expanded",String(open));h.nextElementSibling.hidden=!open});
 drawProgress()}
function drawPhases(){PHASES.forEach((p,k)=>{const st=phaseState(p),li=$("#ph"+k);li.className="ph "+st;
  li.querySelector(".tl-ico").innerHTML=st==="done"?IC.check:st==="stop"?IC.stop:(st==="flag"||st==="wait")?IC.warn:String(k+1);
  li.querySelector("p").textContent=phaseText(k,st)});
 $("#phasebar").innerHTML=PHASES.map(p=>`<div class="${phaseState(p)}"><span></span>${esc(p.t)}</div>`).join("")}
function drawProgress(){$("#progress").innerHTML=stepState.map(s=>`<span class="${s.state||""}"></span>`).join("");
 const i=stepState.findIndex(s=>s.state==="run"),last=stepState.map(s=>s.state).lastIndexOf("stop");
 $("#plabel").textContent=busy&&i>=0?`Step ${i+1} of 10 · ${INFO.stages[i][0]}`:stepState.every(s=>!s.state)?"":
  last>=0?`Stopped at step ${last+1} · ${INFO.stages[last][0]}`:stepState[9].state==="wait"?"Waiting for your review":stepState[9].state?"Reviewed":"Done";
 drawPhases()}
function stepSummary(i,log){if(!log.length)return"";if(i===1)return lineText(log.at(-1));
 if(i===6){const h=log.find(l=>lineText(l).startsWith("Hook:"));return h?lineText(h):lineText(log.find(l=>l.startsWith("mid|"))||log[0])}
 if(i===8)return`${log.filter(l=>l.startsWith("good|")).length} of ${log.length} checks passed`;return lineText(log[0])}
function setStep(e){const s=stepState[e.stage];s.state=e.state;s.log=e.log;const li=$("#tl"+e.stage);li.className="tl "+e.state;
 li.querySelector(".tl-ico").innerHTML=e.state==="done"?IC.check:e.state==="stop"?IC.stop:(e.state==="flag"||e.state==="wait")?IC.warn:String(e.stage+1);
 li.querySelector(".tl-sum").textContent=stepSummary(e.stage,e.log)||(e.state==="run"?"Working…":STEP_INFO[e.stage]);
 li.querySelector(".tl-log").innerHTML=e.log.map(l=>{const k=l.slice(0,l.indexOf("|"));return`<div class="${k?"l-"+k:""}">${esc(lineText(l))}</div>`}).join("");
 const open=e.state==="run"||e.state==="flag"||e.state==="stop";li.querySelector(".tl-head").setAttribute("aria-expanded",String(open));li.querySelector(".tl-log").hidden=!open||!e.log.length;drawProgress()}
function finishSteps(){stepState.forEach((s,i)=>{const li=$("#tl"+i);if(!s.state){li.classList.add("skip");li.querySelector(".tl-sum").textContent="Not needed for this outcome"}
 if(s.state==="done"){li.querySelector(".tl-head").setAttribute("aria-expanded","false");li.querySelector(".tl-log").hidden=true}});drawProgress()}

/* ---------- running ---------- */
async function go(name,company,pick){if(busy)return;busy=true;cur=null;renderScen(name);renderSteps();banner({name,company},true);
 $("#result").innerHTML=`<div class="card empty"><h3>Looking up ${esc(name)}…</h3><p>The steps on the left fill in as it works.</p></div>`;
 $("#bannerCard").scrollIntoView({behavior:reduced()?"auto":"smooth",block:"start"});
 try{const r=await Backend.run(name,company,rep(),pick,setStep);busy=false;finishSteps();cur=r;banner(r);renderResult(true);seen(name);renderScen(name);
  if(r.name==="Priya Raman")mark("priya");if(r.name==="Lena Fischer")mark("lena");if(r.name==="Tom Reyes")mark("tom");loadRb()}
 catch(err){busy=false;drawProgress();banner({name,company,status:"Stopped"});$("#result").innerHTML=`<div class="card outcome"><div class="ic s-bad">${IC.stop}</div><div><h3>Something went wrong</h3><p>${esc(err.message)}</p></div></div>`}}

/* ---------- plain-language result ---------- */
const STRENGTH=(s,L)=>s>=L.strong_hook?"strong":s>=L.minimum_hook?"okay":"weak";
function srcWord(f){const u=f.url||"";return /careers|jobs/.test(u)?"from their own careers page":/press|newsroom/.test(u)?"from a company press release":/podcast|youtube/.test(u)?"from an interview":"from a news article"}
function plainExcl(w){if(!w)return"";if(w.startsWith("sensitive"))return"Bad or sensitive news. Never used in a sales email.";if(w.startsWith("personal"))return"About their personal life, not work. Never used.";
 if(w.startsWith("sources"))return"Two sources give different numbers, so it can't be trusted.";if(w.startsWith("about "))return`It's about a different company (${w.slice(6).split(",")[0]}).`;
 if(w.startsWith("older"))return"Too old to feel relevant.";return w}
function plainFlag(f){if(/^Hook score/.test(f))return"The best fact was only okay, not strong. Read the opening line carefully.";
 if(/^Weak signal/.test(f)||/^Some quality checks failed/.test(f))return null;
 if(/date is unknown/.test(f))return"We don't know how recent the main fact is.";if(/^Role is unclear/.test(f))return"Their job title wasn't clear, so check they are the right person.";
 return f.replace(/ Contacting many people at one company tends to lower replies\./," Emailing many people at one company usually gets fewer replies.")}
function inShort(r){const f=first(r),kept=(r.facts||[]).length,thrown=(r.dropped||[]).length,aside=(r.signals||[]).filter(s=>s.excluded).length;
 const plainCheck=t=>{const m=t.match(/^Number not in any verified fact: (.+)$/);
  if(m)return`The email mentions ${m[1]}, but none of the sources say that. The AI probably made it up, so remove it before sending.`;
  if(/^Length/.test(t))return"The email is too long or too short.";if(/^Banned phrase/.test(t))return`It uses a phrase on the banned list (${t.split(": ")[1]}).`;
  if(/^Mentions:/.test(t))return`It mentions something on the never-mention list (${t.split(": ")[1]}).`;return t};
 const flags=[...(r.checks||[]).filter(c=>!c.ok).map(c=>plainCheck(c.text)),...(r.flags||[]).map(plainFlag).filter(Boolean)];
 let title,ic,cls;if(!r.hook){title="Only a general draft";ic="warn";cls="s-warn"}else if(r.status==="Ready for review"){title="Draft ready for you to check";ic="check";cls="s-ok"}else{title="Draft ready, but check a few things";ic="warn";cls="s-warn"}
 const story=r.hook?`It found ${plural(kept+thrown,"fact")} about ${esc(f)} and their company. ${thrown?`It threw out ${thrown} it couldn't prove. `:""}${aside?`It set aside ${aside} it shouldn't use. `:""}It opened the email with the most useful one, and every fact links to where it was found.`
  :`It couldn't find anything recent and work-related about ${esc(f)}. Instead of pretending to know them, it wrote a general email about what someone in their role usually cares about.`;
 return`<div class="card inshort"><div class="ic ${cls}">${IC[ic]}</div><div><h3>${title}</h3><p>${story}</p>${flags.length?`<ul>${flags.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}</div></div>`}
const OUT_TITLE=r=>r.choices?"Which one did you mean?":r.status==="Not a buyer"?"Wrong person to email":/do-not-contact/.test(r.reason)?"Already a customer, so it stopped":
 /based in/.test(r.reason)?"Stopped by a legal rule":/service failed|failed twice/.test(r.reason)?"A tool failed, so it stopped":/Nothing (usable )?found|Could not confirm/.test(r.reason)?"Couldn't find this person":r.status;
function bodyHtml(body,animate){const opt=RB?.data?.compliance?.opt_out_line;let main=body||"",foot="";
 if(opt&&main.trimEnd().endsWith(opt)){main=main.trimEnd().slice(0,-opt.length).trimEnd();foot=opt}
 const paras=main.split(/\n{2,}/).map((p,i)=>`<p class="${animate?"in":""}" style="${animate?`animation-delay:${i*140}ms`:""}">${esc(p).replace(/\n/g,"<br>").replace(/\[(\d)\]/g,'<button class="cite" type="button" data-src="$1" aria-label="Source $1">$1</button>')}</p>`).join("");
 return{paras,foot}}
function whyCard(r){const L=RB?.data?.limits||{minimum_hook:.45,strong_hook:.6};const items=[];
 (r.signals||[]).forEach(s=>{const isH=r.hook&&s.fact===r.hook.fact,isS=r.second&&s.fact===r.second.fact;
  if(isH||isS)items.push(`<li><span class="lbl ${isH?"used":"also"}">${isH?"Opened with":"Also used"}</span><span>${esc(s.fact)}<span class="strength">${STRENGTH(s.score,L)}</span><span class="because">${esc(TOPIC_WHY[s.topic]||"Related news.")} ${s.date_unknown?"Date unknown":plural(s.days,"day")+" old"}, ${srcWord(s)}.</span></span></li>`);
  else if(s.excluded)items.push(`<li><span class="lbl out">Not used</span><span>${esc(s.fact)}<span class="because">${esc(plainExcl(s.excluded))}</span></span></li>`);
  else items.push(`<li><span class="lbl skip">Not used</span><span>${esc(s.fact)}<span class="because">${s.score<L.minimum_hook?"Not strong enough to open an email with.":"Fine, but less useful than the ones used."}</span></span></li>`)});
 (r.dropped||[]).forEach(x=>items.push(`<li><span class="lbl out">Thrown out</span><span>${esc(x.fact)}<span class="because">${/hidden instructions/.test(x.reason)?"It came from a page that tried to trick the AI.":"The AI said it, but it isn't on the page it came from. Probably made up."}</span></span></li>`));
 if(!items.length)return"";
 return`<div class="card"><div class="card-h"><h3>Why it chose these facts</h3></div><div class="card-b"><ul class="why">${items.join("")}</ul></div></div>`}
function scoreCard(r){if(!r.signals||!r.signals.length)return"";const L=RB?.data?.limits||{minimum_hook:.45,strong_hook:.6};
 return`<div class="card det"><div class="card-h"><h3>Scores behind the choice</h3><span class="eyebrow">details</span></div><div class="card-b"><div class="bars">${r.signals.map(s=>{
  const isH=r.hook&&s.fact===r.hook.fact,isS=r.second&&s.fact===r.second.fact,cls=s.excluded?"excl":isH?"hook":isS?"support":"";
  return`<div class="bar-row ${cls}"><div class="bar-top"><span class="t">${esc(s.fact)}${isH?'<span class="pillmini hook">Hook</span>':""}${isS?'<span class="pillmini sup">Support</span>':""}${s.excluded?`<span class="pillmini x">${esc(s.excluded)}</span>`:""}</span><span class="v num">${s.score.toFixed(2)}</span></div>
  <div class="track"><span class="fill" style="width:${Math.min(100,s.score*100)}%"></span><span class="tick" style="left:${L.minimum_hook*100}%"></span><span class="tick" style="left:${L.strong_hook*100}%"></span></div></div>`}).join("")}</div>
  <div class="legend"><span>Score = 0.5 × how much the topic matters + 0.3 × how recent + 0.2 × how trustworthy the source</span><span>Marks: minimum ${L.minimum_hook}, strong ${L.strong_hook}</span></div></div></div>`}
function checksCard(r){if(!r.checks)return"";const fails=r.checks.filter(c=>!c.ok);
 return`<div class="card"><div class="card-h"><h3>Safety checks on the draft</h3></div><div class="card-b">
  <div class="checkline" style="color:var(${fails.length?"--bad":"--ok"})">${fails.length?IC.stop:IC.check}${fails.length?`${plural(fails.length,"check")} failed, so a person should look`:`All ${r.checks.length} checks passed`}</div>
  ${fails.length?`<ul style="margin:8px 0 0;padding-left:18px;font-size:13.5px">${fails.map(c=>`<li>${esc(c.text)}</li>`).join("")}</ul>`:""}
  <details class="more simple"><summary>See all checks</summary><div class="checks" style="margin-top:8px">${r.checks.map(c=>`<div class="chk ${c.ok?"":"no"}">${c.ok?IC.check:IC.stop}<span>${esc(c.text)}</span></div>`).join("")}</div></details>
  <div class="checks det" style="margin-top:10px">${r.checks.map(c=>`<div class="chk ${c.ok?"":"no"}">${c.ok?IC.check:IC.stop}<span>${esc(c.text)}</span></div>`).join("")}</div></div></div>`}
function renderResult(animate){const r=cur;if(!r)return;let h="";
 if(!r.body){const m=ST[r.status]||ST["Stopped"];
  h+=`<div class="card outcome"><div class="ic ${m.c}">${IC[m.i]}</div><div><h3>${esc(OUT_TITLE(r))}</h3><p>${esc(r.reason)}</p>
  ${r.choices?`<div class="actions">${r.choices.map((p,i)=>`<button class="btn ghost" type="button" data-pick="${i}">${IC.user}${esc(p.title)}, ${esc(p.current_company)}</button>`).join("")}</div>`:""}
  ${r.suggestions&&r.suggestions.length?`<div class="actions">${r.suggestions.map(s=>`<button class="btn" type="button" data-person="${esc(s.name)}">${IC.play}Look up ${esc(s.name)}, ${esc(s.title)}</button>`).join("")}</div>`:""}
  ${/do-not-contact|based in|failed/.test(r.reason)?`<p class="faint" style="font-size:12.5px;margin-top:10px">Stopping here is the correct result. The agent should never guess or break a rule to produce an email.</p>`:""}
  </div></div>`;h+=whyCard(r)}
 else{h+=inShort(r);const p=r.person||{},b=bodyHtml(r.body,animate);
  h+=`<article class="card" id="mail"><dl class="mail-meta"><dt>To</dt><dd>${esc(p.name)} · ${esc(p.title)}, ${esc(p.current_company)}</dd><dt>From</dt><dd>${esc(r.rep||rep())}, Zamp</dd><dt>Subject</dt><dd class="subj">${esc(r.subject)}</dd></dl>
   <div class="mail-body" id="mailBody">${b.paras}</div>
   ${b.foot?`<div class="mail-foot">${esc(b.foot)}<small>This line is added to every email so people can opt out. The sending tool adds the unsubscribe link.</small></div>`:""}
   ${reviewBar(r)}</article><div id="learnSlot"></div>`;
  const src=[r.hook,r.second].filter(Boolean);
  if(src.length)h+=`<div class="card"><div class="card-h"><h3>Where each fact came from</h3><span class="muted" style="font-size:12px">Hover a number in the email</span></div><div class="card-b sources">${src.map((s,i)=>
   `<div class="src" id="src${i+1}"><span class="k">${i+1}</span><div><div class="f">${esc(s.fact)}</div><q>“<mark>${esc(s.evidence)}</mark>”</q><div class="m">${esc(s.url.replace(/^https?:\/\//,""))} · ${s.date_unknown?"date unknown":plural(s.days,"day")+" ago"}</div></div></div>`).join("")}</div></div>`;
  h+=whyCard(r)+scoreCard(r)+checksCard(r)}
 $("#result").innerHTML=h;wireResult()}
function reviewBar(r){if(!r.run_id)return"";
 if(r.review&&r.review!=="pending"){const m={approved:["s-ok","check","You approved this draft"],edited:["s-ok","pen","You approved it with your edits"],rejected:["s-bad","stop","You rejected this draft"]}[r.review];
  return`<div class="reviewbar"><span class="reviewed status ${m[0]}">${IC[m[1]]}${m[2]}</span></div>`}
 return`<div class="reviewbar" id="rbar"><span class="grow muted" style="font-size:13px">Is this good enough to send?</span>
  <button class="btn danger" type="button" data-act="reject">${IC.stop}Reject</button><button class="btn ghost" type="button" data-act="edit">${IC.pen}Edit</button><button class="btn ok" type="button" data-act="approve">${IC.check}Approve</button></div><div id="revform"></div>`}
const reasonSel=id=>`<select id="${id}"><option value="">Just this email, nothing to learn</option>${Object.entries(INFO.reasons).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("")}</select>`;
function wireResult(){
 $$("#result [data-pick]").forEach(b=>b.onclick=()=>go(cur.name,cur.company,+b.dataset.pick));
 $$("#result [data-person]").forEach(b=>b.onclick=()=>go(b.dataset.person,cur.company));
 $$("#result .cite").forEach(c=>{const on=v=>{const s=$("#src"+c.dataset.src);if(s)s.classList.toggle("hot",v);c.classList.toggle("hot",v)};
  c.onmouseenter=()=>on(true);c.onmouseleave=()=>on(false);c.onfocus=()=>on(true);c.onblur=()=>on(false);c.onclick=()=>$("#src"+c.dataset.src)?.scrollIntoView({behavior:"smooth",block:"center"})});
 const bar=$("#rbar");if(!bar)return;
 bar.querySelector("[data-act=approve]").onclick=()=>send({action:"approved"});
 bar.querySelector("[data-act=edit]").onclick=()=>{const b=$("#mailBody");b.innerHTML=`<label for="edBody">Your version</label><textarea id="edBody" rows="12"></textarea>`;$("#edBody").value=cur.body;
  $("#revform").innerHTML=`<div class="revform"><div><label for="edWhy">Should it learn from your edit?</label>${reasonSel("edWhy")}</div><div><input id="edDet" placeholder="Optional detail: a word to avoid, a writing rule, or a job title"></div>
   <div class="actions" style="margin:0"><button class="btn" type="button" id="edSave">Save my version</button><button class="btn ghost" type="button" id="edCancel">Cancel</button></div></div>`;
  $("#edSave").onclick=()=>send({action:"edited",body:$("#edBody").value,reason:$("#edWhy").value||null,detail:$("#edDet").value});$("#edCancel").onclick=()=>renderResult(false)};
 bar.querySelector("[data-act=reject]").onclick=()=>{$("#revform").innerHTML=`<div class="revform"><div><label for="rjWhy">What was wrong? It will suggest a rule so it doesn't happen again.</label>${reasonSel("rjWhy")}</div><div><input id="rjDet" placeholder="Optional detail: a word to avoid, a writing rule, or a job title"></div>
   <div class="actions" style="margin:0"><button class="btn" type="button" id="rjSave" style="background:var(--bad);border-color:var(--bad)">Reject</button><button class="btn ghost" type="button" id="rjCancel">Cancel</button></div></div>`;
  $("#rjSave").onclick=()=>send({action:"rejected",reason:$("#rjWhy").value||null,detail:$("#rjDet").value});$("#rjCancel").onclick=()=>{$("#revform").innerHTML=""}}}
async function send(pl){try{const res=await Backend.review(cur.run_id,pl);cur.review=pl.action;if(pl.action==="edited")cur.body=pl.body;renderResult(false);
  setStep({stage:9,state:pl.action==="rejected"?"stop":"done",log:[`${pl.action==="rejected"?"bad":"good"}|You ${pl.action} this draft`]});
  const slot=$("#learnSlot");if(res.proposal){slot.innerHTML=propCard(res.proposal,true);wireProps(slot)}else if(res.message)slot.innerHTML=`<div class="callout">${IC.warn}<span>${esc(res.message)}</span></div>`}
 catch(e){$("#revform").innerHTML=`<div class="callout bad" style="margin:0 18px 14px">${IC.stop}<span>${esc(e.message)}</span></div>`}}

/* ---------- learning ---------- */
function plainNote(n){const m=n.match(/^Lower '(.+)' news from (\w+) to (\w+) priority$/);if(m)return`Treat “${m[1]}” news as less important (${m[2]} → ${m[3]})`;return n}
function propCard(p,fresh){const rp=p.replay||{},ch=rp.changed||[];
 return`<div class="card learn"><div class="card-h"><h3>${fresh?"It suggests a new rule":"Suggested rule change"}</h3><span class="eyebrow">needs your OK</span></div><div class="card-b">
 <div style="font-size:15px;font-weight:600">${esc(plainNote(p.note))}</div>
 <div class="muted" style="font-size:13px">Before asking you, it tried this rule on ${plural(rp.checked??0,"person")} it already researched. ${ch.length?`It would change the result for ${ch.length}:`:"Nothing else would change."}${rp.note?" "+esc(rp.note):""}</div>
 ${ch.length?`<div class="diff">${ch.map(c=>`<div><b>${esc(c.name)}</b><s>${esc(c.before.hook||c.before.status)}</s><span class="arrow">→</span><span>${esc(c.after.hook||c.after.status)}</span></div>`).join("")}</div>`:""}
 <div class="actions" style="margin:0"><button class="btn" type="button" data-acc="${p.id}">Yes, add this rule</button><button class="btn ghost" type="button" data-dis="${p.id}">No thanks</button></div></div></div>`}
function wireProps(root){root.querySelectorAll("[data-acc]").forEach(b=>b.onclick=async()=>{try{const r=await Backend.acceptProposal(b.dataset.acc);await loadRb();mark("learn");
  b.closest(".card").outerHTML=`<div class="callout" style="background:var(--ok-soft)"><span style="color:var(--ok)">${IC.check}</span><span>Rule added (rulebook version ${r.version}). Run the same person again to see a different opening, then run the test set on the Dashboard.</span></div>`;if(!$("#tab-rules").hidden)renderRules()}
  catch(e){b.closest(".card-b").insertAdjacentHTML("beforeend",`<div class="callout bad">${IC.stop}<span>${esc(e.message)}</span></div>`)}});
 root.querySelectorAll("[data-dis]").forEach(b=>b.onclick=async()=>{await Backend.dismissProposal(b.dataset.dis);b.closest(".card").outerHTML=`<p class="muted" style="font-size:13px;margin:0">Okay, the rules stay as they were.</p>`})}

/* ---------- dashboard ---------- */
async function renderDash(){const runs=await Backend.runs(),n=runs.length,pct=(a,b)=>b?Math.round(100*a/b)+"%":"–";
 const by=k=>runs.filter(r=>(ST[r.status]||{}).k===k).length,reviewed=runs.filter(r=>r.review!=="pending"),ok=reviewed.filter(r=>r.review!=="rejected");
 const avgC=n?runs.reduce((s,r)=>s+(r.cost||0),0)/n:null,avgS=n?runs.reduce((s,r)=>s+(r.duration||0),0)/n:null;
 $("#kpis").innerHTML=[[n,"People researched"],[pct(by("ready"),n),"Drafts ready straight away"],[pct(by("flags")+by("attn")+by("nb"),n),"Needed a person to look"],[pct(ok.length,reviewed.length),`Approved by you (of ${reviewed.length})`],
  [avgC==null?"–":"$"+avgC.toFixed(3),"Cost per person (estimate)"],[avgS==null?"–":avgS.toFixed(1)+"s","Time per person"]].map(k=>`<div class="card kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join("");
 const parts=[["ready","Ready","c-ready"],["flags","Ready, with notes","c-flags"],["attn","Needs a person","c-attn"],["nb","Wrong person","c-nb"],["stop","Stopped on purpose","c-stop"]];
 $("#stackN").textContent=n?plural(n,"person"):"";
 $("#stack").innerHTML=n?parts.map(([k,,c])=>`<span class="${c}" style="width:${100*by(k)/n}%"></span>`).join(""):"";
 $("#stackKey").innerHTML=n?parts.map(([k,l,c])=>`<span><i class="${c}"></i>${l} <b class="num">${by(k)}</b></span>`).join(""):`<span>Try a few people on the Run tab to fill this in.</span>`;
 const vs={};runs.forEach(r=>{const v=vs[r.version]||(vs[r.version]={v:r.version,rev:0,ok:0,runs:0});v.runs++;if(r.review!=="pending")v.rev++;if(r.review==="approved"||r.review==="edited")v.ok++});
 const list=Object.values(vs).sort((a,b)=>a.v-b.v);
 $("#vbars").innerHTML=list.length?list.map(v=>`<div class="vrow"><b class="mono">v${v.v}</b><div class="track"><span class="fill" style="width:${v.rev?100*v.ok/v.rev:0}%"></span></div><span class="muted num">${v.rev?`${v.ok} of ${v.rev} approved`:`none reviewed yet`}</span></div>`).join("")
  :`<p class="muted" style="margin:0;font-size:13px">Every rule change makes a new version. If later versions get approved more often, the rules are getting better.</p>`;
 $("#hist").innerHTML=runs.map((r,i)=>`<tr data-i="${i}"><td class="n">${ago(r.ts)}</td><td><b>${esc(r.name)}</b><div class="muted" style="font-size:12px">${esc(r.company)}</div></td><td>${status(r.status,false)}</td>
  <td>${r.review==="pending"?'<span class="faint">not yet</span>':`<span class="small-status ${r.review==="rejected"?"s-bad":"s-ok"}">${esc(r.review)}</span>`}</td>
  <td>${esc(r.result.hook?.topic||"–")}</td><td class="n">$${(r.cost||0).toFixed(3)}</td><td class="n">v${r.version}</td></tr>`).join("")||`<tr><td colspan="7" class="muted">Nobody researched yet.</td></tr>`;
 $$("#hist tr[data-i]").forEach(tr=>tr.onclick=()=>{const r=runs[+tr.dataset.i];tab("run");cur=r.result;banner(cur);renderSteps();
  const note=`<li class="tl-note">Opened from history, so the live steps aren't shown. <button class="btn ghost rerun" type="button" style="margin-top:8px">${IC.play}Run ${esc(r.name)} again</button></li>`;
  $("#phases").innerHTML=note;$("#timeline").innerHTML=note;$$(".rerun").forEach(b=>b.onclick=()=>go(r.name,r.company));$("#phasebar").innerHTML="";$("#plabel").textContent="";$("#progress").innerHTML="";renderResult(false)});
 if(evalDone)showEval(evalDone)}
function showEval(r){$("#evalScore").innerHTML=`<span style="color:var(${r.passed===r.total?"--ok":"--bad"})">${r.passed}/${r.total}</span>`;
 const failed=r.rows.filter(x=>!x.passed);
 $("#evalGrid").innerHTML=(failed.length?`<div class="callout" style="grid-column:1/-1">${IC.warn}<span>${plural(failed.length,"case")} changed. If you just added a rule, check the change is what you wanted, then update the expected result.</span></div>`:"")
  +r.rows.map(x=>`<div class="ev ${x.passed?"":"no"}">${x.passed?IC.check:IC.stop}<span><b>${esc(x.case)}</b><small>${esc(x.status)}${x.hook?" · "+esc(x.hook):""}</small>${x.problems.length?`<small style="color:var(--bad)">${esc(x.problems.join("; "))}</small>`:""}</span></div>`).join("")}
$("#evalBtn").onclick=async()=>{const b=$("#evalBtn");b.disabled=true;b.innerHTML='<span class="spin"></span>Running…';
 try{evalDone=await Backend.evalAll();showEval(evalDone);mark("eval")}catch(e){$("#evalGrid").innerHTML=`<div class="callout bad">${IC.stop}<span>${esc(e.message)}</span></div>`}
 b.disabled=false;b.textContent="Run test set again"};

/* ---------- rulebook ---------- */
async function renderRules(){await loadRb();const d=RB.data||{},c=d.compliance||{},L=d.limits||{};$("#rbVer").textContent="version "+RB.version;
 const LBL={strong_hook:"Score for a strong opening fact",minimum_hook:"Lowest score it will still use",max_age_days:"Ignore news older than (days)",unknown_date_days:"Undated news counts as (days old)",max_words:"Longest email (words)",company_cooldown_days:"Warn if same company emailed within (days)"};
 $("#rbGlance").innerHTML=`
 <div class="card"><div class="card-h"><h3>What we sell</h3></div><div class="card-b" style="font-size:13.5px">${esc(d.what_we_sell)}</div></div>
 <div class="card"><div class="card-h"><h3>Which news matters most</h3></div><div class="card-b">${Object.entries(d.topics||{}).map(([k,t])=>`<div class="topic"><b>${esc(k)}</b><span class="prio ${esc(t.priority)}">${esc(t.priority)}</span><span class="lk muted">${esc(t.link||"")}</span></div>`).join("")}</div></div>
 <div class="card"><div class="card-h"><h3>Never mention</h3></div><div class="card-b"><div class="tagcloud bad">${(d.never_mention||[]).map(w=>`<span>${esc(w)}</span>`).join("")}</div></div></div>
 <div class="card"><div class="card-h"><h3>Who to email</h3></div><div class="card-b" style="display:grid;gap:10px"><div class="tagcloud">${(d.buyer_titles||[]).map(w=>`<span>${esc(w)}</span>`).join("")}</div><div class="muted" style="font-size:12px">Not these</div><div class="tagcloud">${(d.not_buyer_titles||[]).map(w=>`<span>${esc(w)}</span>`).join("")}</div></div></div>
 <div class="card"><div class="card-h"><h3>Legal and privacy</h3></div><div class="card-b" style="display:grid;gap:8px;font-size:13px"><div><span class="muted">Line at the end of every email</span><br>“${esc(c.opt_out_line||"none")}”</div>
  <div><span class="muted">Never email people in</span> ${(c.blocked_countries||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join(" ")||"no blocked countries"}</div><div><span class="muted">Only use work facts</span> ${c.work_facts_only===false?"no":"yes"}</div></div></div>
 <div class="card"><div class="card-h"><h3>Limits</h3></div><div class="card-b kv">${Object.entries(L).map(([k,v])=>`<span>${esc(LBL[k]||k)}</span><b>${esc(v)}</b>`).join("")}</div></div>`;
 $("#yaml").value=RB.yaml;$("#rbMsg").textContent="";
 $("#vers").innerHTML=RB.versions.map(v=>`<li><span class="v">v${v.version}</span><span>${esc(plainNote(v.note.replace(/^Learned: /,"Learned: ")))}<br><span class="faint">${ago(v.ts)}</span></span></li>`).join("");
 const props=await Backend.proposals();$("#props").innerHTML=props.length?props.map(p=>propCard(p)).join(""):
  `<div class="card"><div class="card-h"><h3>Suggested rule changes</h3></div><div class="card-b muted" style="font-size:13px">None right now. When you reject or edit a draft and say why, it suggests a rule here.</div></div>`;
 wireProps($("#props"))}
$("#saveRb").onclick=async()=>{try{const r=await Backend.saveRulebook($("#yaml").value,$("#ynote").value);$("#ynote").value="";await renderRules();$("#rbMsg").innerHTML=`<span style="color:var(--ok)">Saved as version ${r.version}.</span>`}
 catch(e){$("#rbMsg").innerHTML=`<span style="color:var(--bad)">${esc(e.message)}</span>`}};

/* ---------- how it works ---------- */
function renderHow(){$("#flow").innerHTML=INFO.stages.map((s,i)=>{const r=ROLE[i],rc=r.startsWith("AI")?"ai":r==="You"?"you":"";
  return`<div class="card fstep"><div class="top2"><span class="k">${String(i+1).padStart(2,"0")}</span><span class="role ${rc}">${r}</span></div><b>${esc(s[0])}</b><p>${esc(STEP_INFO[i])}</p></div>`}).join("");
 $("#safety").innerHTML=SAFETY.map(([a,b])=>`<div><b>${esc(a)}</b><span class="muted">${esc(b)}</span></div>`).join("")}

/* ---------- reset ---------- */
let armed=false;$("#resetBtn").onclick=async()=>{const b=$("#resetBtn");if(!armed){armed=true;b.textContent="Click again to clear everything";setTimeout(()=>{armed=false;b.textContent="Reset"},3500);return}
 armed=false;b.textContent="Reset";await Backend.reset();tour=new Set();saveTour();try{sessionStorage.removeItem("od-seen")}catch(e){}evalDone=null;cur=null;
 await loadRb();renderTour();renderScen();renderSteps();banner(null);idle();$("#evalGrid").innerHTML="";$("#evalScore").textContent="";tab("run")};

function idle(){$("#result").innerHTML=`<div class="card empty"><h3>The email will appear here</h3><p>With a short explanation of what it found, what it threw out, and why it wrote what it wrote.</p></div>`}

(async()=>{INFO=await Backend.info();await loadRb();header();renderTour();renderScen();renderSteps();banner(null);idle();renderHow();
 if(!INFO.can_reset)$("#resetBtn").hidden=true})();
})();
