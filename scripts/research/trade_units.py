"""Unit and quantity quality rules reused from the published customs charts."""

def metric(row, basis):
    fields = [('qty',row['qtyUnitCode'],'isQtyEstimated'),
              ('altQty',row['altQtyUnitCode'],'isAltQtyEstimated')]
    accepted = 8 if basis=='kg' else 5
    if basis=='kg':
        fields = [('netWgt',8,'isNetWgtEstimated')]+fields
    for key,unit,flag in fields:
        if unit==accepted and (row.get(key) or 0)>0:
            flag_state=row.get(flag)
            return row[key], '估算' if flag_state is True else '原表' if flag_state is False else '估算状态未提供', key
    return None,'缺有效数量',None

def quantity_quality(records, qty):
    if not qty:
        return '缺有效数量'
    for state in ('估算','估算状态未提供'):
        if any(r[2]==state for r in records):
            return state
    return '原表'
