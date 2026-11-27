"""Period conversion and turnover rules shared with the site's legacy CCC series."""
from calendar import monthrange
from datetime import date

FLOWS = ("revenue","cost","net_profit","operating_cash_flow","capex","selling","admin","rd","finance")
BALANCES = ("ar","inventory","ap")


def index(value):
    return value.year*4 + (value.month-1)//3


def quarter_end(i):
    year, quarter = divmod(i,4)
    month = (quarter+1)*3
    return date(year,month,monthrange(year,month)[1])


def extended(receivables, notes, combined, financing=None):
    if combined is not None:
        if receivables is not None and notes is not None and abs(combined-receivables-notes) > max(1, abs(combined)*.000001):
            raise ValueError("Combined bills and trade balance disagree with the components")
        return combined + (financing or 0)
    if receivables is not None and notes is not None:
        return receivables + notes + (financing or 0)
    return None


def subtract(a,b):
    return a-b if a is not None and b is not None else None


def sum_complete(values):
    values=list(values)
    return sum(values) if values and None not in values else None


def ratios(flow, balances, days):
    rev, cost = flow.get("revenue"),flow.get("cost")
    ar, inventory, ap = (balances.get(k) for k in BALANCES)
    dso = days*ar/rev if ar is not None and rev and rev>0 else None
    dio = days*inventory/cost if inventory is not None and cost and cost>0 else None
    dpo = days*ap/cost if ap is not None and cost and cost>0 else None
    ccc = dso+dio-dpo if None not in (dso,dio,dpo) else None
    expense_fields=[k for k in ("selling","admin","rd","finance","sga") if k in flow]
    return {"gross_margin":(rev-cost)/rev if rev and rev>0 and cost is not None else None,
            "expenses":{k:flow[k]/rev if rev and rev>0 and flow[k] is not None else None
                        for k in expense_fields},
            "dso":dso,"dio":dio,"dpo":dpo,"ccc":ccc}


def quarterly(rows):
    """Use fiscal YTD inputs at standard calendar quarter ends; null gaps prevent inference."""
    lookup = {}
    for item in rows:
        end = date.fromisoformat(item["period"])
        i = index(end)
        if end != quarter_end(i) or i in lookup:
            raise ValueError("Non-calendar or duplicate quarter in calendar reporting series")
        lookup[i] = item
    fields=FLOWS+("sga",) if any("sga" in row for row in rows) else FLOWS
    flows={}
    for i,row in sorted(lookup.items()):
        prior=lookup.get(i-1,{})
        flows[i]={key: row.get(key) if i%4 == 0 else subtract(row.get(key),prior.get(key)) for key in fields}
    out=[]
    for i,row in sorted(lookup.items()):
        modes={}
        for width, name in ((1,"quarter"),(4,"ttm")):
            window = [lookup.get(j,{}) for j in range(i-width,i+1)]
            balances={}
            for key in BALANCES:
                values=[snapshot.get(key) for snapshot in window]
                balances[key] = None if None in values else sum((a+b)/2 for a,b in zip(values,values[1:]))/width
            flow={field:sum_complete([flows.get(j,{}).get(field) for j in range(i-width+1,i+1)]) for field in fields}
            days=365 if width==4 else (quarter_end(i)-quarter_end(i-1)).days
            modes[name]={**flow,"days":days,**ratios(flow,balances,days)}
        out.append({**row,**modes})
    return out
