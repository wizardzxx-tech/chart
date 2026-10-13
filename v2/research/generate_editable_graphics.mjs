import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const cwd=path.dirname(fileURLToPath(import.meta.url)), OUT=cwd, TMP=path.join(cwd,'.build');
await fs.mkdir(TMP,{recursive:true});
const SKILL=process.env.PRESENTATIONS_SKILL_DIR;
if(!SKILL)throw new Error('Set PRESENTATIONS_SKILL_DIR to the installed Presentations skill directory.');
const {resolvePresentationFont,finalizePresentation}=await import(pathToFileURL(path.join(SKILL,'container_tools/artifact_tool_utils.mjs')).href);
const FONT=resolvePresentationFont({fontFamily:'Arial'});
const P=Presentation.create({slideSize:{width:1920,height:1080}});
const C={ink:'#00355F',muted:'#00355F',teal:'#00355F',aqua:'#EEF6FC',blue:'#00355F',pale:'#EEF6FC',gold:'#F67F26',sand:'#FFFFFF',line:'#A5A5A5',white:'#FFFFFF',red:'#BE3232'};
await fs.mkdir(OUT+'/editable',{recursive:true});await fs.mkdir(OUT+'/svg',{recursive:true});await fs.mkdir(OUT+'/png',{recursive:true});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let S,svg=[],SCALE=1;
function start(){S=P.slides.add();S.background.fill=C.white;svg=['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="white"/>'];return S;}
function rect(x,y,w,h,fill,stroke='none',r=0,lw=1){let sh=S.shapes.add({geometry:r?'roundRect':'rect',position:{left:x*SCALE,top:y*SCALE,width:w*SCALE,height:h*SCALE},fill,line:{fill:stroke,width:lw*SCALE},borderRadius:r*SCALE||0});svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);return sh;}
function text(x,y,w,h,t,size=24,color=C.ink,bold=false,align='left'){
 const sh=S.shapes.add({geometry:'textbox',name:t.split('\n')[0],position:{left:x*SCALE,top:y*SCALE,width:w*SCALE,height:h*SCALE},fill:'none',line:{fill:'none',width:0}});sh.text=t;sh.text.style={fontFamily:FONT,typeface:FONT,fontSize:size*SCALE,color,bold,alignment:align,verticalAlignment:'top',wrap:'none',insets:0};
 const lines=t.split('\n'),anchor=align==='center'?'middle':align==='right'?'end':'start',tx=align==='center'?x+w/2:align==='right'?x+w:x;
 svg.push(`<text x="${tx}" y="${y+size*.84}" fill="${color}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${bold?700:400}" text-anchor="${anchor}">${lines.map((l,i)=>`<tspan x="${tx}" dy="${i?size*1.25:0}">${esc(l)}</tspan>`).join('')}</text>`);return sh;
}
function poly(points,fill,stroke='none',lw=1){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
 const commands=[{moveTo:{x:points[0][0]-x,y:points[0][1]-y}},...points.slice(1).map(([a,b])=>({lineTo:{x:a-x,y:b-y}})),{close:{}}];
 const sh=S.shapes.add({geometry:'custom',position:{left:x*SCALE,top:y*SCALE,width:w*SCALE,height:h*SCALE},fill,line:{fill:stroke,width:lw*SCALE},customPaths:[{width:w,height:h,commands}]});svg.push(`<polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);return sh;}
function line(x1,y1,x2,y2,color=C.line,lw=1,dash=false){
 const x=Math.min(x1,x2),y=Math.min(y1,y2),w=Math.max(Math.abs(x2-x1),.01),h=Math.max(Math.abs(y2-y1),.01);
 S.shapes.add({geometry:'custom',position:{left:x*SCALE,top:y*SCALE,width:w*SCALE,height:h*SCALE},fill:'none',line:{fill:color,width:lw*SCALE,style:dash?'dashed':'solid'},customPaths:[{width:w,height:h,commands:[{moveTo:{x:x1-x,y:y1-y}},{lineTo:{x:x2-x,y:y2-y}}]}]});svg.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${lw}" ${dash?'stroke-dasharray="6 6"':''}/>`);
}
async function pic(file,x,y,w,h,icon=false){const b=await fs.readFile(OUT+'/assets/'+file);const type=file.endsWith('.svg')?'image/svg+xml':file.endsWith('.jpg')?'image/jpeg':'image/png';let data=b;if(icon)data=Buffer.from(b.toString().replaceAll('currentColor',typeof icon==='string'?icon:C.teal));
 S.images.add({blob:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),contentType:type,alt:path.basename(file),fit:'contain',position:{left:x*SCALE,top:y*SCALE,width:w*SCALE,height:h*SCALE}});
 svg.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="data:${type};base64,${data.toString('base64')}"/>`);
}
function header(title,subtitle){rect(72,54,9,85,C.teal);text(105,52,1735,58,title,46,C.ink,true);text(106,120,1700,38,subtitle,23,C.muted);line(72,176,1848,176,C.line,1);}
async function end(stem){if(SCALE!==1)svg.push('</g>');svg.push('</svg>');await fs.writeFile(OUT+'/svg/'+stem+'.svg',svg.join('\n'));await fs.writeFile(TMP+'/'+stem+'.layout.json',await (await S.export({format:'layout'})).text());const b=await P.export({slide:S,format:'png',scale:2.5});await fs.writeFile(OUT+'/png/'+stem+'.png',new Uint8Array(await b.arrayBuffer()));}
const defaultRows=[["Virtual search / design", "Large virtual\nlibraries", "Quality +\nselection", "Large libraries predate generative AI.\nThe investment mechanism is better selection and learning."], ["Physical samples", "Program-\nspecific", "Modality-\ndependent", "Small molecules can need fewer syntheses per program.\nProtein libraries and individual profiling are different units."], ["Assay workload", "1× baseline", "1× / 2× /\n5× / 10×", "Analyst workload sensitivities, not predicted fully profiled\ncandidate counts. Include an efficiency/no-growth case."], ["Clinical development", "Phase I\nprograms", "Funded clinical\nprograms", "Clinical biology, patients, capital and time remain\nconstraints; discovery gains do not establish clinical gains."], ["Phase I to approval", "7.9% / 13.8%\n(study estimates)", "AI advantage\nunproven", "BIO 2011–2020 and Wong 2000–2015 are different\ncohorts and methods, not an AI comparison."]];
const INPUT=JSON.parse(await fs.readFile(OUT+'/ecosystem_data.json','utf8'));
const rows=INPUT.stages??defaultRows;
start();header('AI discovery: workflows, evidence and sensitivities','Modalities use different units. Workload sensitivities and historical clinical benchmarks are shown separately.');
const table=S.tables.add({rows:6,columns:4,left:72,top:230,width:1776,height:606,columnWidths:[435,310,330,701],values:[['STAGE','BEFORE GEN-AI','AI MECHANISMS','WHAT CHANGES'],...rows]});
table.styleOptions={headerRow:true,bandedRows:false};table.borders.assign({fill:C.white,width:0});
const heights=[70,116,105,105,105,105];
for(let r=0;r<6;r++){table.rows[r].height=heights[r];for(let c=0;c<4;c++){
 const cell=table.getCell(r,c);cell.fill=r===0?C.ink:r===2||r===3?C.aqua:r>=4?C.sand:C.white;
 cell.text.style={fontFamily:FONT,typeface:FONT,fontSize:r===0?18:c===1||c===2?24:22,color:r===0?C.white:r===3?C.teal:C.ink,bold:r===0||r===3,alignment:c===1||c===2?'center':'left',verticalAlignment:'center'};
 table.cells.block({row:r,column:c,rowCount:1,columnCount:1}).assign({margins:{left:22,right:18,top:12,bottom:10},anchor:'center'});
 }}
// The parallel SVG is a text-editable export of the same native table values.
let yy=230;const widths=[435,310,330,701];
for(let r=0;r<6;r++){let xx=72;for(let c=0;c<4;c++){svg.push(`<rect x="${xx}" y="${yy}" width="${widths[c]}" height="${heights[r]}" fill="${r===0?C.ink:r===2||r===3?C.aqua:r>=4?C.sand:C.white}"/>`);const t=([['STAGE','BEFORE GEN-AI','AI MECHANISMS','WHAT CHANGES'],...rows])[r][c],sz=r===0?18:c===1||c===2?24:22,ls=t.split('\n'),base=yy+(heights[r]-ls.length*sz*1.25)/2+sz;svg.push(`<text x="${c===1||c===2?xx+widths[c]/2:xx+22}" y="${base}" font-family="Arial,Helvetica,sans-serif" font-size="${sz}" font-weight="${r===0||r===3?700:400}" fill="${r===0?C.white:r===3?C.teal:C.ink}" text-anchor="${c===1||c===2?'middle':'start'}">${ls.map((l,i)=>`<tspan x="${c===1||c===2?xx+widths[c]/2:xx+22}" dy="${i?sz*1.25:0}">${esc(l)}</tspan>`).join('')}</text>`);xx+=widths[c];}yy+=heights[r];svg.push(`<line x1="72" y1="${yy}" x2="1848" y2="${yy}" stroke="${C.line}"/>`);}
rect(72,877,1776,98,C.ink,undefined,10);await pic('icons/flask-conical.svg',95,899,52,52,'#ACD4F1');text(171,899,1645,56,'Tool demand depends on funded programs, assay depth, net inputs and prices.',28,C.white,true);
text(72,1008,1776,44,'Sources: Lyu 2019; Sumitomo 2021; BIO 2011–2020; Wong 2000–2015. Workloads are analyst sensitivities, not empirical cohorts.',17,C.muted);
S.speakerNotes.text='Reviewed 13 October 2026. Workflow units differ by modality; no synthetic per-clinical-entrant molecule counts are used. Historical Phase I-to-approval estimates are separate cohorts and methods. Measurement-workload sensitivities are inputs, not candidate-count forecasts.\n\n'+await fs.readFile(OUT+'/SOURCES.md','utf8');
await end('11_editable_stage_comparison');
const ecos=INPUT.ecosystem;
const supplierRows=[
 {cn:['GenScript · 1548.HK','Vazyme · 688105.SH','Tsingke · NEEQ:874813'],us:['Twist · TWST','Thermo Fisher · TMO']},
 {cn:['ACRO · 301080.SZ','Sino · 301047.SZ'],us:['Bio-Techne · TECH','Thermo Fisher · TMO']},
 {cn:['OPM · 688293.SH','ACRO · 301080.SZ'],us:['Gibco / Thermo · TMO','Cytiva / HyClone · DHR']},
 {cn:['JET Biofil · 688026.SH','Changhong · 300151.SZ'],us:['Corning · GLW','BD · BDX']},
 {cn:['MGI · 688114.SH','NanoMicro · 688690.SH'],us:['Illumina · ILMN','Agilent · A','Waters · WAT†']},
 {cn:['NanoMicro · 688690.SH','Sepax · 688758.SH'],us:['Cytiva · DHR','Repligen · RGEN']}
];
SCALE=.8;start();svg.push('<g transform="scale(0.8)">');
rect(100,60,10,105,C.ink);
text(141,57,2159,78,'AI selection and biological evidence shape tool demand',56,C.ink,true);
text(141,137,2159,42,'Workflows vary by modality; paid demand depends on funded assays, depth, net inputs and prices.',29,C.muted);
line(100,229,2300,229,C.line,1);
text(100,276,680,39,'MODALITY-AWARE DISCOVERY WORKFLOW',28,C.ink,true);
text(100,323,680,35,'Schematic widths; workload multipliers are sensitivities',22,C.muted);
const bands=[
 {y:390,h:142,w1:680,w2:510,fill:'#ACD4F1',stroke:C.ink,label:'Virtual search / design',n:'Quality + selection',size:28,col:C.ink},
 {y:548,h:128,w1:510,w2:385,fill:'#7399C6',stroke:C.ink,label:'Physical samples',n:'Modality-dependent',size:26,col:C.ink},
 {y:692,h:132,w1:385,w2:270,fill:C.ink,stroke:C.ink,label:'Assay workload',n:'1× / 2× / 5× / 10×',size:24,col:C.white},
 {y:840,h:107,w1:270,w2:200,fill:C.white,stroke:'#F67F26',label:'Clinical entry',n:'Funded programs',size:20,col:C.ink},
 {y:963,h:107,w1:200,w2:157,fill:C.white,stroke:'#BE3232',label:'Approval gains',n:'Unproven',size:25,col:C.ink}
];const cx=440;
for(const b of bands){poly([[cx-b.w1/2,b.y],[cx+b.w1/2,b.y],[cx+b.w2/2,b.y+b.h],[cx-b.w2/2,b.y+b.h]],b.fill,b.stroke,2.2);text(cx-b.w1/2,b.y+21,b.w1,38,b.label,b.w1<290?23:29,b.col,true,'center');text(cx-b.w1/2,b.y+68,b.w1,54,b.n,b.size||28,b.col,true,'center');}
line(727,548,772,548,C.ink,3);line(772,548,772,824,C.ink,3);line(772,824,727,824,C.ink,3);
poly([[782,559],[882,335],[882,1181],[782,813]],'#EEF6FC');line(772,559,882,335,'#7399C6',1.5);line(772,813,882,1181,'#7399C6',1.5);
rect(100,1095,325,117,'#ACD4F1','none',9);rect(443,1095,337,117,'#EEF6FC',C.line,9);
text(116,1112,295,29,'SMALL MOLECULES',20,C.ink,true);text(116,1150,295,51,'Fewer syntheses per\nprogram are possible.',19,C.ink);
text(459,1112,305,29,'PROTEINS / ANTIBODIES',18.5,C.ink,true);text(459,1150,305,51,'Pooled screens scale;\nindividual profiling differs.',19,C.ink);
text(100,1230,680,92,'WET LAB = BUILD + TEST\nNo universal molecule-count funnel.\nAI clinical advantage remains unproven.',21,C.muted);

rect(885,255,1415,949,'#F4F9FD',C.line,15);text(917,276,1350,52,'The LST ecosystem behind the capacity gate',36,C.ink,true);
text(917,330,1350,31,'Issuer-cited subset estimates · different scopes / years · source conflicts disclosed below',20,C.muted);
const xs=[917,1380,1843],ys=[373,790],cw=425,ch=393;
for(let i=0;i<ecos.length;i++){
 const d=ecos[i],r=supplierRows[i],x=xs[i%3],y=ys[Math.floor(i/3)];
 rect(x,y,cw,ch,C.white,d.focus?C.ink:C.line,10,d.focus?2:1);
 await pic('icons/'+d.icon+'.svg',x+18,y+19,38,38,true);
 text(x+74,y+23,cw-91,43,d.title,26,C.ink,true);
 text(x+20,y+72,cw-40,60,d.products,21,C.muted);
 text(x+20,y+135,cw-40,47,d.metric,d.metric==='Source pending'?31:37,C.ink,true);
 text(x+20,y+185,cw-40,29,d.scope,17.5,C.muted);
 text(x+20,y+214,cw-40,27,d.note,16.5,C.muted);
 if(i===0){await pic('logos/twist-trim.png',x+20,y+247,127,40);await pic('logos/genscript-trim.png',x+169,y+247,150,40);}
 if(i===1)await pic('logos/acro-trim.png',x+20,y+245,159,44);
 if(i===2){text(x+20,y+255,180,36,'Gibco / HyClone',25,C.ink,true);}
 if(i===3){await pic('logos/jet-english.png',x+20,y+244,143,44);await pic('logos/bd-original.svg',x+233,y+244,105,44);}
 if(i===4){await pic('logos/mgi-trim.png',x+20,y+249,101,37);text(x+164,y+258,235,33,'BD flow → WAT†',23,C.ink,true);}
 if(i===5){await pic('logos/nanomicro-emblem.svg',x+20,y+249,37,37);text(x+66,y+256,158,32,'NanoMicro',24,C.ink,true);await pic('logos/cytiva-trim.png',x+244,y+251,149,38);}
 text(x+20,y+298,201,23,'CHINA / HK LISTINGS',14.5,C.ink,true);
 text(x+235,y+298,174,23,'US LISTINGS / PARENTS',14,C.ink,true);
 text(x+20,y+327,208,62,r.cn.join('\n'),17,C.ink);
 text(x+235,y+327,174,62,r.us.join('\n'),16.2,C.ink);
}
rect(885,1220,1415,57,C.ink,'none',9);await pic('icons/bot.svg',901,1231,34,34,'#ACD4F1');
text(949,1237,957,32,'Automation + data orchestration span every tool family',25,C.white,true);
rect(1950,1228,319,41,C.white,'none',6);await pic('logos/tecan-trim.png',1963,1235,150,26);text(2134,1239,122,25,'SIX: TECN',19,C.ink,true);
text(885,1293,1415,22,'† Ex-BD biosciences / flow moved to Waters on 9 Feb 2026; BD (BDX) here means specimen collection.',16.5,C.ink);
text(885,1320,1415,23,'Protein TAM is issuer-commissioned / disputed. Media & resin TAMs withheld. Sources, scope and tickers: SOURCES.md.',15.5,C.muted);
S.speakerNotes.text='Figure 12. Updated 13 October 2026. Universal stage counts removed. Workload multiples are analyst sensitivities. Supplier listing groups retain their scope. Recombinant protein estimate is commissioned/disputed; media/resin headlines withheld pending original-file verification. The six product families are broader than the displayed anchors; the values must not be added. Company rows group listing venues, not incorporation or headquarters. GenScript is HK-listed; Gibco maps to Thermo Fisher TMO and Cytiva/HyClone to Danaher DHR. BD BDX is shown for specimen collection/preanalytics; its former Biosciences and Diagnostic Solutions business, including flow cytometry, moved to Waters WAT on 9 February 2026. These are different current equity exposures. Tsingke NEEQ:874813 is not an A-share exchange listing. Brand logos remain original; chart colors use the user-supplied eight-color palette.\n\n'+await fs.readFile(OUT+'/SOURCES.md','utf8')+'\n\n'+await fs.readFile(OUT+'/TICKER_SOURCES.md','utf8');
await end('12_ai_funnel_lst_ecosystem');
const candidate=TMP+'/candidate.pptx';await(await PresentationFile.exportPptx(P)).save(candidate);
const final=OUT+'/editable/AI_LST_funnel_review_rebuilt.pptx';
const result=await finalizePresentation({workspaceDir:cwd,candidatePath:candidate,finalPath:final,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-heading-fit','--require-native-table-slide','1'],requiredNativeTableOwnerSlides:[1],requiredNativeChartOwnerSlides:[],explicitTotalSlideCount:2,fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:TMP+'/validation_'+Date.now()+'.json'});
console.log(JSON.stringify({pptx:final,slides:2,validation:result}));
