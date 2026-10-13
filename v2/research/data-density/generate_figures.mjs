import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const OUT=path.dirname(fileURLToPath(import.meta.url));
const ROOT=process.env.LST_WORKSPACE_ROOT||process.cwd(),BUILD=path.join(OUT,'.build');
const SKILL=process.env.PRESENTATIONS_SKILL_DIR;
if(!SKILL)throw Error('Set PRESENTATIONS_SKILL_DIR to the installed Presentations skill directory.');
const {resolvePresentationFont,finalizePresentation}=await import(pathToFileURL(SKILL+'/container_tools/artifact_tool_utils.mjs').href);
const FONT=resolvePresentationFont({fontFamily:'Arial'});
const P=Presentation.create({slideSize:{width:1920,height:1080}});
const C={ink:'#00355F',muted:'#00355F',teal:'#00355F',aqua:'#EEF6FC',mint:'#ACD4F1',blue:'#00355F',pale:'#EEF6FC',gold:'#F67F26',sand:'#FFFFFF',line:'#A5A5A5',white:'#FFFFFF',grey:'#F4F9FD'};
await fs.mkdir(OUT+'/editable',{recursive:true});await fs.mkdir(OUT+'/svg',{recursive:true});await fs.mkdir(OUT+'/png',{recursive:true});await fs.mkdir(BUILD+'/rendered',{recursive:true});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let S,V;
function start(){S=P.slides.add();S.background.fill=C.white;V=['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1920 1080" width="1920" height="1080"><rect width="1920" height="1080" fill="white"/>'];}
function rect(x,y,w,h,fill=C.white,stroke=C.line,r=12,lw=1){S.shapes.add({geometry:r?'roundRect':'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:lw},borderRadius:r});V.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);}
function text(x,y,w,h,value,size=24,color=C.ink,bold=false,align='left'){
 const shape=S.shapes.add({geometry:'textbox',name:value.split('\n')[0],position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 shape.text=value;shape.text.style={fontFamily:FONT,typeface:FONT,fontSize:size,color,bold,alignment:align,verticalAlignment:'top',wrap:'none',insets:0,lineSpacing:1};
 const anchor=align==='center'?'middle':align==='right'?'end':'start',tx=align==='center'?x+w/2:align==='right'?x+w:x;
 V.push(`<text x="${tx}" y="${y+size*.9}" font-family="Arial,Arial Unicode MS,sans-serif" font-size="${size}" font-weight="${bold?600:400}" fill="${color}" text-anchor="${anchor}">${value.split('\n').map((line,index)=>`<tspan x="${tx}" dy="${index?size*1.25:0}">${esc(line)}</tspan>`).join('')}</text>`);
}
function line(x1,y1,x2,y2,color=C.line,lw=1){const x=Math.min(x1,x2),y=Math.min(y1,y2),w=Math.max(Math.abs(x2-x1),.1),h=Math.max(Math.abs(y2-y1),.1);S.shapes.add({geometry:'custom',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:color,width:lw},customPaths:[{width:w,height:h,commands:[{moveTo:{x:x1-x,y:y1-y}},{lineTo:{x:x2-x,y:y2-y}}]}]});V.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${lw}"/>`);}
function poly(points,fill,stroke='none',lw=1){const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1])),w=Math.max(...points.map(p=>p[0]))-x,h=Math.max(...points.map(p=>p[1]))-y;S.shapes.add({geometry:'custom',position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:lw},customPaths:[{width:w,height:h,commands:[{moveTo:{x:points[0][0]-x,y:points[0][1]-y}},...points.slice(1).map(([a,b])=>({lineTo:{x:a-x,y:b-y}})),{close:{}}]}]});V.push(`<polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);}
function arrow(x1,y1,x2,y2,color=C.teal,lw=2){line(x1,y1,x2,y2,color,lw);const theta=Math.atan2(y2-y1,x2-x1),a=10;poly([[x2,y2],[x2-a*Math.cos(theta-.5),y2-a*Math.sin(theta-.5)],[x2-a*Math.cos(theta+.5),y2-a*Math.sin(theta+.5)]],color);}
async function icon(name,x,y,size=35){let content=await fs.readFile(ROOT+'/sites/ai-life-science-tools/dist/research/assets/icons/'+name+'.svg','utf8');content=content.replaceAll('currentColor',C.teal);const bytes=Buffer.from(content);S.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/svg+xml',alt:'Lucide '+name,position:{left:x,top:y,width:size,height:size},fit:'contain'});V.push(`<image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/svg+xml;base64,${bytes.toString('base64')}"/>`);}
function header(chinese,english,subtitle){rect(72,48,9,105,C.teal,'none',0);text(105,45,1735,63,chinese,46,C.ink,true);text(107,108,1735,37,english,27,C.muted);text(107,153,1735,31,subtitle,21,C.muted);line(72,198,1848,198);}
function matrix(x,y,widths,values,fills,headerFill=C.teal){const heights=values.map((_,i)=>i===0?42:33),totalWidth=widths.reduce((a,b)=>a+b,0);const table=S.tables.add({rows:values.length,columns:widths.length,left:x,top:y,width:totalWidth,height:heights.reduce((a,b)=>a+b,0),columnWidths:widths,values});table.styleOptions={headerRow:true,bandedRows:false};table.borders.assign({fill:C.white,width:2});let yy=y;
 for(let r=0;r<values.length;r++){table.rows[r].height=heights[r];let xx=x;for(let c=0;c<widths.length;c++){
  const value=values[r][c],fill=r===0?headerFill:c===0?C.white:fills(r-1,c-1,value),color=r===0?C.white:c===0?C.muted:Number(value)>6000?C.white:C.ink;
  const size=r===0?18:c===0?18:19,cell=table.getCell(r,c);cell.fill=fill;cell.text.style={fontFamily:FONT,typeface:FONT,fontSize:size,color,bold:r===0,alignment:'center',verticalAlignment:'center'};table.cells.block({row:r,column:c,rowCount:1,columnCount:1}).assign({margins:{left:2,right:2,top:3,bottom:3},anchor:'center'});
  V.push(`<rect x="${xx}" y="${yy}" width="${widths[c]}" height="${heights[r]}" fill="${fill}" stroke="white" stroke-width="2"/>`);V.push(`<text x="${xx+widths[c]/2}" y="${yy+(heights[r]+size*.7)/2}" text-anchor="middle" font-family="Arial,Arial Unicode MS,sans-serif" font-size="${size}" font-weight="${r===0?600:400}" fill="${color}">${esc(value)}</text>`);xx+=widths[c];}yy+=heights[r];}
}
async function end(stem,number){V.push('</svg>');await fs.writeFile(OUT+'/svg/'+stem+'.svg',V.join('\n'));const image=await P.export({slide:S,format:'png',scale:1});await fs.writeFile(BUILD+'/rendered/'+number+'.png',new Uint8Array(await image.arrayBuffer()));}
const sources=await fs.readFile(OUT+'/SOURCES.md','utf8');

// Figure 13: all quantities below are supplied scenario illustrations.
start();header('Fewer molecules. Deeper experimental data.','AI may reduce candidate counts while increasing characterization per molecule','From molecule throughput to data density: a potential driver of life science tools demand');
rect(72,223,592,495,C.grey,C.line,14);rect(732,223,1116,495,C.aqua,'#7399C6',14);
text(99,247,535,43,'Existing data: staged screening',29,C.ink,true);text(99,299,535,53,'1,000 × 1 initial label',35,C.blue,true);text(99,347,535,29,'Illustrative early single-task dataset',19,C.muted);
const left=[['Antibody','Binds?'],...['Yes','No','Yes','Yes','No','Yes'].map((value,index)=>[`Ab-00${index+1}`,value])];
matrix(99,392,[220,315],left,()=>C.white,C.ink);
text(99,644,535,31,'Binding first; deeper tests for selected hits',22,C.ink,true);text(99,680,535,29,'Multi-assay characterization already exists',18,C.muted);
arrow(680,488,716,488,C.teal,3);
text(758,247,1060,43,'AI: richer, linked training data',29,C.ink,true);text(758,299,1060,53,'300–1,000 antibodies · Up to 9 label types',35,C.teal,true);text(758,347,1060,29,'Measure selected properties on shared molecules; fill the information gaps',19,C.muted);
const columns=['Antibody','KD','kon','koff','expr','Tm','agg','poly','epi','cell'];
// Synthetic values for visualization only; columns do not share biological units.
const demoValues=[[120,7200,1800,8400,5100,75,3200,9000,430],[8100,640,5400,2200,9500,1600,4100,500,6900],[2600,9200,410,6500,3100,7900,950,4800,8300],[9800,3100,7400,1200,6800,380,5500,1900,9100],[540,4700,8800,3600,2000,6200,10000,710,5700],[6300,1400,3000,9900,4600,8700,180,7600,2400]];
const right=[columns,...demoValues.map((values,r)=>[`Ab-00${r+1}`,...values.map(String)])];
const heatColor=value=>{const t=(Number(value)-1)/9999,stops=[[238,246,252],[172,212,241],[115,153,198],[0,53,95]],scaled=t*3,lo=Math.min(2,Math.floor(scaled)),k=scaled-lo;return '#'+stops[lo].map((a,i)=>Math.round(a+(stops[lo+1][i]-a)*k).toString(16).padStart(2,'0')).join('');};
matrix(758,392,[118,94,94,94,126,84,102,114,104,132],right,(r,c,value)=>heatColor(value));

text(758,644,1060,32,'Learn binding, expression, stability and functional relationships',22,C.ink,true);text(758,682,1060,27,'Synthetic values: 1–10,000. Darker = larger; no biological units or quality ranking.',17,C.muted);

const modes=[{x:72,w:557,title:'Reuse existing data',body:'Normalize formats, conditions and access\nBetter training may need no new experiment',fill:C.white},{x:650,w:557,title:'Stage 0: fill data gaps',body:'Add missing assays and biological diversity\nCreate reusable model-training datasets',fill:C.aqua},{x:1228,w:620,title:'Active learning: measure selectively',body:'Prioritize informative molecules and tests\nLimit coverage of costly measurements',fill:C.white}];
for(const mode of modes){rect(mode.x,753,mode.w,126,mode.fill,C.line,10);text(mode.x+24,768,mode.w-48,37,mode.title,25,C.ink,true);text(mode.x+24,812,mode.w-48,54,mode.body,20,C.muted);}
rect(72,902,1776,125,C.pale,C.line,9);text(96,909,1728,25,'The nine labels: what each property measures',20,C.ink,true);
const definitions=[['KD','Equilibrium binding strength'],['kon','How quickly binding forms'],['koff','How quickly the complex separates'],['expression','Antibody yield from a cell system'],['Tm','Thermal unfolding transition'],['aggregation','Molecules forming larger clusters'],['polyreactivity','Binding to multiple non-targets'],['epitope','The binding site on the target'],['cell potency','Functional activity in living cells']];
for(let i=0;i<definitions.length;i++){const x=96+(i%3)*578,y=941+Math.floor(i/3)*27;rect(x,y,563,24,C.white,'none',4);text(x+10,y+2,111,22,definitions[i][0],14,C.ink,true);text(x+120,y+2,430,22,definitions[i][1],14,C.ink);}

text(72,1033,1776,23,'Illustrative counts. Nine label types are not nine independent assays; richer data need not come at unchanged cost.',17,C.muted);
text(72,1060,1776,20,'Sources: Jain et al., 2017; Arsiwala et al., 2025; van Niekerk et al., 2026. Mechanism illustration; definitions and links in SOURCES.md.',15.5,C.muted);
S.speakerNotes.text='Figure 13. Illustrative dataset organization, not an empirical comparison of pre-AI versus AI industry cohorts. Matrix values are invented integers from 1 to 10,000. Cell color increases monotonically with the displayed number; no actual assay units or drug-quality ranking are implied. KD is often derived from the same fitted sensorgrams as kon/koff in an appropriate 1:1 model. Traditional drug development already included multi-assay characterization. Stage 0 is an analyst framing for biological data production across model training and iteration.\n\n'+sources;
await end('13_ai_antibody_data_density','13');

// Figure 14: workflow-based procurement; no new TAM or revenue forecast.
start();header('Experimental data density and the LST ecosystem','Stage 0: biological data production creates a wet-lab use case','Learning developability requires comparable assay data and an integrated tool workflow');
rect(72,223,587,607,C.grey,C.line,14);text(99,247,533,42,'Stage 0: biological data production',28,C.ink,true);text(99,291,533,29,'Continuous input to training and iteration',20,C.muted);
const groups=[['Binding kinetics','KD / kon / koff','Antibody-target pair and assay conditions'],['Expression & physicochemical properties','expression / Tm / aggregation','Production, stability and aggregation risk'],['Specificity & cell function','polyreactivity / epitope / cell potency','Non-specific binding, epitope and cell activity']];
for(let i=0;i<groups.length;i++){const y=338+i*100;rect(99,y,533,88,i===0?C.pale:C.aqua,'none',8);text(116,y+10,500,25,groups[i][0],19,C.muted);text(116,y+39,500,31,groups[i][1],i===2?20:23,C.ink,true);}
text(99,650,533,50,'Training records: sequence, target, conditions,\nraw curves, replicates, batches and failures',19,C.muted);
rect(99,725,202,53,C.white,C.line,7);rect(400,725,232,53,C.white,C.line,7);text(99,733,202,35,'Train / improve',22,C.ink,true,'center');text(400,733,232,35,'Design / validate',22,C.ink,true,'center');arrow(312,751,389,751);line(516,785,516,808,C.teal,1.5);line(516,808,200,808,C.teal,1.5);arrow(200,808,200,785,C.teal,1.5);rect(252,791,207,34,C.grey,'none',0);text(252,793,207,29,'Assays inform models',18,C.teal,false,'center');
// Magnification bracket and connector preserve the original funnel-slide layout.
line(671,338,700,338,C.teal,2.3);line(700,338,700,626,C.teal,2.3);line(700,626,671,626,C.teal,2.3);poly([[711,349],[750,266],[750,777],[711,613]],'#F4F9FD');line(711,349,750,266,'#7399C6',1.4);line(711,613,750,777,'#7399C6',1.4);
rect(752,223,1096,607,'#F4F9FD',C.line,14);text(778,245,1044,41,'Labels → assays → purchases',28,C.ink,true);text(778,289,1044,27,'Tool revenue needs a bridge from label coverage to workflow volume and unit consumption',18,C.muted);
const tiles=[
 {x:778,y:334,w:508,h:156,icon:'dna',title:'Construction & expression',body:'DNA synthesis, vectors, expression, purification',labels:'Expression labels + samples for other assays',cost:'Count shared sample preparation once'},
 {x:1307,y:334,w:515,h:156,icon:'flask-conical',title:'Protein & functional testing',body:'SPR / BLI, binding curves, epitope binning',labels:'Target proteins, sensors / chips, buffers',cost:'KD / kon / koff can share one kinetic run'},
 {x:778,y:511,w:508,h:156,icon:'test-tubes',title:'Cells & culture systems',body:'Functional cells, media, transfection, expansion',labels:'Cell potency; selected polyreactivity assays',cost:'Record cell model, target level and conditions'},
 {x:1307,y:511,w:515,h:156,icon:'microscope',title:'Measurement & analysis',body:'SEC / HIC, nanoDSF, LC-MS, flow cytometry',labels:'Stability, aggregation, characterization / QC',cost:'Columns are reused; model instrument CAPEX separately'},
 {x:778,y:688,w:1044,h:116,icon:'pipette',title:'Sample handling, labware & automation',body:'Plates, tips, tubes, filtration / beads, liquid handling',labels:'Across all workflows; miniaturization, reuse and scheduling alter net consumption',cost:''}
];
for(const tile of tiles){rect(tile.x,tile.y,tile.w,tile.h,C.white,C.line,9);await icon(tile.icon,tile.x+16,tile.y+16,30);text(tile.x+60,tile.y+15,tile.w-77,34,tile.title,24,C.ink,true);text(tile.x+16,tile.y+57,tile.w-32,30,tile.body,20,C.muted);text(tile.x+16,tile.y+92,tile.w-32,28,tile.labels,18,C.teal);if(tile.cost)text(tile.x+16,tile.y+123,tile.w-32,25,tile.cost,17,C.muted);}
rect(72,855,864,70,C.aqua,C.line,8);rect(957,855,891,70,C.sand,C.line,8);
text(91,863,826,29,'ACROBiosystems: target proteins, functional cells & characterization',23,C.ink,true);text(91,895,826,24,'AIDD-Ready offering exists; paid orders and repeat purchases still need verification',17,C.muted);
text(976,863,853,29,'NanoMicro: analytical separation & lab purification materials',23,C.ink,true);text(976,895,853,24,'Track sample runs, column life and ASP; manufacturing resin demand has a longer lag',17,C.muted);
rect(72,952,1776,67,C.ink,'none',9);text(94,969,1732,37,'LST purchases ≈ Σ [workflow executions × net purchased inputs per run × ASP]',29,C.white,true,'center');
text(72,1030,1776,25,'Instrument CAPEX is separate. Product alignment does not establish AI orders or revenue. Sources: Ginkgo, Sartorius and company websites.',16.5,C.muted);
S.speakerNotes.text='Figure 14. Qualitative workflow and listed-supplier exposure mapping. Stage 0 is an analyst demand framework, not a claim of incremental realized revenue. Antigen-specific affinity, epitope and cell potency require target/condition context; PROPHET-Ab has a different set of ten developability assays. Recurring procurement is modeled by actual workflow executions and net material use; instruments CAPEX and services are separate. Logo artwork is omitted by user preference. Icons are Lucide originals, ISC licensed.\n\n'+sources;
await end('14_stage0_lst_ecosystem','14');

const candidate=BUILD+'/candidate.pptx';await(await PresentationFile.exportPptx(P)).save(candidate);
const final=process.env.DENSITY_PPTX_OUTPUT||OUT+'/editable/AI_antibody_data_density_numeric_review.pptx';
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath:candidate,finalPath:final,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-heading-fit','--require-native-table-slide','1'],requiredNativeTableOwnerSlides:[1],requiredNativeChartOwnerSlides:[],explicitTotalSlideCount:2,fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:BUILD+'/validation-'+Date.now()+'.json'});
console.log(JSON.stringify({pptx:final,font:FONT,slides:2,validation:result}));
