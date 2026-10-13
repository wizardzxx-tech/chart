import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const workspaceDir=process.cwd(),OUT=path.dirname(fileURLToPath(import.meta.url)),WORK=path.join(OUT,'.build');
if(!process.env.RUNTIME_NODE_MODULES)throw Error('Set RUNTIME_NODE_MODULES to the bundled node_modules path.');
const skill=process.env.PRESENTATIONS_SKILL_DIR;
const runtimePython=process.env.RUNTIME_PYTHON;
const {resolvePresentationFont,finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs').href);
const fonts=['Arial Unicode MS','Arial'].map(fontFamily=>resolvePresentationFont({fontFamily}));
const slides=JSON.parse(await fs.readFile(WORK+'/text-metrics.json','utf8'));
const sources=await fs.readFile(OUT+'/SOURCES.md','utf8');
const count=Number(process.argv[2]||16);
const selectedSlides=slides.filter(item=>item.figure<=count);
const presentation=Presentation.create({slideSize:{width:1920,height:1080}});
const hex=color=>color.startsWith('#')?color:'#'+color.match(/\d+/g).slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join('');
await fs.mkdir(WORK+'/text-deck/rendered',{recursive:true});
await fs.mkdir(OUT+'/editable',{recursive:true});
if(!process.argv.includes('--finalize-only')) for(const item of selectedSlides){
  const slide=presentation.slides.add();slide.background.fill='#ffffff';
  const background=await fs.readFile(item.background);
  slide.images.add({blob:background.buffer.slice(background.byteOffset,background.byteOffset+background.byteLength),contentType:'image/png',alt:'Original chart artwork without labels',position:{left:0,top:0,width:1920,height:1080},fit:'contain'});
  for(const [index,label] of item.labels.entries()){
    const lines=label.text.split('\n');
    for(const [row,value] of lines.entries()){
      const lineHeight=label.fontSize*1.25,angle=label.rotation*Math.PI/180;
      const dy=-label.height/2+lineHeight/2+row*label.lineStep;
      const cx=label.left+label.width/2-Math.sin(angle)*dy;
      const cy=label.top+label.height/2+Math.cos(angle)*dy;
      const shape=slide.shapes.add({geometry:'textbox',name:`Figure ${item.figure} label ${index+1} line ${row+1}`,position:{left:cx-label.width/2,top:cy-lineHeight/2-label.fontSize*.42,width:label.width,height:lineHeight,rotation:(label.rotation+360)%360},fill:'none',line:{fill:'none',width:0}});
      shape.text=value;
      shape.text.style={fontFamily:label.fontFamily,typeface:label.fontFamily,fontSize:label.fontSize,color:hex(label.color),bold:label.bold,alignment:label.alignment,verticalAlignment:'top',wrap:'none',insets:0,lineSpacing:1};
    }
  }
  let supplement='';
  if(item.sources&&item.sources!=='SOURCES.md'){try{supplement=await fs.readFile(OUT+'/'+item.sources,'utf8')}catch{}}
  slide.speakerNotes.text=`Figure ${item.figure}: ${item.title}\nEvidence status: ${item.type}\n\n${sources}\n${supplement}`;
  const png=await presentation.export({slide,format:'png',scale:1});
  await fs.writeFile(`${WORK}/text-deck/rendered/${String(item.figure).padStart(2,'0')}.png`,new Uint8Array(await png.arrayBuffer()));
}
const candidatePath=path.resolve(`${WORK}/text-deck/candidate-${count}.pptx`);
const finalPath=path.resolve(`${OUT}/editable/AI_LST_all_${count}_text_editable_rebuilt.pptx`);
if(!process.argv.includes('--finalize-only')) await(await PresentationFile.exportPptx(presentation)).save(candidatePath);
const result=await finalizePresentation({workspaceDir,candidatePath,finalPath,pythonExecutable:runtimePython,integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-heading-fit'],requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],explicitTotalSlideCount:count,fontPolicy:{basis:'design',families:fonts},verifyArtifactToolImport:true,receiptPath:path.resolve(`${WORK}/text-deck/validation-${count}.json`)});
console.log(JSON.stringify({file:finalPath,slides:count,native_text_boxes:selectedSlides.reduce((sum,item)=>sum+item.labels.length,0),validation:result}));
