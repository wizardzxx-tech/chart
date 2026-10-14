export const VERSION='2026-10-14.1';
export const DEFAULTS={investment:50,years:5,wetShare:35,capexShare:45,testShare:65,buildCapital:1.5,testCapital:2.5,buildRunCost:0.35,testRunCost:0.55,utilization:85,productivity:1,lag:0,manufacturing:0,labPurification:35,profile:'antibody',view:'cohort'};
export const LIMITS={investment:[0,200],years:[2,5],wetShare:[0,100],capexShare:[0,100],testShare:[0,100],buildCapital:[0.1,20],testCapital:[0.1,20],buildRunCost:[0.05,10],testRunCost:[0.05,10],utilization:[0,100],productivity:[0.5,3],lag:[0,5],manufacturing:[0,100],labPurification:[0,100]};
export const PROFILES={
 antibody:{label:'Protein / antibody discovery',elasticities:[.90,.95,.75,.40,.70,.50],buildWeights:[1,.15,.10,.35,.05,.60],exposures:[12,20,10,8,12,6]},
 data:{label:'Cell-data / perturbation factory',elasticities:[.80,.65,1.05,.45,1.00,.30],buildWeights:[.75,.05,.05,.20,.02,.45],exposures:[12,12,25,12,20,4]},
 small:{label:'Small-molecule discovery',elasticities:[.60,.45,.80,.30,.80,.40],buildWeights:[1,.10,.05,.30,.10,.65],exposures:[12,8,12,8,12,6]}
};
export const FAMILIES=[
 {id:'molecular',title:'Molecular construction',icon:'dna',products:'DNA / RNA, enzymes, chemical building blocks',reason:'Construct volumes follow Build. Better triage and shared samples can limit purchases per program.',logos:['twist-trim.png','genscript-trim.png'],cn:['GenScript · 1548.HK','Vazyme · 688105.SH'],us:['Twist · TWST','Thermo Fisher · TMO']},
 {id:'protein',title:'Protein & functional assays',icon:'flask-conical',products:'Target proteins, antibodies, sensors and assay reagents',reason:'Binding and functional data follow Test. More assays need paid reagents, but kinetic labels can share one run.',logos:['acro-trim.png'],cn:['ACRO · 301080.SZ','Sino · 301047.SZ'],us:['Bio-Techne · TECH','Thermo Fisher · TMO']},
 {id:'cells',title:'Cells & culture systems',icon:'test-tubes',products:'Cell models, media, feeds and transfection',reason:'Cell-based validation and perturbation datasets need culture workflows. Smaller formats reduce use per assay.',logos:[],wordmark:'Gibco / HyClone',cn:['OPM · 688293.SH','ACRO · 301080.SZ'],us:['Gibco / Thermo · TMO','HyClone / Danaher · DHR']},
 {id:'labware',title:'Labware & sample handling',icon:'pipette',products:'Plates, tips, tubes, filters and sample preparation',reason:'Automation increases assay throughput, while miniaturization, tip-free transfer and reuse can reduce unit consumption.',logos:['jet-english.png','bd-original.svg'],cn:['JET Biofil · 688026.SH','Changhong · 300151.SZ'],us:['Corning · GLW','BD · BDX (collection)']},
 {id:'measurement',title:'Measurement & analytics',icon:'microscope',products:'Sequencing, LC / LC-MS, flow, imaging and QC',reason:'More readouts increase measurement work. Existing instruments can be used harder before new systems are bought.',logos:['mgi-trim.png'],cn:['MGI · 688114.SH','NanoMicro · 688690.SH'],us:['Agilent · A / Thermo · TMO','Waters · WAT (incl. ex-BD flow)']},
 {id:'purification',title:'Purification & scale-up',icon:'factory',products:'Lab purification, analytical columns and process resins',reason:'Analytical separation can respond early. Commercial process resins require pipeline progression and manufacturing volumes.',logos:['nanomicro-emblem.svg','cytiva-trim.png'],cn:['NanoMicro · 688690.SH','Sepax · 688758.SH'],us:['Cytiva / Danaher · DHR','Repligen · RGEN']}
];
export function familyDefaults(profile='antibody'){
 const p=PROFILES[profile]||PROFILES.antibody;
 return FAMILIES.map((f,i)=>({id:f.id,elasticity:p.elasticities[i],buildWeight:p.buildWeights[i],exposure:p.exposures[i],price:1}));
}
export function sanitize(input={}){
 const state={...DEFAULTS};
 for(const [key,[lo,hi]] of Object.entries(LIMITS)){const n=Number(input[key]??state[key]);state[key]=Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):state[key];}
 state.years=Math.round(state.years);state.profile=PROFILES[input.profile]?input.profile:DEFAULTS.profile;state.view=input.view==='market'?'market':'cohort';
 const defaults=familyDefaults(state.profile);
 state.families=defaults.map(d=>{const p=Array.isArray(input.families)?input.families.find(x=>x?.id===d.id):null;const out={...d};for(const [key,lo,hi] of [['elasticity',0,1.5],['buildWeight',0,1],['exposure',0,100],['price',.1,2]]){const n=Number(p?.[key]??d[key]);out[key]=Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):d[key];}return out;});
 return state;
}
export function calculate(input){
 const s=sanitize(input),wet=s.wetShare/100,capex=s.capexShare/100,test=s.testShare/100,u=s.utilization/100;
 const annual=s.investment/s.years,annualWet=annual*wet,annualEquipment=annualWet*capex,annualRuns=annualWet*(1-capex);
 const totalEquipment=s.investment*wet*capex,commissioning=Math.max(0,1-s.lag/s.years),productiveEquipment=totalEquipment*commissioning;
 const stage=(capital,runCost,share,year=s.years)=>{
  const deployed=totalEquipment*Math.max(0,year-s.lag)/s.years*share;
  const installedIncrement=deployed/capital,runIncrement=annualRuns*share/runCost;
  const raw=1+u*Math.min(installedIncrement,runIncrement)*s.productivity;
  const funded=Math.min(10,raw),target=Math.min(10,Math.max(2,raw));
  const binding=u===0?'Rollout realization':installedIncrement<=runIncrement?'Equipment capacity':'Annual lab execution funding';
  return {installed:1+installedIncrement,runSupported:1+runIncrement,raw,funded,target,binding,gap:Math.max(0,target-funded),ceiling:raw>10};
 };
 const build=stage(s.buildCapital,s.buildRunCost,1-test),testing=stage(s.testCapital,s.testRunCost,test);
 const families=s.families.map(p=>{
  const driver=p.buildWeight*build.funded+(1-p.buildWeight)*testing.funded;
  let incrementalVolume=Math.pow(driver,p.elasticity)-1;
  if(p.id==='purification')incrementalVolume=(s.labPurification/100)*incrementalVolume+(1-s.labPurification/100)*(s.manufacturing/100)*(Math.pow(driver,.2)-1);
  const cohort=1+incrementalVolume*p.price,market=1+p.exposure/100*(cohort-1);
  return {...p,driver,cohort,market,value:s.view==='market'?market:cohort};
 });
 const ranked=[...families].sort((a,b)=>b.value-a.value);
 const priceTie=ranked[0].value-ranked.at(-1).value<.005;
 const inverse=(multiple,capital,runCost,share)=>{
  if(u<=0||wet<=0||share<=0||capex<=0||capex>=1||commissioning<=0)return null;
  const increment=(multiple-1)/(u*s.productivity);
  return Math.max(increment*capital/(wet*capex*share*commissioning),increment*runCost*s.years/(wet*(1-capex)*share));
 };
 const needs=Object.fromEntries([2,10].map(m=>{const b=inverse(m,s.buildCapital,s.buildRunCost,1-test),t=inverse(m,s.testCapital,s.testRunCost,test);return [m,{build:b,test:t,both:b===null||t===null?null:Math.max(b,t)}];}));
 const timeline=Array.from({length:s.years},(_,i)=>({year:i+1,annual,build:stage(s.buildCapital,s.buildRunCost,1-test,i+1).funded,test:stage(s.testCapital,s.testRunCost,test,i+1).funded}));
 return {state:s,annual,annualWet,annualEquipment,annualRuns,totalEquipment,productiveEquipment,otherAnnual:annual-annualWet,commissioning,build,test:testing,families,ranked,priceTie,needs,timeline};
}
