import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const ROOT=process.cwd(),WEB=path.resolve('sites/ai-life-science-tools/dist');
const SKILL=process.env.PRESENTATIONS_SKILL_DIR;
const WORK=path.resolve('work/flat-workflow-20261015'),OUT=path.resolve('outputs/flat-workflow-20261015');
const {resolvePresentationFont,finalizePresentation}=await import(pathToFileURL(SKILL+'/container_tools/artifact_tool_utils.mjs').href);
const FONT=resolvePresentationFont({fontFamily:'Arial'}),W=2400,H=1350,k=.8;
const p=Presentation.create({slideSize:{width:W*k,height:H*k}}),s=p.slides.add();s.background.fill='#FFFFFF';
const C={ink:'#00355F',blue:'#7399C6',pale:'#ACD4F1',gray:'#A5A5A5',soft:'#F0F7FC',green:'#078549',lime:'#8BC346',orange:'#F67F26',red:'#BE3232',white:'#FFFFFF'};
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const svg=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Typical protein / antibody screening workflow"><title>Typical protein / antibody screening workflow</title><desc>Six flat, editable experimental scenes: DNA construction, expression and purification, binding screening, characterization, cell function and model feedback.</desc><rect width="${W}" height="${H}" fill="#FFFFFF"/>`];
function box(x,y,w,h,fill=C.white,stroke=C.ink,lw=2,r=0){s.shapes.add({geometry:r?'roundRect':'rect',name:'Flat experiment component',position:{left:x*k,top:y*k,width:w*k,height:h*k},fill,line:{fill:stroke,width:lw*k},...(r?{borderRadius:r*k}:{})});svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);}
function text(x,y,w,h,value,size=24,color=C.ink,bold=false,align='left'){
 const q=s.shapes.add({geometry:'textbox',name:value.split('\n')[0],position:{left:x*k,top:y*k,width:w*k,height:h*k},fill:'none',line:{fill:'none',width:0}});q.text=value;q.text.style={fontFamily:FONT,typeface:FONT,fontSize:size*k,color,bold,alignment:align,verticalAlignment:'top',wrap:'none',insets:0,lineSpacing:1};
 const anchor=align==='center'?'middle':align==='right'?'end':'start',tx=align==='center'?x+w/2:align==='right'?x+w:x;
 svg.push(`<text x="${tx}" y="${y+size*.9}" font-family="Arial,Arial Unicode MS,sans-serif" font-size="${size}" font-weight="${bold?600:400}" fill="${color}" text-anchor="${anchor}">${value.split('\n').map((line,i)=>`<tspan x="${tx}" dy="${i?size*1.22:0}">${esc(line)}</tspan>`).join('')}</text>`);
}
function poly(points,fill='none',stroke=C.ink,lw=2,closed=false){const x=Math.min(...points.map(v=>v[0])),y=Math.min(...points.map(v=>v[1])),w=Math.max(.1,Math.max(...points.map(v=>v[0]))-x),h=Math.max(.1,Math.max(...points.map(v=>v[1]))-y);s.shapes.add({geometry:'custom',name:'Diagram path',position:{left:x*k,top:y*k,width:w*k,height:h*k},fill,line:{fill:stroke,width:lw*k},customPaths:[{width:w*k,height:h*k,commands:[...points.map((v,i)=>({[i?'lineTo':'moveTo']:{x:(v[0]-x)*k,y:(v[1]-y)*k}})),...(closed?[{close:{}}]:[])]}]});svg.push(`<${closed?'polygon':'polyline'} points="${points.map(v=>v.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"/>`);}
function line(points,color=C.ink,lw=2){poly(points,'none',color,lw);}
function oval(x,y,w,h,fill=C.white,stroke=C.ink,lw=2){s.shapes.add({geometry:'ellipse',position:{left:x*k,top:y*k,width:w*k,height:h*k},fill,line:{fill:stroke,width:lw*k}});svg.push(`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" stroke="${stroke}" stroke-width="${lw}"/>`);}
function circle(x,y,r,fill=C.pale,stroke=C.ink,lw=2){oval(x-r,y-r,2*r,2*r,fill,stroke,lw);}
function arrow(x,y,x2,y2,color=C.blue,lw=2.5){line([[x,y],[x2,y2]],color,lw);const a=Math.atan2(y2-y,x2-x),r=9;poly([[x2,y2],[x2-r*Math.cos(a-.55),y2-r*Math.sin(a-.55)],[x2-r*Math.cos(a+.55),y2-r*Math.sin(a+.55)]],color,'none',0,true);}
function curve(points,color=C.blue,lw=3){line(points,color,lw);}
async function image(file,x,y,w,h,alt){const b=await fs.readFile(file),type=file.endsWith('.svg')?'image/svg+xml':'image/png';s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:type,alt,position:{left:x*k,top:y*k,width:w*k,height:h*k},fit:'contain'});svg.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:${type};base64,${b.toString('base64')}" preserveAspectRatio="xMidYMid meet"/>`);}
// These are editable scientific schematics, deliberately flat rather than literal product renders.
function plate(x,y,w=150,h=77,cols=8,rows=4){box(x,y,w,h,C.pale,C.ink,2,7);for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)circle(x+13+i*(w-26)/(cols-1),y+12+j*(h-24)/(rows-1),4.4,(i+j)%5===0?C.blue:C.white,C.blue,1);}
function tube(x,y,h=53,fill=C.pale){box(x,y,23,9,C.blue,C.ink,1.8,2);poly([[x+3,y+9],[x+20,y+9],[x+20,y+h-13],[x+12,y+h],[x+3,y+h-13]],C.white,C.ink,2,true);poly([[x+5,y+h*.52],[x+18,y+h*.52],[x+18,y+h-14],[x+12,y+h-4],[x+5,y+h-14]],fill,'none',0,true);}
function pipette(x,y,z=1){const pts=a=>a.map(([a,b])=>[x+a*z,y+b*z]);poly(pts([[0,0],[21,10],[-39,122],[-49,116]]),C.white,C.ink,2,true);poly(pts([[-39,122],[-49,116],[-60,145]]),C.pale,C.ink,2,true);box(x-z,y-12*z,22*z,15*z,C.blue,C.ink,1.5,2);poly(pts([[-62,153],[-68,166],[-64,172],[-57,168]]),C.blue,'none',0,true);}
function pcr(x,y,w=125,h=109){box(x,y,w,h,C.white,C.ink,2.5,9);box(x+10,y+10,w-20,37,C.pale,C.ink,1.7,4);line([[x+19,y+22],[x+w-19,y+22]],C.blue,2);box(x+16,y+60,52,26,C.ink,'none',0,3);text(x+19,y+64,46,20,'PCR',16,C.white,true,'center');circle(x+w-26,y+72,8,C.pale);line([[x+10,y+h-12],[x+w-10,y+h-12]],C.blue,2);}
function flask(x,y,w=91,h=127){poly([[x+w*.36,y],[x+w*.65,y],[x+w*.65,y+h*.28],[x+w*.96,y+h*.88],[x+w*.9,y+h],[x+w*.1,y+h],[x+w*.04,y+h*.88],[x+w*.36,y+h*.28]],C.white,C.ink,2.5,true);poly([[x+w*.25,y+h*.63],[x+w*.76,y+h*.63],[x+w*.92,y+h*.9],[x+w*.88,y+h*.96],[x+w*.12,y+h*.96],[x+w*.08,y+h*.9]],C.pale,'none',0,true);box(x+w*.31,y-8,w*.4,12,C.blue,C.ink,2,2);for(const [dx,dy] of [[.34,.78],[.61,.83],[.47,.89],[.68,.72]])circle(x+w*dx,y+h*dy,4,C.blue,'none',0);}
function bottle(x,y,w=58,h=104){box(x+13,y,w-26,12,C.blue,C.ink,2,2);box(x+7,y+12,w-14,14,C.white,C.ink,2);box(x,y+25,w,h-25,C.white,C.ink,2,5);box(x+4,y+51,w-8,h-55,C.pale,'none',0,2);box(x+8,y+45,w-16,25,C.white,C.blue,1,2);text(x+9,y+50,w-18,18,'MEDIA',10,C.ink,true,'center');}
function column(x,y,w=42,h=130){box(x+8,y-11,w-16,14,C.blue,C.ink,2,2);box(x,y,w,h,C.white,C.ink,2.5,3);box(x+4,y+34,w-8,h-47,C.pale,'none',0);for(let j=0;j<7;j++)for(let i=0;i<3;i++)circle(x+9+i*(w-18)/2,y+43+j*(h-58)/6,2.6,C.blue,'none',0);box(x+9,y+h,w-18,10,C.blue,C.ink,1.5,2);line([[x+w/2,y+h+10],[x+w/2,y+h+28]],C.ink,2);}
function massspec(x,y,w=130,h=105){box(x,y,w,h,C.white,C.ink,2.5,6);box(x+8,y+10,w*.35,h-20,C.soft,C.blue,1.5,3);for(let i=0;i<4;i++)line([[x+14,y+23+i*13],[x+w*.35,y+23+i*13]],C.blue,1.5);box(x+w*.48,y+14,w*.42,37,C.ink,'none',0,3);text(x+w*.49,y+22,w*.4,23,'MS',19,C.white,true,'center');circle(x+w*.68,y+75,13,C.pale,C.ink,1.5);circle(x+w*.87,y+75,4,C.green,'none',0);}
function antibody(x,y,scale=1){line([[x,y+60*scale],[x,y+28*scale],[x-25*scale,y],[x-35*scale,y+9*scale]],C.ink,5*scale);line([[x,y+28*scale],[x+25*scale,y],[x+35*scale,y+9*scale]],C.ink,5*scale);}
function protein(x,y,r=20){for(const [dx,dy,rr] of [[-12,0,.7],[0,-8,.85],[12,4,.7],[0,12,.65]])circle(x+dx*r/20,y+dy*r/20,r*rr,C.green,'none',0);}
function curveAxes(x,y,w,h,type='binding'){line([[x,y],[x,y+h],[x+w,y+h]],C.blue,1.5);const points=type==='melt'?[[0,.92],[.15,.92],[.3,.88],[.4,.72],[.48,.38],[.6,.1],[.76,.05],[1,.05]]:type==='peak'?[[0,.96],[.2,.94],[.3,.88],[.37,.5],[.44,.1],[.51,.58],[.6,.94],[1,.96]]:[[0,.94],[.12,.64],[.25,.35],[.4,.21],[.6,.17],[.7,.31],[.84,.46],[1,.58]];curve(points.map(([a,b])=>[x+a*w,y+b*h]),C.ink,2.5);}
function dish(x,y,w=125,h=56){box(x,y+10,w,h-17,C.pale,C.ink,2.3,5);oval(x,y,w,27,C.soft,C.ink,2);oval(x,y+h-23,w,25,C.pale,C.ink,2);for(const [a,b] of [[.2,.48],[.39,.63],[.61,.48],[.79,.62]]){oval(x+a*w-7,y+b*h-4,15,9,C.blue,C.ink,1);}}
function reader(x,y,w=150,h=100,label='BLI'){box(x,y,w,h,C.white,C.ink,2.5,7);box(x+10,y+14,w-20,29,C.pale,C.ink,1.5,3);text(x+12,y+19,w-24,22,label,16,C.ink,true,'center');box(x+15,y+57,w-30,27,C.ink,'none',0,3);line([[x+26,y+67],[x+w-26,y+67]],C.pale,2);circle(x+w-17,y+h-10,3,C.green,'none',0);}
function microscope(x,y){box(x+5,y+100,115,14,C.blue,C.ink,2,4);line([[x+63,y+100],[x+30,y+70],[x+45,y+36]],C.ink,12);poly([[x+48,y+20],[x+74,y+31],[x+51,y+70],[x+28,y+59]],C.pale,C.ink,2.5,true);box(x+19,y+72,73,8,C.white,C.ink,2);line([[x+68,y+30],[x+89,y+1]],C.ink,13);box(x+80,y-2,25,12,C.blue,C.ink,1.5);circle(x+40,y+72,8,C.green,'none',0);}
function database(x,y,w=72,h=96){box(x,y+12,w,h-25,C.pale,C.ink,2);oval(x,y,w,25,C.soft,C.ink,2);oval(x,y+h-25,w,25,C.pale,C.ink,2);for(const dy of [35,60])line([[x+2,y+dy],[x+16,y+dy+5],[x+w-16,y+dy+5],[x+w-2,y+dy]],C.blue,1.5);}
function laptop(x,y,w=190,h=120){box(x+12,y,w-24,h-20,C.white,C.ink,2.5,6);box(x+23,y+12,w-46,h-45,C.soft,C.blue,1.5,2);poly([[x+12,y+h-20],[x+w-12,y+h-20],[x+w,y+h],[x,y+h]],C.pale,C.ink,2,true);line([[x+w*.38,y+h-7],[x+w*.62,y+h-7]],C.ink,2);}
const stages=[
 {id:1,title:'Construct design /\nDNA synthesis',objective:'Make DNA constructs\nfor the selected candidates',output:'Sequence-verified DNA',sup:[['DNA + enzymes','Twist · GenScript · Vazyme'],['Liquid handling / PCR','Tecan · Hamilton · Thermo Fisher']]},
 {id:2,title:'Protein expression\n& purification',objective:'Express the protein, purify it\nand check sample quality',output:'Purified protein + yield',sup:[['Expression / media','GenScript · Gibco'],['Separation / QC','Cytiva · NanoMicro · Waters']]},
 {id:3,title:'Primary binding\nscreen',objective:'Identify binders against\nthe chosen target protein',output:'Binding hits',sup:[['Target reagents','ACROBiosystems · Sino Biological'],['Binding platforms / labware','Sartorius · Cytiva · JET Biofil']]},
 {id:4,title:'Multi-property\ncharacterization',objective:'Measure binding, stability\nand developability risks',output:'Linked multi-property labels',sup:[['Separation / analytics','Waters · Agilent · NanoMicro'],['Stability / binding','NanoTemper · Sartorius']]},
 {id:5,title:'Cell-function\nvalidation',objective:'Test biological activity\nin a relevant cell model',output:'Cell potency',sup:[['Cell inputs / labware','Gibco · Bio-Techne · Corning'],['Flow / imaging','Waters Biosciences* · Mol. Devices']]},
 {id:6,title:'Data integration\n& feedback',objective:'Link samples and results\nto the next model-guided design',output:'Traceable training data',sup:[['Automation','Tecan · Hamilton'],['ELN / LIMS / data','Benchling · Genedata']]}
];
box(100,60,10,105,C.ink,'none',0);text(141,59,2159,76,'Typical protein / antibody screening workflow',56,C.ink,true);
text(141,140,2159,43,'Flat experimental schematics: the tools, inputs and suppliers behind each step',29);
line([[100,210],[2300,210]],C.gray,1);
text(100,238,720,35,'BUILD · Make physical samples',26,C.ink,true);text(840,238,1090,35,'TEST · Generate biological evidence',26,C.ink,true);text(1950,238,350,35,'LEARN · Iterate',26,C.ink,true);
for(const a of stages){const x=100+(a.id-1)*370;
 svg.push(`<g data-stage="${a.id}" role="button" tabindex="0" aria-label="${esc(a.title.replace('\n',' '))}">`);
 box(x,286,350,850,C.white,a.id===4||a.id===5?C.blue:C.gray,1.5,13);box(x,286,350,9,a.id<=2?C.ink:a.id<=5?C.blue:C.ink,'none',0);
 text(x+22,313,306,30,`${String(a.id).padStart(2,'0')} / ${a.id<=2?'BUILD':a.id<=5?'TEST':'LEARN'}`,19,C.ink,true);
 text(x+22,354,306,76,a.title,30,C.ink,true);text(x+22,437,306,57,a.objective,21);
 box(x+14,515,322,352,C.soft,'none',0,10);
 if(a.id===1){
  // A robot dispenses into a flat multiwell plate, next to a PCR thermocycler.
  box(x+33,594,43,48,C.pale,C.ink,2,4);box(x+23,638,63,13,C.blue,C.ink,2,3);
  line([[x+54,595],[x+88,554],[x+139,583],[x+142,633]],C.ink,14);line([[x+54,595],[x+88,554],[x+139,583],[x+142,633]],C.pale,8);for(const [dx,dy] of [[54,595],[88,554],[139,583]])circle(x+dx,dy,8,C.blue,C.ink,2);
  box(x+133,626,18,24,C.white,C.ink,2);line([[x+142,650],[x+142,666]],C.ink,2.5);circle(x+142,676,4,C.blue,'none',0);
  plate(x+32,693,146,78);pcr(x+202,661,122,110);tube(x+219,554,55);tube(x+254,554,55,C.green);tube(x+289,554,55);
  text(x+186,619,145,25,'DNA + enzymes',18,C.ink,true,'center');text(x+20,795,171,25,'Liquid handling',18,C.ink,true,'center');text(x+198,795,130,25,'PCR',18,C.ink,true,'center');
 }else if(a.id===2){
  flask(x+37,545,86,119);bottle(x+185,554,56,103);arrow(x+171,608,x+133,608);protein(x+285,609,15);
  text(x+23,677,295,26,'Expression · cells + media',18,C.ink,true,'center');
  column(x+54,720,35,99);massspec(x+186,731,125,95);arrow(x+102,777,x+168,777);tube(x+115,790,40);
  text(x+24,838,124,23,'Chromatography',16,C.ink,true,'center');text(x+174,838,143,23,'LC-MS / QC',17,C.ink,true,'center');
 }else if(a.id===3){
  antibody(x+91,555,.8);protein(x+167,586,17);text(x+26,632,224,23,'Antibody + target',18,C.ink,true,'center');
  arrow(x+220,588,x+267,629);plate(x+206,650,110,63,6,3);reader(x+35,705,143,108,'BLI');
  line([[x+92,694],[x+92,672],[x+132,672]],C.blue,2);tube(x+114,651,32);text(x+199,727,123,23,'Assay plate',17,C.ink,true,'center');curveAxes(x+217,767,94,65);
  text(x+22,839,165,24,'Binding platform',17,C.ink,true,'center');text(x+204,840,116,24,'Binding signal',16,C.ink,true,'center');
 }else if(a.id===4){
  column(x+34,553,29,90);massspec(x+109,555,109,88);arrow(x+73,595,x+98,595);curveAxes(x+247,563,65,70,'peak');text(x+24,665,297,25,'SEC / LC-MS · separation + QC',17,C.ink,true,'center');
  tube(x+47,725,70);circle(x+81,753,5,C.orange,'none',0);line([[x+81,733],[x+81,775]],C.orange,3);circle(x+81,781,8,C.orange,C.ink,1.5);
  curveAxes(x+105,727,76,64,'melt');curveAxes(x+229,727,80,64);text(x+22,824,176,24,'Thermal stability',17,C.ink,true,'center');text(x+203,824,125,43,'Binding\nkinetics',17,C.ink,true,'center');
 }else if(a.id===5){
  dish(x+27,599,125,56);bottle(x+249,555,52,95);pipette(x+190,530,.68);text(x+22,676,306,25,'Cell model + media + dosing',18,C.ink,true,'center');
  // Flow channel / dot plot and an imaging microscope are distinct readout choices.
  box(x+29,716,132,96,C.white,C.ink,2,6);box(x+38,725,50,77,C.soft,C.blue,1,2);for(let j=0;j<4;j++)circle(x+63,734+j*18,4,C.blue,'none',0);line([[x+39,762],[x+85,762]],C.orange,2);box(x+98,729,54,54,C.pale,C.ink,1.5,2);for(let j=0;j<10;j++)circle(x+106+(j*17)%37,739+(j*13)%33,1.6,C.ink,'none',0);
  microscope(x+199,708);text(x+18,836,153,23,'Flow cytometry',17,C.ink,true,'center');text(x+190,836,135,23,'Cell imaging',17,C.ink,true,'center');
 }else{
  plate(x+29,555,101,61,5,3);database(x+236,538,63,84);arrow(x+141,582,x+223,582);
  text(x+22,638,305,25,'Sample IDs + assay results',18,C.ink,true,'center');
  laptop(x+39,698,172,116);
  const nodes=[[x+83,729],[x+83,765],[x+130,719],[x+130,750],[x+130,778],[x+174,748]];for(let i=0;i<2;i++)for(let j=2;j<5;j++)line([nodes[i],nodes[j]],C.blue,1.5);for(let i=2;i<5;i++)line([nodes[i],nodes[5]],C.blue,1.5);for(const [a,b] of nodes)circle(a,b,5,C.ink,'none',0);
  arrow(x+219,754,x+247,754);text(x+252,716,70,50,'Next\nDNA',20,C.ink,true,'center');tube(x+272,779,45);
  text(x+26,836,191,23,'Model-guided design',17,C.ink,true,'center');
 }
 box(x+20,887,310,49,C.pale,'none',0,5);text(x+29,900,292,26,a.output,20,C.ink,true,'center');
 line([[x+22,956],[x+328,956]],C.gray,1);text(x+22,976,306,25,'REPRESENTATIVE SUPPLIERS',15,C.ink,true);
 for(let j=0;j<a.sup.length;j++){const y=1011+j*55;text(x+22,y,306,23,a.sup[j][0],15,C.blue,true);text(x+22,y+22,306,28,a.sup[j][1],17,C.ink);}
 svg.push('</g>');
 if(a.id<6)arrow(x+352,668,x+367,668,C.ink,2);
}
line([[2125,1145],[2125,1168],[277,1168],[277,1145]],C.blue,2);poly([[277,1141],[271,1151],[283,1151]],C.blue,'none',0,true);box(836,1147,718,40,C.white,'none',0);text(846,1152,698,28,'Linked results → next design → next experiment',23,C.ink,true,'center');
box(100,1205,2200,59,C.ink,'none',0,8);text(128,1217,2144,37,'Automation + data orchestration span every step',31,C.white,true,'center');
text(100,1284,2200,25,'Representative experiments, not a fixed protocol. Assays may run in parallel. LC-MS is shown for analytical QC.',20);
text(100,1316,2200,22,'*Waters Biosciences is the former BD Biosciences portfolio. Flat schematics and text are editable; supplier examples and sources: workflow/SOURCES.md.',17);
s.speakerNotes.text=await fs.readFile(WEB+'/research/workflow/SOURCES.md','utf8');svg.push('</svg>');
await fs.writeFile(OUT+'/15_flat_protein_antibody_workflow.svg',svg.join('\n'));
await fs.writeFile(WORK+'/stages.json',JSON.stringify(stages,null,2));
const png=await p.export({slide:s,format:'png',scale:1.25});await fs.writeFile(WORK+'/native-preview.png',new Uint8Array(await png.arrayBuffer()));
const candidate=WORK+'/single-candidate.pptx';await(await PresentationFile.exportPptx(p)).save(candidate);
const final=OUT+'/Protein_antibody_flat_workflow.pptx';
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath:candidate,finalPath:final,pythonExecutable:process.env.RUNTIME_PYTHON,integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-heading-fit'],explicitTotalSlideCount:1,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:WORK+'/'+path.basename(final)+'.validation.json'});
console.log(JSON.stringify({file:final,slides:1,status:result.packageIntegrity.status}));
