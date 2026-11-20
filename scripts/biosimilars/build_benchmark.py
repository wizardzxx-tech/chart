"""Derive CMS launch-cohort series and keep Samsung observations independent."""
from argparse import ArgumentParser
from pathlib import Path
import json


REPORT_URL='https://www.samsungbioepis.com/upload/attach/SB%2BBiosimilar%2BMarket%2BReport%2BQ4%2B2026.pdf'
HHS='https://aspe.hhs.gov/reports/biosimilars-medicare-part-b'
CMS_POLICY='https://www.cms.gov/files/document/part-b-drug-payment-limits-overview.pdf'
QUOTE_ROWS=[
 ('trastuzumab','曲妥珠单抗','Herceptin',89,'2026 Q2',20,12),
 ('bevacizumab','贝伐珠单抗','Avastin',93,'2026 Q2',21,14),
 ('rituximab','利妥昔单抗','Rituxan',76,'2026 Q2',22,16),
 ('filgrastim','非格司亭','Neupogen',78,'2026 Q2',23,18),
 ('pegfilgrastim','聚乙二醇非格司亭','Neulasta',86,'2026 Q2',24,20),
 ('infliximab','英夫利西单抗','Remicade',52,'2026 Q2',26,24),
 ('adalimumab','阿达木单抗','Humira',64,'上市第 4 年（按日历年）',18,10),
 ('tocilizumab','托珠单抗','Actemra',31,'2026 Q2',28,28),
 ('ustekinumab','乌司奴单抗','Stelara',52,'2026 Q2',29,30),
 ('ranibizumab','雷珠单抗','Lucentis',14,'2026 Q2',31,34),
 ('eculizumab','依库珠单抗','Soliris',46,'2026 Q2',32,36),
]
LAUNCHES={
 'trastuzumab':(2019,'肿瘤'),'bevacizumab':(2019,'肿瘤'),
 'rituximab':(2019,'肿瘤'),'filgrastim':(2015,'支持治疗'),
 'pegfilgrastim':(2018,'支持治疗'),'infliximab':(2016,'免疫'),
 'ranibizumab':(2022,'眼科'),
}


def build_cohorts(medicare):
    output=[]
    for group in medicare['groups']:
        name=group['id']
        if name not in LAUNCHES:
            continue
        launch,category=LAUNCHES[name]
        original=next(p['code'] for p in group['products'] if p.get('reference'))
        similar={p.get('code') for p in group['products']} - {original,None}
        annually=[r for r in medicare['annual'] if r['code'] in similar|{original} and int(r['period'])>launch]
        periods=sorted({r['period'] for r in annually})
        usage=[]
        for period in periods:
            rows=[r for r in annually if r['period']==period and r['units'] is not None]
            sample=[r for r in rows if r['code'] in similar]
            ref=[r for r in rows if r['code']==original]
            denominator=sum(r['units'] for r in rows)
            if sample and ref and denominator>0:
                usage.append(dict(age=int(period)-launch,period=period,value=round(sum(r['units'] for r in sample)/denominator,7),
                  codes=[r['code'] for r in rows]))
        # Use Q4 observations on the calendar-year scale. The first observed Q4 is
        # disclosed for each series because CMS pricing archives start after some launches.
        selected=sorted((r for r in medicare['price'] if r['code']==original and r['period'].endswith('Q4')
          and int(r['period'][:4])>launch and r['price'] and r['price']>0),key=lambda r:r['period'])
        base=selected[0]
        price=[dict(age=int(r['period'][:4])-launch,period=r['period'],
                    value=round(r['price']/base['price']*100,5),limit=r['price']) for r in selected]
        entry=dict(id=name,label=group['label'],reference=group['reference'],category=category,launch=launch,
                   scope=group['scope'],base=base['period'],unit=group['unit'],usage=usage,price=price)
        assert len({r['age'] for r in usage})==len(usage) and price[0]['value']==100
        output.append(entry)
    return output


def main():
    parser=ArgumentParser(description=__doc__)
    parser.add_argument('medicare',type=Path)
    parser.add_argument('archive',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    medicare=json.loads(args.medicare.read_text())
    archive=json.loads(args.archive.read_text())
    quotes=[]
    for molecule,label,reference,value,period,page,figure in QUOTE_ROWS:
        source=dict(label='IQVIA MIDAS · Standard Units',name='Samsung Bioepis · Q4 2026（第 15 版）',url=REPORT_URL)
        quotes.append(dict(molecule=molecule,label=label,reference=reference,value=value,period=period,
            page=page,figure=figure,source=source,
            note='三星图 30 的份额剔除了 Cordavis 与 Quallent 的销售。' if molecule=='ustekinumab' else None))
    assert len({x['molecule'] for x in quotes})==len(quotes)
    data=dict(quotes=quotes,archive=archive,cohorts=build_cohorts(medicare),hhs=HHS,cmsPolicy=CMS_POLICY,
      reportUrl=REPORT_URL,
      wac=[
        {'brand':'Hadlima','variant':'低 WAC','value':519},
        {'brand':'Hyrimoz','variant':'高 WAC','value':3288},
        {'brand':'Hyrimoz','variant':'低 WAC','value':658},
        {'brand':'Simlandi（Quallent）','variant':'自有品牌渠道','value':1875},
      ],wacMetadata={'unit':'按 40 mg 比较','period':'2026 Q4','page':27,'figure':27,
                       'source':'Samsung Bioepis 转述 Buy and Bill'},
      supply={'fda':'https://www.fda.gov/drugs/drug-safety-and-availability/drug-shortages',
              'interviewPage':34})
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    print('Benchmarks',[(r['id'],len(r['usage']),len(r['price'])) for r in data['cohorts']],
          'Samsung anchors',len(quotes),'Report entries',len(archive))


if __name__=='__main__':
    main()
