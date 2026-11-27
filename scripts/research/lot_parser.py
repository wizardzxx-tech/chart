"""Common notice dates from the historical NIFDC collector."""
from datetime import date
import re
import unicodedata

DATE = re.compile(r'(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日')

def interval(title):
    title = unicodedata.normalize('NFKC', title)
    points = DATE.findall(title)
    if len(points) == 1 and points[0][0]:
        point = date(*map(int, points[0]))
        return point.isoformat(), point.isoformat()
    if len(points) != 2 or not points[0][0]:
        return None
    try:
        y,m,d = map(int,points[0])
        y2,m2,d2 = points[1]
        start = date(y,m,d)
        end = date(int(y2) if y2 else y + (int(m2)<m),int(m2),int(d2))
    except ValueError:
        return None
    return (start.isoformat(),end.isoformat()) if end>=start else None


def parse_tables(soup):
    found=[]
    seen_header=False
    for table in soup.find_all("table"):
        rows=[[cell.get_text(" ",strip=True) for cell in tr.find_all(["th","td"],recursive=False)]
              for tr in table.find_all("tr") if tr.find_parent("table") is table]
        header_at=next((i for i,row in enumerate(rows) if {"产品名称","批号","证书编号"}<=set(row)),None)
        if header_at is None:
            continue
        seen_header=True
        columns=rows[header_at]
        manufacturer_at=next((i for i,name in enumerate(columns)
                              if name in ("生产企业","生产企业名称","生产单位")),None)
        for row in rows[header_at+1:]:
            if not row:
                continue
            if len(row) not in (8,13) or not row[0].isdigit():
                raise ValueError("A batch-release table changed layout")
            if len(row)==8:
                _,product,batch,expiry,mah,certificate,outcome,issuer=row
                issued=receipt=""
            else:
                _,product,_,batch,_,expiry,mah,receipt,certificate,_,issued,outcome,issuer=row
            found.append(dict(product=product,batch=batch,expiry=expiry,mah=mah,certificate=certificate,
                   outcome=outcome,issuer=issuer,issued=issued,receipt=receipt,
                   manufacturer=row[manufacturer_at] if manufacturer_at is not None else ""))
    if not seen_header:
        raise ValueError("No recognizable batch-release table")
    return found
