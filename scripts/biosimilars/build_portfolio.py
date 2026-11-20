"""Merge the company register with the existing regulatory catalogue."""
from collections import Counter
from copy import deepcopy
from pathlib import Path
from urllib.parse import urlparse
import argparse
import json
import re
import unicodedata

from portfolio import company_audit, register, new_molecules, record, VERIFY, BIO


MISSING = '阶段待核实'
RESOLVED_DUPLICATES = {'Jubbonti／Wyost'}
PRIORITY = ['pembrolizumab','daratumumab','nivolumab','secukinumab','dupilumab',
            'vedolizumab','ocrelizumab','risankizumab','guselkumab','aflibercept','denosumab']
REGIONS = {'中国':'CN','美国':'US','欧盟':'EU','英国':'UK','韩国':'KR','日本':'JP','加拿大':'CA'}
RANK = {'许可暂停': 12,'许可撤销': 12,'许可撤回': 12,'许可失效': 12,'许可到期': 12,
        '已商业化': 11,'获批': 10,'获批／商业化组合': 10,'审评': 9,'BLA 重新提交': 8,
        '已提交上市申请': 8,'III 期完成':7,'关键临床完成':7,'注册临床':7,
        'III 期':6,'后期研发':6,'II 期':5,'I 期':4,'临床':4,'IND 获批':3,
        '临床前':2,'早期研发':1,'项目已披露':0}


def canonical(text):
    return unicodedata.normalize('NFKC',text).casefold().strip()


def molecule_key(text):
    return canonical(text).replace('epoetin-alfa', 'epoetin alfa')


def convert_legacy(old):
    args = {key:old[key] for key in ('id','company','molecule','names','source')}
    args.update(display=old['id'],description=old.get('note'),developer=None)
    region = REGIONS.get(old['region'], '—')
    stage = {'商业化':'已商业化','已披露／阶段待核':'项目已披露'}.get(old['stage'],old['stage'])
    args['milestones'] = [record(region,stage,old['source'],description=old.get('note'))]
    args['partners'] = [dict(p,territories=p.get('territories')) for p in old.get('partners',[])]
    args['projectStatus'] = old['state'] if old['state'] in ('Paused','Divested','Discontinued') else 'Unspecified'
    return args


def add_regulatory_milestones(assets, approvals):
    alias = {}
    for asset in assets.values():
        for name in [asset['id'],*asset['names']]:
            key=(molecule_key(asset['molecule']),canonical(name))
            if key in alias and alias[key]!=asset['id']:
                raise ValueError(f'Ambiguous identity {key}: {alias[key]} / {asset["id"]}')
            alias[key]=asset['id']

    touch = Counter()
    for row in approvals:
        brand=canonical(row['brand'])
        key=(molecule_key(row['molecule']),brand)
        ident=alias.get(key)
        legacy=row.get('assetId')
        if not ident and legacy in assets and assets[legacy]['molecule']==row['molecule']:
            ident=legacy
        row['assetId']=ident
        if not ident:
            continue
        a=assets[ident]
        a.setdefault('regulatory',{}).setdefault(row['region'],[]).append(row['status'])
        assert molecule_key(row['molecule'])==molecule_key(a['molecule'])
        touch[row['region']]+=1
        source=row['source']
        a['milestones'].append(record(row['region'],'获批',source,row.get('date'),row['brand']+
            (' · '+row['code'] if row.get('code') else '')))
        if row.get('status','').startswith('许可') and row['status']!='许可有效':
            a['milestones'].append(record(row['region'],row['status'],source,description=row['brand']))
        if row.get('launch'):
            a['milestones'].append(record(row['region'],'已商业化',row.get('launchSource') or source,row['launch'],row['brand']))
    return dict(touch)


