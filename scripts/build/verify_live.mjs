import {createHash} from 'node:crypto';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const [base,manifestName,reportName]=process.argv.slice(2);
const manifest=JSON.parse(await readFile(manifestName,'utf8'));
const checks=[];
const url=path=>new URL('v2/'+path,base.endsWith('/')?base:base+'/');
async function check(id,run){
  try {
    const result=await run();
    checks.push({id,status:result?.skip?'skipped':'passed',detail:result?.skip||result||null});
  } catch(error){
    checks.push({id,status:'failed',detail:error.message});
  }
}
async function verifyHash(path,expected){
  for(let retry=0;retry<6;retry++){
    try{
      const target=new URL(path,base.endsWith('/')?base:base+'/');
      target.searchParams.set('verify',expected.slice(0,12));
      const r=await fetch(target,{signal:AbortSignal.timeout(15000)});
      if(r.ok&&createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex')===expected)return;
    }catch(error){if(retry===5)throw error;}
    if(retry<5)await delay(2500);
  }
  throw new Error('Online JSON SHA-256 differs from deployed commit');
}
await Promise.all(Object.entries(manifest.hashes).map(([path,hash])=>check(path,()=>verifyHash(path,hash))));
const {chromium}=await import(process.env.CHART_PLAYWRIGHT||'playwright');
const browser=await chromium.launch(process.env.CHART_CHROME?{executablePath:process.env.CHART_CHROME}:{});
const page=await browser.newPage();
page.setDefaultTimeout(12000);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const load=async(path)=>{
  const dest=url(path);
  const response=await page.goto(dest.href,{waitUntil:'domcontentloaded'});
  assert(response?.ok(),`Read ${dest.pathname}`);
};
try {
  await check('financials.standard',async()=>{
    if(!manifest.finance)return {skip:'No normalized financial series in this commit'};
    await load('pharmacy/');
    const panel=page.locator('[data-research-finance]');
    const picker=panel.getByRole('combobox',{name:'公司'});
    await picker.selectOption(manifest.finance.ticker);
    assert((await panel.textContent()).includes(manifest.finance.period),'Latest financial filing absent from chart panel');
    await panel.getByRole('combobox',{name:'财务指标'}).selectOption('ccc');
    await panel.getByRole('combobox',{name:'财务口径'}).selectOption('ttm');
    assert(await panel.locator('svg circle').count()>1,'CCC history and TTM switch unavailable');
    return manifest.finance.period;
  });
  await check('cms.partb-values',async()=>{
    if(!manifest.cms)return {skip:'No automatically sourced current CMS cumulative period'};
    await load('biosimilars/#market');
    const metric=page.locator('#cms-metric');
    await metric.selectOption('quarterSpending');
    const period=page.locator('#market-period');
    await period.selectOption(manifest.cms);
    await page.locator('#market-table').locator('xpath=ancestor::details/summary').click();
    await page.locator('#market-table tbody tr').first().waitFor();
    assert(await period.locator('option[value="2026Q1"]').count()===1,'Legacy quarterly option missing');
    return manifest.cms;
  });
  for(const [topic,feed] of Object.entries({api:'api','medical-devices':'devices',vaccines:'vax'})){
    await check(feed+'.trade-monthly',async()=>{
      await load(topic+'/');
      const panel=page.locator('[data-monthly-trade]');
      await panel.waitFor();
      const expected=manifest.monthly[topic];
      if(!expected)return {skip:'No accepted monthly observations published'};
      await panel.getByRole('combobox',{name:'月度商品'}).selectOption(expected.product);
      await panel.getByRole('combobox',{name:'月度贸易方向'}).selectOption(expected.flow);
      assert((await panel.textContent()).includes(expected.period.slice(0,7)),'Latest published period missing from month table');
      assert(await panel.locator('svg circle').count()>0,'Accepted observations did not render');
      return expected.period;
    });
  }
  await check('vax.agency-coverage',async()=>{
    if(!manifest.agency)return {skip:'Agency disclosure monitor has no snapshot'};
    await load('vaccines/');
    const panel=page.locator('[data-agency-coverage]');
    await panel.getByRole('combobox',{name:'批签发覆盖周'}).selectOption(manifest.agency.period);
    assert(await panel.locator('tbody tr').count()===manifest.agency.total,'Agency report did not render all institutions');
    return manifest.agency.period;
  });
  await check('update-center',async()=>{
    await load('update-center/');
    const filter=page.getByRole('combobox',{name:'状态'});
    await filter.selectOption('Partial success');
    await page.getByRole('searchbox',{name:'搜索'}).fill('cms.partb-values');
    assert(await page.locator('tbody tr').count()<=1,'Dataset text and status filters did not combine');
    return 'Partial success filter selectable';
  });
} finally {
  await browser.close();
}
const counts=Object.fromEntries(['passed','failed','skipped'].map(s=>[s,checks.filter(x=>x.status===s).length]));
await writeFile(reportName,JSON.stringify({commit:manifest.commit,counts,checks},null,2)+'\n');
const lines=checks.map(x=>`| ${x.id} | ${x.status} | ${x.detail||'—'} |`);
if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `## 线上 JSON 与浏览器验证\n\n提交 ${manifest.commit}\n\n| 检查 | 结果 | 依据 |\n|---|---|---|\n${lines.join('\n')}\n`);
console.log(JSON.stringify({counts,checks},null,2));
if(counts.failed)process.exitCode=1;
