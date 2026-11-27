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
    aliases={"product":("产品名称",),"batch":("批号",),"expiry":("有效期至","有效期"),
             "mah":("上市许可持有人","上市许可持有人名称"),
             "manufacturer":("生产企业","生产企业名称","生产单位"),
             "certificate":("证书编号",),"outcome":("签发结论","批签发结论"),
             "issuer":("批签发机构",),"issued":("签发日期","批签发日期"),"receipt":("收检编号",)}
    for table in soup.find_all("table"):
        rows=[[cell.get_text(" ",strip=True) for cell in tr.find_all(["th","td"],recursive=False)]
              for tr in table.find_all("tr") if tr.find_parent("table") is table]
        header_at=next((i for i,row in enumerate(rows) if {"产品名称","批号","证书编号"}<=set(row)),None)
        if header_at is None:
            continue
        seen_header=True
        cols=rows[header_at]
        positions={field:next((cols.index(label) for label in labels if label in cols),None)
                   for field,labels in aliases.items()}
        if any(positions[name] is None for name in ("product","batch","certificate","outcome","issuer")):
            raise ValueError("Missing batch certificate heading")
        for row in rows[header_at+1:]:
            if not row:
                continue
            if len(row)!=len(cols) or not row[0].isdigit():
                raise ValueError("A batch-release table changed layout")
            found.append({field:row[pos] if pos is not None else "" for field,pos in positions.items()})
    if not seen_header:
        raise ValueError("No recognizable batch-release table")
    return found


def issued_date(raw):
    text=unicodedata.normalize("NFKC",raw).strip()
    token=re.fullmatch(r"(20\d\d)[年. /-]\s*(\d{1,2})[月. /-]\s*(\d{1,2})日?",text)
    if not token:
        return None
    return date(*map(int,token.groups())).isoformat()
