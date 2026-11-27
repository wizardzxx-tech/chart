"""Review extracted operating metrics against normalized site evidence."""
from datetime import date
from hashlib import sha256
import csv
import json
from functools import lru_cache
from decimal import Decimal
import re

from updaters.operating_metrics import ROOT,TARGET,extract,pages,period_of,schema


def rows():
    return json.loads((ROOT/TARGET).read_text())["records"]


@lru_cache(maxsize=8)
def csv_records(relative):
    with (ROOT/"v2"/relative).open(encoding="utf-8-sig",newline="") as stream:
        return list(csv.DictReader(stream))


def legacy_value(record,stamp):
    company=record["ticker"]
    metric=record["metric"]
    year,md=stamp[:4],stamp[5:]
    stores={"direct_stores":"期末直营","franchise_stores":"期末加盟",
            "open_stores":"单季新开／直营新增","closed_stores":"单季关闭"}
    blood={"plasma_collection":"采浆量（吨）","plasma_all_stations":"浆站总数",
           "plasma_active_stations":"执业／在营站数"}
    eye={"eye_visits":"outpatients","eye_surgeries":"surgeries"}
    if company=="603939.SH" and metric in stores and md=="09-30":
        found=next((r for r in csv_records("pharmacy/company-stores.csv")
                    if r["代码"]=="603939" and r["季度"]==year+"Q3"),None)
        if found and found[stores[metric]]:
            source=re.search(r"https://[^\s；]+",found["来源及计算依据"])
            return {"value":float(found[stores[metric]]),"source":source[0] if source else None}
    if company=="600161.SH" and metric in blood and md=="12-31":
        found=next((r for r in csv_records("blood-products/company-plasma.csv")
                    if r["代码"]=="600161" and r["财年"]==year),None)
        if found and found[blood[metric]]:
            source=re.search(r"https://[^\s；]+",found["来源"])
            return {"value":float(found[blood[metric]]),"source":source[0] if source else None}
    if company=="300015.SZ" and metric in eye and md=="06-30":
        found=next((r for r in csv_records("ophthalmology/company-activity.csv")
                    if r["code"]=="300015" and r["period"]==year+"H1"),None)
        key=eye[metric]
        if found and found[key+"_value"] and found[key+"_qualifier"]=="披露值" and found[key+"_unit"]==record["unit"]:
            return {"value":float(found[key+"_value"]),"source":found[key+"_source"]}
    return None


def compare(record, existing):
    old=next((r for r in existing if r["id"]==record["id"]),None)
    stamp=date.fromisoformat(record["period"])
    prior=next((r for r in existing if r["ticker"]==record["ticker"] and r["metric"]==record["metric"]
                and r["period_kind"]==record["period_kind"] and r["scope"]==record["scope"]
                and r["unit"]==record["unit"] and r["period"]==f"{stamp.year-1}-{stamp:%m-%d}"),None)
    old=old or legacy_value(record,record["period"])
    prior=prior or legacy_value(record,f"{stamp.year-1}-{stamp:%m-%d}")
    yoy=(record["value"]/prior["value"]-1)*100 if prior and prior["value"]>0 else None
    return {"before":old["value"] if old else None,"after":record["value"],
            "year_ago":prior["value"] if prior else None,"yoy_pct":yoy,
            "prior_source":prior.get("source") if prior else None}


def manual_candidates(task,raw,evidence):
    """Verify a human- or AI-assisted draft against an exact PDF version."""
    digest=sha256(raw).hexdigest()
    if evidence.get("pdf_sha256")!=digest:
        raise ValueError("人工补录的 PDF 版本与官方原件不一致")
    stamp,mode=period_of(task["document_title"])
    if stamp!=task["period"] or mode is None:
        raise ValueError("人工补录的报告期未得到原公告标题支持")
    original=pages(raw)
    definitions=schema()["metrics"]
    accepted=[]
    scale={"家":("家",1),"吨":("吨",1),"人次":("人次",1),"万人次":("人次",10000),
          "例":("例",1),"万例":("例",10000),"支":("支",1),"万支":("支",10000),
          "台":("台",1),"元":("元",1),"万元":("元",10000),"亿元":("元",100000000)}
    for line in evidence["records"]:
        metric=line["metric"]
        topic,label,unit,declared,default_scope=definitions[metric]
        page=line["page"]
        if not isinstance(page,int) or not 1<=page<=len(original):
            raise ValueError("人工补录的 PDF 页码无效")
        excerpt=" ".join(line["excerpt"].split())
        if not excerpt or len(excerpt)>110 or excerpt not in " ".join(original[page-1].split()):
            raise ValueError("人工补录的原文片段未出现在指定 PDF 页")
        printed=str(line["printed_value"])
        if not re.fullmatch(r"\d[\d,.]*",printed) or not re.search(rf"(?<![\d.,]){re.escape(printed)}(?![\d.,])",excerpt):
            raise ValueError("人工补录数值未出现在已定位的原文片段")
        target_unit,factor=scale[line["printed_unit"]]
        if target_unit!=unit or line["period_kind"]!=(mode if declared=="reported" else declared):
            raise ValueError("人工补录的单位或期间与指标定义不符")
        scope=line["scope"].strip()
        if not scope:
            raise ValueError("请记录原文所支持的合并或产品口径")
        accepted.append({"id":f'{task["ticker"]}/{stamp}/{metric}/{line["period_kind"]}',
            "period":stamp,"topic":topic,"ticker":task["ticker"],"metric":metric,"label":label,
            "unit":unit,"period_kind":line["period_kind"],"scope":scope,
            "value":float(Decimal(printed.replace(",",""))*factor),"page":page,"excerpt":excerpt,
            "source":task["url"],"published":task["published"],"pdf_sha256":digest,
            "extraction":"reviewed_draft"})
    if not accepted or len({x["id"] for x in accepted})!=len(accepted):
        raise ValueError("人工补录记录为空或重复")
    return accepted


def prepare(task_id,task,read,checked):
    raw=read(task["url"])
    draft=ROOT/"config/operating-review-inputs"/f"{task_id}.json"
    if draft.is_file():
        candidates=manual_candidates(task,raw,json.loads(draft.read_text()))
    else:
        if task.get("dataset_checksum")!=sha256(raw).hexdigest():
            raise ValueError("PDF 版本已变更或需要补足人工取值证据")
        candidates=extract(task["ticker"],task["document_title"],task["published"],task["url"],raw)
        if not candidates or candidates!=task["candidates"]:
            raise ValueError("取值和审核队列内容发生变化，请复核最新版")
    existing=rows()
    current={item["id"]:item for item in existing}
    return {"receipt_version":2,"task_id":task_id,"dataset_id":task["dataset_id"],"source":task["url"],
            "write_targets":[TARGET],"old":{r["id"]:current.get(r["id"]) for r in candidates},
            "candidate":{"period":task["period"],"source":task["url"],"records":candidates},
            "diff":{r["id"]:compare(r,existing) for r in candidates},"files":list(checked.values()),
            "validation":{"passed":True,"adapter":"operating_metrics"}}
