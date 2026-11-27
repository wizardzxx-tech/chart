"""Recompute every export and chart value from the published statement inputs."""
from collections import Counter
from datetime import date
from decimal import Decimal
from pathlib import Path
import csv,json,sys

SITE=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[2]/'v2'
METRICS=('AR days','AP days','Inventory days','CCC days')
ROUNDING=Decimal('0.0000005')
def read(folder,name):
    with (folder/(name+'.csv')).open(encoding='utf-8-sig',newline='') as f:
        return list(csv.DictReader(f))
def number(text):
    return Decimal(str(text)) if text is not None and text!='' else None
def index_quarter(label):
    return int(label[:4])*4+int(label[-1])-1
def qdate(i):
    return date(i//4,i%4*3+1,1)
def index_half(text):
    end=date.fromisoformat(text)
    return end.year*2+int(end.month==12)
def total(values):
    return sum(values) if None not in values else None
def check(got,wanted,where,tol=0):
    if got==wanted:return
    assert got is not None and wanted is not None and abs(got-wanted)<=tol,(where,got,wanted)
def days(balance,flow,duration):
    return duration*balance/flow if balance is not None and flow is not None and flow>0 else None
def index(rows,keys):
    lookup={keys(row):row for row in rows}
    assert len(lookup)==len(rows),'duplicate key'
    return lookup
def cell(row,key):
    return number(row.get(key))
def metrics(values,flows,length):
    ar,ap,inv=[days(balance,flow,length) for balance,flow in zip(values,(flows[0],flows[1],flows[1]))]
    return ar,ap,inv,ar+inv-ap if None not in (ar,ap,inv) else None
def metrics_check(row,computed,where,chart_values):
    for k,v,chart in zip(METRICS,computed,chart_values):
        check(cell(row,k),v,where+(k,),ROUNDING)
        check(number(chart),cell(row,k),where+('json '+k,))
    values=[cell(row,k) for k in METRICS]
    if None not in values:
        assert abs(values[0]+values[2]-values[1]-values[3])<=Decimal('0.000002')
def local(folder):
    raw=read(folder,'working-capital-inputs')
    data=read(folder,'working-capital')
    lookup=index(raw,lambda row:(row['代码'],index_quarter(row['季度'])))
    display=json.loads((folder/'working-capital.json').read_text())
    chart={(c['code'],r[0],mode):r[n][0] for c in display['companies'] for r in c['records']
           for n,mode in enumerate(('TTM','单季'),1)}
    assert len(chart)==len(data)
    counts=Counter()
    for row in raw:
        code,q=row['代码'],index_quarter(row['季度'])
        for acct,note,group,finance,target in [
            ('应收账款','应收票据','应收票据及应收账款合计','应收款项融资','扩展AR'),
            ('应付账款','应付票据','应付票据及应付账款合计',None,'扩展AP'),
        ]:
            a,n,g=[cell(row,k+'（元）') for k in (acct,note,group)]
            f=cell(row,finance+'（元）') if finance else None
            b=g if g is not None else (a+n if None not in (a,n) else None)
            check(cell(row,target+'（元）'),b+(f or 0) if b is not None else None,(code,q,target))
        for k in ('营业收入','营业成本'):
            last=cell(lookup.get((code,q-1),{}),'累计'+k+'（元）')
            curr=cell(row,'累计'+k+'（元）')
            expected=curr if q%4==0 else curr-last if None not in (curr,last) else None
            if row['口径缺项说明']:expected=None
            check(cell(row,'单季度'+k+'（元）'),expected,(code,q,k))
    seen=set()
    for row in data:
        code,label,mode=(row[k] for k in ('代码','季度','计算口径'))
        where=(code,label,mode)
        assert where not in seen
        seen.add(where)
        q=index_quarter(label)
        width=4 if mode=='TTM' else 1
        window=[lookup.get((code,i),{}) for i in range(q-width,q+1)]
        length=365 if width==4 else (qdate(q+1)-qdate(q)).days
        def mean(key):
            if any(r.get('余额口径缺项说明') for r in window):
                return None
            values=[cell(r,key) for r in window]
            if None not in values:
                return sum((a+b)/2 for a,b in zip(values,values[1:]))/width
        avg=[mean(k+'（元）') for k in ('扩展AR','扩展AP','存货')]
        flows=[total([cell(x,'单季度'+k+'（元）') for x in window[1:]]) for k in ('营业收入','营业成本')]
        if width==4 and None not in flows:
            # Independent TTM identity. Full-year Q4, or prior FY + current YTD - comparable prior YTD.
            for flow,key in zip(flows,('营业收入','营业成本')):
                col='累计'+key+'（元）'
                recent=cell(window[-1],col)
                prev_year=cell(window[0],col)
                bridge=cell(lookup[(code,q-(q%4+1))],col) if q%4!=3 else None
                check(flow,recent if q%4==3 else recent+bridge-prev_year,where+(key,))
        check(int(row['天数']),length,where+('days',))
        for k,v in zip(('加权AR余额（元）','加权AP余额（元）','加权存货（元）','分母营业收入（元）','分母营业成本（元）'),avg+flows):
            check(cell(row,k),v,where+(k,))
        metrics_check(row,metrics(avg,flows,length),where,chart[where])
        counts[(mode,'有CCC' if row['CCC days'] else '空缺')]+=1
    return len(raw),len(data),dict(counts)
def overseas(folder):
    raw=read(folder,'overseas-inputs')
    data=read(folder,'overseas-working-capital')
    lookup=index(raw,lambda row:(row['代码'],index_half(row['期末'])))
    display=json.loads((folder/'overseas.json').read_text())
    chart={(r['code'],r['period'],r['mode']):r['values'] for r in display['rows']}
    assert len(chart)==len(data)
    counts=Counter()
    for row in data:
        code,end,mode=(row[k] for k in ('代码','期末','口径'))
        where=(code,end,mode)
        i=index_half(end)
        ttm=mode.startswith('TTM')
        yearly=mode.startswith('全年')
        offsets=(2,1,0) if ttm else (2,0) if yearly else (1,0)
        window=[lookup[code,i-offset] for offset in offsets]
        assert all(x['原币']==row['原币'] for x in window),where
        length=365 if ttm else (date.fromisoformat(end)-date.fromisoformat(window[0]['期末'])).days
        def mean(key):
            values=[cell(r,key) for r in window]
            if None not in values:
                return sum((a+b)/2 for a,b in zip(values,values[1:]))/(len(values)-1)
        def flow(key):
            values=[cell(r,key) for r in window]
            if ttm and not i%2:return total([values[2],values[1],-values[0] if values[0] is not None else None])
            if not (yearly or ttm) and i%2:return values[1]-values[0] if None not in values else None
            return values[-1]
        avg=[mean(k) for k in ('贸易应收','贸易应付','存货')]
        flows=[flow(k) for k in ('当年累计收入','当年累计营业成本')]
        check(int(row['天数']),length,where+('days',))
        for k,v in zip(('平均应收','平均应付','平均存货','期间收入','期间成本'),avg+flows):
            check(cell(row,k),v,where+(k,))
        metrics_check(row,metrics(avg,flows,length),where,chart[where])
        counts[(mode,'有CCC' if row['CCC days'] else '空缺')]+=1
    return len(raw),len(data),dict(counts)

if __name__=='__main__':
    for group in ('pharmacy','blood-products','vaccines','ophthalmology'):
        folder=SITE/group
        print(group,local(folder))
        if group in ('vaccines','ophthalmology'):
            print('HK/US',overseas(folder))