def summarize(asset):
    current = {}
    detailed = []
    seen = set()
    for event in asset['milestones']:
        key = (event['region'],event['stage'],event.get('date'),event.get('description'),event.get('expected',False))
        if key not in seen:
            detailed.append(event)
            seen.add(key)
    asset['milestones'] = detailed
    for event in detailed:
        if event.get('expected'):
            continue
        region = event['region']
        prev = current.get(region)
        # A withdrawal of one brand must not override another brand's authorization.
        if event['stage'] in ('许可暂停','许可撤销','许可撤回','许可失效','许可到期'):
            continue
        if not prev or (RANK.get(event['stage'],0),event.get('date','')) > (RANK.get(prev['stage'],0),prev.get('date','')):
            current[region] = event
    for region, statuses in asset.pop('regulatory',{}).items():
        if statuses and all(s.startswith('许可') and s != '许可有效' for s in statuses):
            latest = next(e for e in detailed if e['region']==region and e['stage']==statuses[0])
            current[region] = latest
    asset['current'] = current
    highest = max(current.values(),key=lambda row:RANK.get(row['stage'],0),default=None)
    asset['stage'] = highest['stage'] if highest else MISSING
    asset['region'] = '／'.join(x for x in current if x!='—')
    asset['date'] = highest.get('date') if highest else None
    asset['note'] = asset.get('description') or (highest.get('description') if highest else None) or ''
    stages_in_progress = {'早期研发','临床前','IND 获批','临床','I 期','II 期','III 期','注册临床',
      'III 期完成','关键临床完成','后期研发','已提交上市申请','BLA 重新提交','审评'}
    active = any(event['stage'] in stages_in_progress for event in current.values())
    asset['state'] = 'Active' if asset.get('projectStatus','Unspecified') == 'Unspecified' and active else asset.get('projectStatus','Unspecified')
    asset['lastVerifiedAt']=VERIFY
    asset['companyIds'] = sorted({asset['company'],*[p['company'] for p in asset['partners'] if p.get('company')]})


def make_snapshot(model):
    for key,(cn,ref) in new_molecules.items():
        if key not in model['molecules']:
            model['molecules'][key]=dict(name=key.title(),cn=cn,reference=ref)
        elif not model['molecules'][key].get('reference'):
            model['molecules'][key].update(cn=cn,reference=ref)
    assets=deepcopy(register)
    for old in model['assets']:
        if old['id'] not in assets and old['id'] not in RESOLVED_DUPLICATES:
            assets[old['id']]=deepcopy(old) if 'milestones' in old else convert_legacy(old)
    approvals=model['approvals']
    for product,mol in [('格乐立','adalimumab'),('施瑞立','tocilizumab'),('优卓美','secukinumab'),('汉贝优','pertuzumab')]:
        if not any(c['region']=='CN' and c['brand']==product for c in approvals):
            approvals.append(dict(region='CN',code='',brand=product,molecule=mol,holder='复宏汉霖' if product == '汉贝优' else '百奥泰',
              date=None,status='公司披露已获批',source=(
               'https://www.henlius.com/upload/202611/06/Henlius2026InterimResultsInvestorSlides.pdf'
               if product == '汉贝优' else BIO),launch=None,reference=model['molecules'][mol]['reference']))
    matched=add_regulatory_milestones(assets,approvals)
    for asset in assets.values():
        assert asset['molecule'] in model['molecules'], (asset['id'],asset['molecule'])
        assert asset['milestones'], asset['id']
        summarize(asset)
        for source in [asset['source'],*[row['source'] for row in asset['milestones']]]:
            assert urlparse(source).scheme == 'https', source
    audit=[]
    for c in company_audit:
        row={**c}
        official,site=0,0
        for a in assets.values():
            if row['company'] in a['companyIds']:
                site += 1
                official += int(a['id'] in register)
        row['identified']=official
        row['recorded']=site
        audit.append(row)
    model.update(assets=list(assets.values()),pipelineAudit=audit,pipelinePriority=PRIORITY,
        pipelineVerifiedAt=VERIFY,pipelineApprovals=dict(total=len(approvals),matched=sum(matched.values()),byRegion=matched))
    for name in PRIORITY:
        if name not in model['molecules']: raise KeyError(name)
    print('Unique assets',len(assets),'Approval records',len(approvals),'Linked',matched)
    for row in audit: print(row['company'],row['identified'],row['recorded'])
    return model


def main():
    cli=argparse.ArgumentParser()
    cli.add_argument('site',type=Path)
    cli.add_argument('output',type=Path)
    args=cli.parse_args()
    html=args.site.read_text()
    pattern=r'<script id="snapshot" type="application/json">(.*?)</script>'
    blob=re.search(pattern,html,re.S)[1]
    model=make_snapshot(json.loads(blob))
    args.output.write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')))


if __name__=='__main__':
    main()
