"""Search molecules together with named sponsors and route candidates to review."""
import json
import re


def collect(spec,http,start,end):
    known=set(spec["trial_ids"])
    out=[]
    for molecule,sponsor in spec["queries"]:
        url=spec["source_url"]+"/studies"
        token=None
        visited=set()
        for _ in range(3):
            params={"query.intr":molecule,"query.spons":sponsor,"pageSize":100,"countTotal":"true"}
            if token:params["pageToken"]=token
            result=json.loads(http.get(url,params=params))
            for item in result.get("studies",[]):
                protocol=item["protocolSection"]
                identity=protocol["identificationModule"]
                nct=identity["nctId"]
                stamp=protocol["statusModule"]["lastUpdatePostDateStruct"]["date"]
                start_filter=max(start,spec["review_since"])
                if nct not in known and start_filter<=stamp<=end and re.fullmatch(r"NCT\d{8}",nct):
                    known.add(nct)
                    out.append({"url":f"https://clinicaltrials.gov/study/{nct}","title":identity["briefTitle"],
                                "published": stamp,"period":stamp,"indicators":f"{molecule} / {sponsor}"})
            token=result.get("nextPageToken")
            if not token:break
            if token in visited:raise ValueError("ClinicalTrials.gov returned a duplicate page token")
            visited.add(token)
        if token:raise ValueError(f"Search pagination cap reached: {molecule}")
    return {"notices":out}
