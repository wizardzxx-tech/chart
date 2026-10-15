import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const ROOT=process.cwd(),WEB=path.resolve('sites/ai-life-science-tools/dist');
const SKILL=process.env.PRESENTATIONS_SKILL_DIR;if(!SKILL)throw Error('Set PRESENTATIONS_SKILL_DIR');
const WORK=path.resolve(process.env.BENCH_BUILD||'work/wetlab-bench-20261015');
const OUT=path.resolve(process.env.BENCH_OUTPUT||'outputs/wetlab-bench-20261015');
await fs.mkdir(WORK,{recursive:true});await fs.mkdir(OUT,{recursive:true});
const {resolvePresentationFont,finalizePresentation}=await import(pathToFileURL(SKILL+'/container_tools/artifact_tool_utils.mjs').href);
const FONT=resolvePresentationFont({fontFamily:'Arial'}),W=2400,H=1350,k=.8;
const data=JSON.parse(await fs.readFile(WEB+'/research/workflow/bench-data.json','utf8'));
const p=Presentation.create({slideSize:{width:W*k,height:H*k}}),s=p.slides.add();s.background.fill='#FFFFFF';
const C={ink:'#00355F',blue:'#7399C6',pale:'#ACD4F1',gray:'#A5A5A5',soft:'#EEF6FC',green:'#078549'};
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const svg=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(data.title)}"><title>${esc(data.title)}</title><desc>${esc(data.scope)}</desc><rect width="${W}" height="${H}" fill="#FFFFFF"/>`];
function rect(x,y,w,h,fill,stroke='none',lw=0){s.shapes.add({geometry:'rect',position:{left:x*k,top:y*k,width:w*k,height:h*k},fill,line:{fill:stroke,width:lw*k}});svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);}
function text(x,y,w,h,value,size=24,color=C.ink,bold=false,align='left'){
 const q=s.shapes.add({geometry:'textbox',name:value.split('\n')[0],position:{left:x*k,top:y*k,width:w*k,height:h*k},fill:'none',line:{fill:'none',width:0}});q.text=value;q.text.style={fontFamily:FONT,typeface:FONT,fontSize:size*k,color,bold,alignment:align,verticalAlignment:'top',wrap:'none',insets:0,lineSpacing:1};
 const anchor=align==='center'?'middle':align==='right'?'end':'start',tx=align==='center'?x+w/2:align==='right'?x+w:x;
 svg.push(`<text x="${tx}" y="${y+size*.9}" font-family="Arial,Arial Unicode MS,sans-serif" font-size="${size}" font-weight="${bold?600:400}" fill="${color}" text-anchor="${anchor}">${value.split('\n').map((line,i)=>`<tspan x="${tx}" dy="${i?size*1.25:0}">${esc(line)}</tspan>`).join('')}</text>`);
}
function line(points,color=C.blue,lw=2){const x=Math.min(...points.map(v=>v[0])),y=Math.min(...points.map(v=>v[1])),w=Math.max(.1,Math.max(...points.map(v=>v[0]))-x),h=Math.max(.1,Math.max(...points.map(v=>v[1]))-y);s.shapes.add({geometry:'custom',position:{left:x*k,top:y*k,width:w*k,height:h*k},fill:'none',line:{fill:color,width:lw*k},customPaths:[{width:w*k,height:h*k,commands:points.map((v,i)=>({[i?'lineTo':'moveTo']:{x:(v[0]-x)*k,y:(v[1]-y)*k}}))}]});svg.push(`<polyline points="${points.map(v=>v.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${lw}"/>`);}
function circle(x,y,r,fill,stroke=C.ink,lw=1.5,cls=''){s.shapes.add({geometry:'ellipse',position:{left:(x-r)*k,top:(y-r)*k,width:2*r*k,height:2*r*k},fill,line:{fill:stroke,width:lw*k}});svg.push(`<circle class="${cls}" cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);}
async function image(file,x,y,w,h,alt){const b=await fs.readFile(file),type=file.endsWith('.jpg')?'image/jpeg':file.endsWith('.svg')?'image/svg+xml':'image/png';s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:type,alt,position:{left:x*k,top:y*k,width:w*k,height:h*k},fit:'contain'});svg.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:${type};base64,${b.toString('base64')}" preserveAspectRatio="xMidYMid meet"/>`);}
rect(100,60,10,105,C.ink);text(141,59,2159,76,data.title,56,C.ink,true);
text(141,140,2159,43,data.subtitle,29);line([[100,210],[2300,210]],C.gray,1);
text(100,236,1540,34,'A working bench, shown through the tools on it',27,C.ink,true);
text(1750,236,550,34,'Tools, inputs and brands',27,C.ink,true);
await image(WEB+'/research/workflow/bench-artwork.jpg',80,295,1600,900,'Illustrative gene-construction bench. Generic equipment, not literal branded models.');
const markers=[
 {id:1,label:'DNA fragments + vector',x:460,y:1035,w:350,px:440,py:815,via:[460,950]},
 {id:2,label:'Pipettes + enzyme mix',x:185,y:355,w:340,px:265,py:725,via:[185,565]},
 {id:3,label:'Thermocycler',x:590,y:330,w:300,px:590,py:650,via:[590,480]},
 {id:4,label:'Microcentrifuge',x:895,y:340,w:330,px:835,py:650,via:[895,500]},
 {id:5,label:'Fluorometer + gel',x:1135,y:1035,w:340,px:1140,py:755,via:[1135,940]},
 {id:6,label:'Incubator / shaker',x:1250,y:330,w:330,px:1310,py:610,via:[1250,450]},
 {id:7,label:'Sequence readout',x:1310,y:1120,w:340,px:1525,py:560,via:[1650,1120]}
];
for(const m of markers){
 svg.push(`<g data-bench-tool="${m.id}" role="button" tabindex="0" aria-label="${esc(data.groups[m.id-1].name)}">`);
 line([[m.x,m.y+23],m.via,[m.px,m.py]],C.blue,2);circle(m.px,m.py,5,C.ink,'none',0);
 rect(m.x-26,m.y-27,m.w+26,57,'#FFFFFF');circle(m.x,m.y,24,C.ink,C.ink,1.5,'bench-marker');text(m.x-22,m.y-17,44,36,String(m.id),27,'#FFFFFF',true,'center');text(m.x+37,m.y-16,m.w-36,42,m.label,24,C.ink,true);
 svg.push('</g>');
}
await image(WEB+'/research/assets/logos/twist-trim.png',500,1084,125,38,'Original Twist Bioscience logo');
await image(WEB+'/research/assets/logos/genscript-trim.png',655,1084,155,38,'Original GenScript logo');
line([[1705,285],[1705,1172]],C.gray,1);
for(const g of data.groups){const y=292+(g.id-1)*127;
 circle(1760,y+9,19,C.soft,C.blue,1.5);text(1741,y-4,38,30,String(g.id),22,C.ink,true,'center');
 text(1797,y-8,500,38,g.name,28,C.ink,true);text(1797,y+33,500,30,g.objects,21);text(1797,y+66,500,48,g.brands,20,C.ink,false);
 if(g.id<7)line([[1740,y+119],[2300,y+119]],C.gray,.7);
}
line([[100,1192],[2300,1192]],C.gray,1);
text(100,1210,500,32,'Recurring labware',26,C.ink,true);text(100,1250,600,32,'Tips, PCR plates, microtubes, columns',22);
text(720,1210,750,32,'Examples: Eppendorf / Thermo Fisher / JET Biofil',22);
await image(WEB+'/research/assets/logos/jet-english.png',720,1247,150,33,'Original JET Biofil logo');
text(1630,1210,670,32,'Output: a verified DNA construct',26,C.ink,true);text(1630,1250,670,32,'Ready for downstream expression and assays',22);
text(100,1305,2200,23,'Generic illustration. Brands are alternatives. Numbers identify tool groups, not protocol steps. Sequencing may be outsourced. Sources: workflow/SOURCES.md.',17);
s.speakerNotes.text=await fs.readFile(WEB+'/research/workflow/SOURCES.md','utf8');svg.push('</svg>');
await fs.writeFile(OUT+'/15_gene_building_wetlab.svg',svg.join('\n'));
await fs.writeFile(WORK+'/markers.json',JSON.stringify(markers,null,2));
const png=await p.export({slide:s,format:'png',scale:1.25});await fs.writeFile(WORK+'/native-preview.png',new Uint8Array(await png.arrayBuffer()));
const candidate=WORK+'/single-candidate.pptx';await(await PresentationFile.exportPptx(p)).save(candidate);
const final=path.resolve(process.env.BENCH_PPTX_OUTPUT||OUT+'/Gene_building_wetlab_editable.pptx');
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath:candidate,finalPath:final,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-heading-fit'],explicitTotalSlideCount:1,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:WORK+'/'+path.basename(final)+'.validation.json'});
console.log(JSON.stringify({file:final,slides:1,validation:result}));
