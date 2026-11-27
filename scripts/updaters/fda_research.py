"""FDA action history with approval kind and verified reference mapping."""
from datetime import datetime
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[2]


def clean(text):
    return re.sub(r"[^a-z0-9]+"," ",text.casefold()).strip()


def collect(spec,http,start,end):
    html=(ROOT/"v2/biosimilars/index.html").read_text()
    curated=json.loads(re.search(r'<script id="snapshot" type="application/json">(.*?)</script>',html,re.S)[1])
    existing={r["code"]:r for r in curated["approvals"] if r["region"]=="US" and str(r.get("code","")).startswith("BLA")}
    products = {clean(x["name"]): x for x in curated["molecules"].values()}
    products.update({clean(name):{"name":name,"reference":""} for name in spec.get("additional_molecules",[]) if clean(name) not in products})
    apps={}
    terms=sorted(products)
    clauses=[" OR ".join(f'products.active_ingredients.name.exact:"{term.upper()}"'
                          for term in terms[i:i+8]) for i in range(0,len(terms),8)]
    known=sorted(existing)
    clauses.extend("application_number:("+" OR ".join(known[i:i+25])+")"
                   for i in range(0,len(known),25))
    for clause in clauses:
        skip=0
        total=None
        while total is None or skip<total:
            raw=http.get(spec["source_url"],params={"search":clause,"limit":100,"skip":skip},missing=404)
            if raw is None and skip==0:
                break
            if raw is None:
                raise ValueError("FDA paging ended before the declared total")
            page=json.loads(raw)
            count=page["meta"]["results"]["total"]
            if total is not None and total!=count:
                raise ValueError("FDA result count changed during pagination")
            total=count
            results=page["results"]
            if total>2000 or not results or skip+len(results)>total:
                raise ValueError("FDA results are incomplete")
            for item in results:
                key=item["application_number"]
                if key in apps and apps[key]!=item:
                    raise ValueError("Conflicting FDA application snapshots")
                apps[key]=item
            skip+=len(results)
    by_key={}
    for app,item in sorted(apps.items()):
        code=re.fullmatch(r"(ANDA|NDA|BLA)\d{6}",app)
        if not code:
            raise ValueError("Unexpected FDA application number")
        names={clean(x["name"]) for p in item.get("products",[]) for x in p.get("active_ingredients",[])}
        base={name for name in names if name in products}
        base |= {term for term in products if any(re.fullmatch(re.escape(term)+r" [a-z]{4}", name) for name in names)}
        if not base and app not in existing:
            continue
        brands=sorted({p["brand_name"] for p in item.get("products",[]) if p.get("brand_name")})
        listed=existing.get(app)
        if listed:
            brand, molecule=(listed["brand"],listed["molecule"])
        else:
            brand,molecule=(" / ".join(brands)," + ".join(sorted(base)))
        references={clean(x) for n in base for x in re.split(r"\s*/\s*",products[n].get("reference") or "") if x}
        brand_is_reference=any(clean(x) in references for x in brands)
        is_curated_follow_on=listed and listed.get("reference") and clean(brand) not in {
            clean(x) for x in listed["reference"].split("/")}
        classification="reference" if brand_is_reference else "biosimilar" if is_curated_follow_on else "unverified"
        source="https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo="+app[-6:]
        approved=[x for x in item.get("submissions",[]) if x.get("submission_status")=="AP" and re.fullmatch(r"\d{8}",x.get("submission_status_date") or "")]
        first=min([x["submission_status_date"] for x in approved if x["submission_type"]=="ORIG"],default=None)
        for action in approved:
            day=datetime.strptime(action["submission_status_date"],"%Y%m%d").date().isoformat()
            if not start<=day<=end:
                continue
            kind=action["submission_type"]
            label="supplement" if kind=="SUPPL" else "initial" if kind=="ORIG" and action["submission_status_date"]==first else "other"
            key=f'{app}/{kind}/{action["submission_number"]}/{day}'
            record={"id":key,"period":day,"application":app,"molecule":molecule,"brand":brand,"action_kind":label,
                    "category":classification,"reference_source":listed["source"] if listed else None,
                    "source":source,"basis":"FDA approved submission action"}
            if key in by_key and by_key[key]!=record:
                raise ValueError("Conflicting FDA actions")
            by_key[key]=record
    return {"records":list(by_key.values())}
