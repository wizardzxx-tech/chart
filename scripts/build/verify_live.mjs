import {createHash} from 'node:crypto';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const [base,manifestName,reportName]=process.argv.slice(2);
const manifest=JSON.parse(await readFile(manifestName,'utf8'));
const checks=[];
const url=path=>new URL('v2/'+path,base.endsWith('/')?base:base+'/');
async function check(id,run,required=false){
  try {
    const result=await run();
    checks.push({id,required,status:result?.skip?'skipped':'passed',detail:result?.skip||result||null});
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
page.setDefaultTimeout(25000);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const cn=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
const printed=v=>v==null?'—':cn.format(v);
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
    const revenues=await panel.locator('svg circle title').allTextContents();
    assert(revenues.at(-1)?.includes(printed(manifest.finance.quarter_revenue/1e6)+' CNY 百万'),
      'Rendered quarter revenue differs or is labelled with the wrong unit');
    await panel.getByRole('combobox',{name:'财务指标'}).selectOption('ccc');
    await panel.getByRole('combobox',{name:'财务口径'}).selectOption('ttm');
    assert(await panel.locator('svg circle').count()>1,'CCC history and TTM switch unavailable');
    return manifest.finance.period;
  },true);
  await check('cms.partb-values',async()=>{
    if(!manifest.cms)return {skip:'No automatically sourced current CMS cumulative period'};
    await load('biosimilars/#market');
    const metric=page.locator('#cms-metric');
    if(manifest.cms_value)await page.locator('#cms-molecule').selectOption('aflibercept');
    await metric.selectOption('quarterSpending');
    const period=page.locator('#market-period');
    await period.selectOption(manifest.cms);
    await page.locator('#market-table').locator('xpath=ancestor::details/summary').click();
    await page.locator('#market-table tbody tr').first().waitFor();
    assert(await period.locator('option[value="2026Q1"]').count()===1,'Legacy quarterly option missing');
    assert((await period.locator('option:checked').textContent()).includes('累计'),'Cumulative window mislabeled');
    if(manifest.cms_value){
      const code=manifest.cms_value.code;
      const value=page.locator('#market-table tbody tr').filter({hasText:code});
      const decimal=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      assert((await value.textContent()).includes('$'+decimal.format(manifest.cms_value.spending)),'Part B rendered spending differs');
    }
    const annual=manifest.cms_full_year;
    if(annual){
      await period.selectOption('2025FY');
      const code=page.locator('#market-table tbody tr').filter({hasText:annual.code});
      const dollars=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
      assert((await period.locator('option:checked').textContent()).includes('全年'),'Full-year Part B scope mislabeled');
      assert((await code.textContent()).includes('$'+dollars.format(annual.spending)),'Approved full-year values did not replace the old version');
    }
    return manifest.cms;
  },true);
  for(const [topic,feed] of Object.entries({api:'api','medical-devices':'devices',vaccines:'vax'})){
    await check(feed+'.trade-monthly',async()=>{
      await load(topic+'/');
      const panel=page.locator('[data-monthly-trade]');
      await panel.waitFor();
      await panel.getByRole('combobox',{name:'月度数据来源'}).selectOption('original');
      const expected=manifest.monthly[topic];
      if(!expected)return {skip:'No accepted monthly observations published'};
      await panel.getByRole('combobox',{name:'月度商品'}).selectOption(expected.product);
      await panel.getByRole('combobox',{name:'月度贸易方向'}).selectOption(expected.flow);
      assert((await panel.textContent()).includes(expected.period.slice(0,7)),'Latest published period missing from month table');
      assert(await panel.locator('svg circle').count()>0,'Accepted observations did not render');
      const latest=panel.locator('tbody tr').first().locator('td');
      for(const [index,field] of [[1,'amount'],[2,'qty'],[3,'asp'],[4,'growth'],[6,'rolling']]){
        assert(await latest.nth(index).textContent()===printed(expected[field]),'Monthly original-series value differs: '+field);
      }
      return expected.period;
    });
  }
  for(const topic of ['api','medical-devices','vaccines']){
    await check(topic+' 近期海关摘要数值',async()=>{
      const expected=manifest.fresh_trade?.[topic];
      if(!expected)return {skip:'Coverage report lacks this required current reference observation'};
      await load(topic+'/');
      const panel=page.locator('[data-monthly-trade]');
      await panel.getByRole('combobox',{name:'月度数据来源'}).selectOption('summary');
      await panel.getByRole('combobox',{name:'月度商品'}).selectOption(expected.product);
      await panel.getByRole('combobox',{name:'月度贸易方向'}).selectOption('X');
      const cells=await panel.locator('tbody tr').first().locator('td').allTextContents();
      const expectedValues=[expected.period.slice(0,7),printed(expected.amount),printed(expected.qty),printed(expected.asp)];
      assert(cells.slice(0,4).join('|')===expectedValues.join('|'),'Current customs amount, unit quantity or rate differs');
      assert((await panel.textContent()).includes(expected.unit==='kg'?'千克':expected.unit||'待核实'),'Displayed quantity unit differs');
      return expected.period;
    },true);
    await check(topic+' HS10 历史对照数值',async()=>{
      const expected=manifest.reference_trade?.[topic];
      if(!expected)return {skip:'No HS10 source observation for the required reference code'};
      await load(topic+'/');
      const panel=page.locator('[data-monthly-trade]');
      await panel.getByRole('combobox',{name:'月度数据来源'}).selectOption('history');
      await panel.getByRole('combobox',{name:'月度商品'}).selectOption(expected.product);
      const cells=await panel.locator('tbody tr').first().locator('td').allTextContents();
      assert(cells.slice(0,4).join('|')===[expected.period.slice(0,7),printed(expected.amount),'—','—'].join('|'),
        'Independently reported HS10 amount differs or an unsupported quantity or ASP rendered');
      return expected.period;
    },true);
  }
  await check('经营指标核准值',async()=>{
    if(!manifest.operating)return {skip:'No reviewed operating value in this production snapshot'};
    await load('blood-products/');
    const row=page.locator('[data-operating-reviewed] tbody tr').filter({hasText:'采浆量'}).first();
    await row.waitFor();
    const cells=await row.locator('td').allTextContents();
    assert(cells[3]===printed(manifest.operating.value)&&cells[4]==='吨'&&cells[5]==='全年',
      'Approved collection volume or its scope differs');
    return manifest.operating.period;
  },true);
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
    assert(await page.locator('[data-update-center] tbody tr').count()<=1,'Dataset text and status filters did not combine');
    const fieldPanel=page.locator('[data-field-coverage]');
    await fieldPanel.getByRole('combobox',{name:'字段覆盖公司'}).selectOption('AMGN.US');
    assert((await fieldPanel.locator('tbody tr').filter({hasText:'销售及管理费用合计'}).textContent()).includes('有值'),
      'SEC combined SG&A is missing from the native financial evidence');
    const reviewPanel=page.locator('[data-operating-review]');
    if(manifest.operating){
      const options=await reviewPanel.getByRole('combobox').locator('option').allTextContents();
      assert(options.some(x=>x.includes('600161.SH')),'Cannot find the approved original filing in the operating review');
    }
    return 'Dataset filters, SEC combined SG&A, and operating approval accessible';
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
if(counts.failed||checks.some(x=>x.required&&x.status==='skipped'))process.exitCode=1;
