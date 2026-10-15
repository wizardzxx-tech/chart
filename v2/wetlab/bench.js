const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,svg;
function select(id){const g=data.groups.find(x=>x.id===id);if(!g)return;document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.tool)===id)));svg.querySelectorAll('[data-bench-tool]').forEach(n=>n.classList.toggle('active',Number(n.dataset.benchTool)===id));$('#tool-detail').innerHTML=`<p class="selected-label">BENCH ITEM ${g.id}</p><h2>${esc(g.name)}</h2><p class="purpose">${esc(g.purpose)}</p>${g.items.map(item=>`<article class="item"><p class="item-type">${esc(item.category)}</p><h3>${esc(item.name)}</h3><p>${esc(item.use)}</p><p class="brands"><strong>Representative examples</strong><br>${esc(item.examples)}</p><a href="${esc(item.source)}" target="_blank" rel="noopener">Manufacturer source ↗</a></article>`).join('')}`;history.replaceState(null,'','#item-'+id);}
try {
 const [d,r]=await Promise.all([
  fetch('../research/workflow/bench-data.json?v=20261015').then(r=>{if(!r.ok)throw Error('Item guide unavailable');return r.json()}),
  fetch('../research/svg/15_protein_antibody_screening_workflow.svg?v=20261015').then(r=>{if(!r.ok)throw Error('Figure unavailable');return r.text()})
 ]);
 data=d;
 const doc=new DOMParser().parseFromString(r,'image/svg+xml');
 if(doc.querySelector('parsererror'))throw Error('Figure could not be read');
 svg=document.importNode(doc.documentElement,true);svg.setAttribute('viewBox','70 280 1620 910');svg.setAttribute('role','group');svg.setAttribute('aria-label','Gene construction bench. Select numbered items to inspect tools and suppliers.');
 $('#bench-scene').replaceChildren(svg);
 $('#tool-tabs').innerHTML=data.groups.map(g=>`<button type="button" data-tool="${g.id}" aria-pressed="false"><b>${g.id}</b>${esc(g.name)}</button>`).join('');
 document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>select(Number(b.dataset.tool))));
 svg.querySelectorAll('[data-bench-tool]').forEach(n=>{
  n.addEventListener('click',()=>select(Number(n.dataset.benchTool)));
  n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(Number(n.dataset.benchTool));}});
 });
 select(Number(location.hash.replace('#item-',''))||2);
} catch(e) {
 $('#bench-scene').textContent=e.message;$('#tool-detail').innerHTML='<p><a href="../research/workflow/SOURCES.md">Open the written item guide and sources ↗</a></p>';console.error(e);
}
