import {VERSION, DEFAULTS, FAMILIES, PROFILES, WORKFLOWS, familyDefaults, sanitize, calculate} from './model.js?v=20261014.2';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=2)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const mult=v=>typeof v==='number'&&Number.isFinite(v)?`${num(v)}×`:'n.a.', money=v=>`US$${num(v)}bn`;
const uplift=v=>`${v>=0?'+':''}${num(v*100,1)}%`;
const presets={reference:[25,5],expansion:[50,5],stress:[100,3],breakout:[200,2],zero:[0,5]};
let state=sanitize(DEFAULTS), result, evidence;
try {const raw=new URL(location.href).searchParams.get('s');if(raw&&raw.length<12000)state=sanitize(JSON.parse(raw));}catch{}
const colors=()=>document.documentElement.dataset.theme==='light'?{ink:'#00355F',muted:'#00355F',line:'#A5A5A5',bg:'#FFFFFF',pale:'#EEF6FC',a:'#ACD4F1',b:'#7399C6',test:'#00355F',testInk:'#FFFFFF'}:{ink:'#FFFFFF',muted:'#ACD4F1',line:'#7399C6',bg:'#00355F',pale:'#0D3F67',a:'#ACD4F1',b:'#7399C6',test:'#ACD4F1',testInk:'#00355F'};
const text=(x,y,label,size=17,fill=colors().ink,weight=400,anchor='start')=>`<text x="${x}" y="${y}" fill="${fill}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(label)}</text>`;
function funnel(r){
 const c=colors(),s=r.state;
 const layer=(y,w1,w2,h,fill,title,value,caption,ink)=>`<path d="M${190-w1/2} ${y}H${190+w1/2}L${190+w2/2} ${y+h}H${190-w2/2}Z" fill="${fill}" stroke="${c.line}" stroke-width="1.4"/>${text(190,y+30,title,20,ink,600,'middle')}${text(190,y+66,value,30,ink,600,'middle')}${text(190,y+h-17,caption,12,ink,400,'middle')}`;
 return `<title>Funding-supported Build and Test capacity</title><desc>Build ${num(r.build.funded)} times and Test ${num(r.test.funded)} times, baseline one. Schematic widths do not encode volumes.</desc>`+
 layer(12,360,290,100,c.a,'Virtual search / design','AI-enabled','Quality + selection','#00355F')+
 layer(126,282,222,140,c.b,'BUILD · samples',mult(r.build.funded),r.build.ceiling?'10× cohort ceiling':'Physical construction','#00355F')+
 layer(280,212,155,140,c.test,'TEST · assays',mult(r.test.funded),r.test.ceiling?'10× cohort ceiling':'Biological validation',c.testInk)+
 `<path d="M${267} 438H${113}L136 514H244Z" fill="${c.pale}" stroke="#F67F26" stroke-width="1.5"/>${text(190,466,'Clinical entry',17,c.ink,600,'middle')}${text(190,493,'Funded programs',13,c.muted,400,'middle')}`+
 `<path d="M140 530H240L228 600H152Z" fill="${c.pale}" stroke="#BE3232" stroke-width="1.5"/>${text(190,557,'Approval',15,c.ink,600,'middle')}${text(190,582,'Unproven',16,c.muted,400,'middle')}`+
 `<path d="M335 126h22v294h-22" fill="none" stroke="${c.ink}" stroke-width="2"/>${text(190,637,'WET LAB = BUILD + TEST',17,c.ink,600,'middle')}${text(190,663,`Endpoint: year ${s.years} · schematic widths`,12,c.muted,400,'middle')}`;
}
function renderFunding(r){
 const rows=[['Annual program funding',r.annual,`${money(r.state.investment)} total ÷ ${r.state.years} years`],['Wet-lab funding',r.annualWet,`${r.state.wetShare}% of annual funding · equipment + lab execution`],['Productive equipment',r.annualEquipment,`${r.state.capexShare}% of wet-lab funding · cumulative stock: ${money(r.totalEquipment)}`],['Lab execution',r.annualRuns,`People, inputs and shared operations · other program uses: ${money(r.otherAnnual)} / year`]];
 $('#funding-results').innerHTML=rows.map(([label,v,note])=>`<div class="flow-result"><span>${label}</span><strong>${num(v)}<small class="value-unit">bn</small></strong><small>${esc(note)}</small></div>`).join('');
 $('#funding-stack').innerHTML=[r.otherAnnual,r.annualEquipment,r.annualRuns].map(v=>`<span style="width:${r.annual?100*v/r.annual:0}%"></span>`).join('');
}
function renderFamilies(r){
 $('#family-scope').textContent='LST PROCUREMENT RESPONSE · ONE COMBINED VIEW';
 if(!r.valid){$('#family-cards').innerHTML='<p class="mix-error" role="alert">Set at least one positive workflow weight to calculate Total.</p>';$('#leader-note').textContent='The same funding pool is allocated once across the selected mix.';return;}
 const scale=Math.max(3,...r.families.map(f=>Math.ceil(f.value)));
 $('#family-cards').innerHTML=FAMILIES.map(f=>{
  const p=r.families.find(x=>x.id===f.id),rank=r.ranked.findIndex(x=>x.id===f.id)+1,leader=!r.priceTie&&Math.abs(p.value-r.ranked[0].value)<.005;
  return `<article class="family-card ${leader?'is-leader':''}" data-card="${f.id}"><span class="family-rank">${r.priceTie||p.cohort===null?'—':`#${rank}`}</span><div class="family-card-head"><svg class="family-icon" aria-hidden="true"><use href="../research/assets/icon-sprite.svg#${f.icon}"/></svg><h3>${esc(f.title)}</h3></div><p class="family-products">${esc(f.products)}</p><div class="family-multiplier" data-value="${p.cohort??''}">${mult(p.cohort)}</div><p class="family-index-label">AI-lab purchases · 1× baseline</p><p class="market-impact">Estimated whole-family uplift <strong>${uplift(p.market-1)}</strong><small>Assumed AI exposure ${num(p.exposure,1)}%</small></p><div class="family-meter"><i style="width:${100*(p.value-1)/(scale-1)}%"></i></div><div class="meter-labels"><span>1×</span><span>${num(scale,0)}× common scale</span></div><p class="family-driver">${r.state.profile==='total'?'Mixed workflow responses':`Activity driver ${mult(p.driver)}`}${p.cohort===null?' · no AI purchase baseline':''}</p><p class="family-reason">${esc(f.reason)}</p><div class="family-logos">${f.logos.map(file=>`<img src="../research/assets/logos/${file}" alt="${esc(file.split('-')[0])}" loading="lazy">`).join('')}${f.wordmark?`<span class="wordmark">${esc(f.wordmark)}</span>`:''}</div><div class="supplier-columns"><div><p>CHINA / HK LISTINGS</p>${f.cn.map(t=>`<span>${esc(t)}</span>`).join('')}</div><div><p>US LISTINGS / PARENTS</p>${f.us.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div></article>`;
 }).join('');
 const leading=FAMILIES.find(f=>f.id===r.ranked[0]?.id);
 const shared=r.ranked.length?r.families.filter(f=>f.cohort!==null&&Math.abs(f.value-r.ranked[0].value)<.005).map(f=>FAMILIES.find(x=>x.id===f.id).title):[];
 $('#leader-note').textContent=r.priceTie?'No differentiated AI-lab purchasing uplift under these inputs.':`${shared.length>1?shared.join(' and '):leading.title} ${shared.length>1?'lead':'leads'} the AI-lab purchasing response under these assumptions. The smaller line on each card shows the estimated whole-family effect.`;
}
function renderCapacity(r){
 $('#scenario-funnel').innerHTML=funnel(r);
 const statuses=[['Build',r.build],['Test',r.test]].map(([label,p])=>{
  let note=`${label}: ${mult(p.funded)} · binding constraint: ${p.binding.toLowerCase()}.`;
  if(p.gap>0)note+=` Below the 2× target by ${num(p.gap)}×.`;
  if(p.ceiling)note+=` Uncapped model support ${mult(p.raw)} exceeds the 10× cohort envelope; the chart uses 10×.`;
  return `<p class="${p.gap||p.ceiling?'status-alert':'status-ok'}">${esc(note)}</p>`;
 });
 $('#capacity-status').innerHTML=statuses.join('');
}
function renderRamp(r){
 const c=colors(),left=66,right=720,top=25,bottom=240,x=i=>left+(right-left)*(i+1)/r.state.years,y=v=>bottom-(v-1)/9*(bottom-top);
 const grid=[1,2,5,10].map(v=>`<path d="M${left} ${y(v)}H${right}" stroke="${c.line}" stroke-opacity=".45"/>${text(left-13,y(v)+5,`${v}×`,13,c.muted,400,'end')}`).join('');
 const line=(key,color)=>{const points=[[left,y(1)],...r.timeline.map((t,i)=>[x(i),y(t[key])])];return `<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="3"/>`+r.timeline.map((t,i)=>`<circle cx="${x(i)}" cy="${y(t[key])}" r="4.5" fill="${color}"/>`).join('');};
 $('#ramp-chart').innerHTML=`<title>Throughput ramp, baseline one</title>${grid}${line('build',c.b)}${line('test',c.ink)}${text(left,278,'0',13,c.muted)}${r.timeline.map((t,i)=>text(x(i),278,`Y${t.year}`,13,c.muted,400,'middle')).join('')}${text(505,14,'— Build',13,c.b,600)}${text(620,14,'— Test',13,c.ink,600)}`;
 $('#timing-note').textContent=`${money(r.productiveEquipment)} commissioned equipment at year ${r.state.years}; ${money(r.annualRuns)} annual lab execution funding. ${r.build.binding==='Equipment capacity'&&r.test.binding==='Equipment capacity'?'Both stages are equipment-bound. At zero commissioning lag, shortening deployment raises annual funding but leaves endpoint throughput unchanged.':'The endpoint is limited by the smaller of commissioned equipment and annual lab execution support.'} After the program, continued execution needs recurring funding.`;
 $('#breakpoints').innerHTML=[2,10].map(m=>{const n=r.needs[m],gap=n.both===null?null:Math.max(0,n.both-r.state.investment);return `<div class="breakpoint"><span>Both stages at ${m}×</span><strong>${n.both===null?'Infeasible':money(n.both)}</strong><small>${n.both===null?'A necessary funding share, rollout realization or commissioning fraction is zero.':`Build needs ${money(n.build)}; Test needs ${money(n.test)}. ${gap>0?`Additional total funding: ${money(gap)}${n.both>200?' (outside the slider range)':''}.`:'Current total funding meets this modeled target.'}`}</small></div>`;}).join('');
}
function coefficients(){
 const selected=state.profile==='total'?WORKFLOWS:[state.profile];
 $('#coefficient-rows').innerHTML=selected.map(w=>`<tr class="workflow-coefficient-title"><td colspan="5">${esc(PROFILES[w].label)}</td></tr>`+state.workflowFamilies[w].map(p=>`<tr><td>${FAMILIES.find(f=>f.id===p.id).title}</td>${[['buildWeight',0,1,.05],['elasticity',0,1.5,.05],['price',.1,2,.05],['exposure',0,100,1]].map(([key,min,max,step])=>`<td><input type="number" data-workflow="${w}" data-family="${p.id}" data-family-param="${key}" value="${p[key]}" min="${min}" max="${max}" step="${step}" aria-label="${esc(PROFILES[w].label)} ${esc(FAMILIES.find(f=>f.id===p.id).title)} ${key}"></td>`).join('')}</tr>`).join('')).join('');
}
function syncControls(){
 $$('[data-global]').forEach(el=>el.value=state[el.id]);$('#profile').value=state.profile;
 $$('[data-mix]').forEach(el=>el.value=state.workflowWeights[el.dataset.mix]);
 coefficients();
}
function render(){
 result=calculate(state);state=result.state;
 for(const key of ['investment','years','wetShare','capexShare','testShare','utilization']){
  $(`#${key}-value`).textContent=key==='investment'?money(state[key]):key==='years'?`${state.years} years`:`${num(state[key],0)}%`;
 }
 $$('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(presets[b.dataset.preset][0]===state.investment&&presets[b.dataset.preset][1]===state.years)));
 $('#workflow-mix').hidden=state.profile!=='total';
 $('#mix-detail').textContent=result.valid?WORKFLOWS.map(k=>`${PROFILES[k].label}: ${num(result.weights[k]*100,1)}% (${money(state.investment*result.weights[k])})`).join(' · '):'Set at least one positive weight. Weights are normalized to 100%.';
 $('#download-svg').disabled=!result.valid;$('#download-csv').disabled=!result.valid;
 renderFunding(result);renderCapacity(result);renderFamilies(result);renderRamp(result);
}
$$('[data-global]').forEach(el=>{
 el.addEventListener('input',()=>{if(el.value===''||!el.validity.valid)return;state[el.id]=Number(el.value);render();});
 el.addEventListener('change',()=>{state[el.id]=el.value===''?DEFAULTS[el.id]:Number(el.value);render();el.value=state[el.id];});
});
$('#coefficient-rows').addEventListener('input',e=>{const el=e.target;if(!el.dataset.family||el.value===''||!el.validity.valid)return;state.workflowFamilies[el.dataset.workflow].find(f=>f.id===el.dataset.family)[el.dataset.familyParam]=Number(el.value);render();});
$('#coefficient-rows').addEventListener('change',e=>{const el=e.target;if(!el.dataset.family)return;const key=el.dataset.familyParam,w=el.dataset.workflow,p=state.workflowFamilies[w].find(f=>f.id===el.dataset.family);p[key]=el.value===''?familyDefaults(w).find(f=>f.id===p.id)[key]:Number(el.value);render();el.value=state.workflowFamilies[w].find(f=>f.id===p.id)[key];});
$('#profile').addEventListener('change',e=>{state.profile=e.target.value;coefficients();render();});
$$('[data-mix]').forEach(el=>{el.addEventListener('input',()=>{if(el.value===''||!el.validity.valid)return;state.workflowWeights[el.dataset.mix]=Number(el.value);render();});el.addEventListener('change',()=>{state.workflowWeights[el.dataset.mix]=el.value===''?0:Number(el.value);render();el.value=state.workflowWeights[el.dataset.mix];});});
$$('[data-preset]').forEach(b=>b.addEventListener('click',()=>{[state.investment,state.years]=presets[b.dataset.preset];syncControls();render();}));
$('#reset-all').addEventListener('click',()=>{state=sanitize(DEFAULTS);syncControls();render();status('Default expansion scenario restored.');});
function updateTheme(){const dark=document.documentElement.dataset.theme!=='light';$('#theme-toggle').textContent=dark?'Light':'Dark';$('#theme-toggle').setAttribute('aria-label',`Switch to ${dark?'light':'dark'} theme`);}
$('#theme-toggle').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('lst-theme',document.documentElement.dataset.theme);}catch{}updateTheme();render();});
function status(message){$('#action-status').textContent=message;}
function download(filename,body,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status(`Downloaded ${filename}.`);}
$('#copy-scenario').addEventListener('click',async()=>{const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('s',JSON.stringify(state));history.replaceState(null,'',url);try{await navigator.clipboard.writeText(url.href);status('Scenario link copied; it preserves all assumptions.');}catch{status('Clipboard unavailable. The current scenario is now in the address bar.');}});
function payload(){return {model_version:VERSION,as_of:'2026-10-14',scope:'Global incremental AI-enabled biomedical research program',units:{money:'US$bn',annual_flows:'US$bn/year',throughput:'baseline 1x',purchasing:'non-additive index, baseline 1x'},inputs:state,outputs:result,interpretation:'All cost, productivity, response and exposure parameters are analyst assumptions. No calibrated global forecast, additive TAM or company revenue forecast. Stage capacity uses a 10x cohort ceiling; raw support is retained.',source_register:'evidence.json',methodology:'methodology.md'};}
$('#download-json').addEventListener('click',()=>download('AI_LST_scenario.json',JSON.stringify(payload(),null,2),'application/json'));
$('#download-csv').addEventListener('click',()=>{
 const inputUnits={investment:'US$bn',years:'years',lag:'years',wetShare:'%',capexShare:'%',testShare:'%',utilization:'%',manufacturing:'%',labPurification:'%',buildCapital:'US$bn',testCapital:'US$bn',buildRunCost:'US$bn/year',testRunCost:'US$bn/year',productivity:'ratio',profile:'workflow',view:'scope'};
 const rows=[['Section','Metric','Value','Unit','Scope'],['Model','Version',VERSION,'',''],...Object.entries(state).filter(([k])=>!['families','workflowFamilies','workflowWeights'].includes(k)).map(([k,v])=>['Input',k,v,inputUnits[k]||'','Analyst assumption']),...result.allocation.map(a=>['Workflow allocation',a.workflow,a.investment,'US$bn',`${num(a.weight*100,2)}% of same pool and reference cohort`]),...['annual','annualWet','annualEquipment','annualRuns','otherAnnual'].map(k=>['Funding',k,result[k],'US$bn/year','Global new program']),...['build','test'].flatMap(k=>[['Capacity',`${k} funded capped`,result[k].funded,'x','Reference cohort'],['Capacity',`${k} raw uncapped`,result[k].raw,'x','Reference cohort']]),...result.families.flatMap(p=>[['Family',`${p.id} AI-lab purchases`,p.cohort??'n.a.','x','AI-lab purchase baseline'],['Family',`${p.id} whole-family uplift`,p.market-1,'fraction','Assumed AI exposure']]),...WORKFLOWS.flatMap(w=>result.components[w].flatMap(p=>['buildWeight','elasticity','price','exposure'].map(k=>['Component coefficient',`${w} / ${p.id} / ${k}`,p[k],k==='exposure'?'%':'ratio','Analyst assumption'])))];
 const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');download('AI_LST_scenario_results.csv',csv,'text/csv;charset=utf-8');
});
function snapshot(){
 const r=result,c=colors();
 const box=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${c.pale}" stroke="${c.line}"/>`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><title>AI wet-lab investment scenario</title><desc>Editable SVG. All dollar-to-capacity and purchasing responses are analyst assumptions.</desc><metadata>${esc(JSON.stringify(payload()))}</metadata><rect width="1920" height="1080" fill="${c.bg}"/>${text(65,72,'From investment to experimental capacity',42,c.ink,600)}${text(65,111,`${money(state.investment)} over ${state.years} years · ${money(r.annual)} / year · wet-lab share ${state.wetShare}%`,21,c.muted)}${text(65,145,`${PROFILES[state.profile].label} · Combined procurement view · 14 Oct 2026`,18,c.muted)}<path d="M65 170H1855" stroke="${c.line}"/>`;
 svg+=`<g transform="translate(55 196) scale(.97)">${funnel(r)}</g>`;
 svg+=text(65,903,`Build ${mult(r.build.funded)} · Test ${mult(r.test.funded)}`,21,c.ink,600);
 svg+=text(65,940,'2–10× target; funding support may be lower.',15,c.muted);
 FAMILIES.forEach((f,i)=>{const p=r.families.find(x=>x.id===f.id),x=490+i%3*455,y=208+Math.floor(i/3)*342;svg+=box(x,y,430,318)+text(x+23,y+39,f.title,22,c.ink,600)+text(x+23,y+98,mult(p.cohort),45,c.ink,600)+text(x+23,y+126,'AI-lab purchases (1x baseline)',14,c.muted)+text(x+23,y+161,`Estimated whole-family uplift ${uplift(p.market-1)}`,14,c.muted)+text(x+23,y+192,'CHINA / HK LISTINGS',11,c.muted,600)+f.cn.map((v,j)=>text(x+23,y+216+j*21,v,14,c.ink)).join('')+text(x+23,y+263,'US LISTINGS / PARENTS',11,c.muted,600)+f.us.map((v,j)=>text(x+23,y+286+j*20,v,14,c.ink)).join('');});
 svg+=box(490,901,1340,53)+text(513,934,'Automation + data orchestration span every family · Tecan / Hamilton / Benchling',21,c.ink,600);
 svg+=text(65,996,'Illustrative inputs. Non-additive purchasing indices; no company revenue or clinical-success forecast.',18,c.muted)+text(65,1030,`Sources and definitions: wizardzxx-tech.github.io/chart/v2/scenarios/ · Model ${VERSION}`,15,c.muted);
 return svg+'</svg>';
}
$('#download-svg').addEventListener('click',()=>download('AI_LST_investment_scenario_editable.svg',snapshot(),'image/svg+xml'));
const evidenceCopy={
 'biohub-april-2026':{title:'Biohub · biological data generation',amount:'US$0.5bn · five years',body:'The April commitment includes US$0.4bn for in-house data and measurement technologies and US$0.1bn for external research. It is included in the October expansion.',limit:'Research and technology funding, not an instrument-only budget. Do not add it to the October total.'},
 'biohub-october-2026':{title:'Biohub + DOE + NIH + partners',amount:'US$1.8bn · mixed commitment',body:'The October expansion combines Biohub’s founding US$0.5bn, more than US$0.5bn from DOE, prior NIH data investments and US$0.3bn from partners.',limit:'Includes existing data and compute. Five years is explicit for Biohub / DOE, not necessarily every component. It is not US$1.8bn of all-new cash.'},
 'lilly-nvidia-2026':{title:'Lilly + NVIDIA · AI co-innovation lab',amount:'Up to US$1bn · five years',body:'An announced infrastructure and research program links computational models with agentic wet labs, robotics and large-scale biological data generation.',limit:'Includes talent and compute. Maximum commitment, not actual spend; no disclosed equipment / lab-execution split.'},
 'isomorphic-series-b-2026':{title:'Isomorphic Labs · Series B',amount:'US$2.1bn · corporate financing',body:'Funding supports its AI design engine, therapeutic pipeline and global expansion. No deployment horizon is disclosed.',limit:'Corporate fundraising is not infrastructure procurement. Possible overlap with partner commitments prevents a clean additive total.'}
};
async function loadEvidence(){try{const response=await fetch('evidence.json');if(!response.ok)throw Error(response.status);evidence=await response.json();$('#evidence-cards').innerHTML=evidence.announcements.map(e=>{let copy=evidenceCopy[e.id];if(!copy)copy={title:e.organization,amount:money(e.amount_usd_bn),body:e.scope,limit:e.limitations[0]};return `<article class="evidence-card"><span class="eyebrow">${esc(e.announcement_date)}</span><h3>${esc(copy.title)}</h3><div class="evidence-amount">${esc(copy.amount)}</div><p>${esc(copy.body)}</p><p><strong>Boundary.</strong> ${esc(copy.limit)}</p><a href="${esc(e.url)}" target="_blank" rel="noopener">Primary announcement ↗</a></article>`;}).join('');}catch{$('#evidence-cards').innerHTML='<p>Source cards could not load. Use the primary-source register below.</p>';}}
syncControls();updateTheme();render();loadEvidence();
