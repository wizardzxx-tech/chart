import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from research.financial_periods import quarterly,extended
from research.lot import summarize
from research.nhsa import validate
from validators.data import validate_records, ValidationFailed
from updaters.trade_values import normalize
from updaters.cms_values import part_d


class ResearchContracts(unittest.TestCase):
    def test_legacy_turnover_uses_five_balances_and_ytd(self):
        rows=[dict(period=f"2025-{m}",revenue=i*100,cost=i*80,ar=i*10,ap=i*8,inventory=i*20)
              for i,m in enumerate(("03-31","06-30","09-30","12-31"),start=1)]
        rows.insert(0,dict(period="2024-12-31",ar=0,ap=0,inventory=0))
        result=quarterly(rows)[-1]
        q=result["quarter"]
        t=result["ttm"]
        self.assertEqual(q["revenue"],100)
        self.assertEqual(t["revenue"],400)
        self.assertAlmostEqual(t["dso"],20/400*365)
        self.assertAlmostEqual(t["ccc"],t["dso"]+t["dio"]-t["dpo"])
        self.assertAlmostEqual(q["gross_margin"],.2)
        self.assertIsNone(extended(5,None,None,3))
        self.assertEqual(extended(5,2,7,3),10)

    def test_nhsa_components_and_scope(self):
        trusted={"total_income":"25254.31","employee_income":"16068.86","resident_income":"9185.44",
                 "total_spending":"19357.74","employee_spending":"11166.52","resident_spending":"8191.22",
                 "maternity_spending":"1112.54"}
        self.assertTrue(validate(trusted,None))
        with self.assertRaises(ValueError):
            validate({**trusted,"resident_income":"91854.44"},None)

    def test_lot_identity_is_not_a_row_count(self):
        row={"certificate":"批签中检20263017","issuer":"中国药品检定研究院","product":"流感疫苗","batch":"A1",
             "mah":"示例持有人","outcome":"予以签发"}
        result=summarize([row,row],("2026-11-09","2026-11-15"),"center")
        self.assertEqual(result["audited_batches"],1)
        self.assertEqual(result["duplicate_rows"],1)
        with self.assertRaises(ValueError):
            summarize([row,row|{"batch":"different"}],("2026-11-09","2026-11-15"),"center")

    def test_trade_receipt_hash_is_not_a_historical_value(self):
        old = {"id":"x", "period":"2025-01-01", "basis":"annual", "source":"https://example.org/",
               "amount":100, "provenance":{"sha256":"a"}}
        candidate = old | {"provenance":{"sha256":"b"}}
        spec = {"contract":{"comparison_metadata":["provenance"]}}
        merged, changed, revisions = validate_records(spec,[candidate],[old],"2026-11-27")
        self.assertEqual(merged,[old])
        self.assertEqual(changed,[])
        self.assertEqual(revisions,[])
        with self.assertRaises(ValidationFailed):
            validate_records(spec,[candidate|{"amount":101}],[old],"2026-11-27")

    def test_trade_completeness_and_kilogram_price(self):
        base={"reporterCode":156,"period":2025,"cmdCode":"30024100","flowCode":"X",
              "customsCode":"-1","motCode":-1,"partner2Code":-1,"qtyUnitCode":8,"altQtyUnitCode":8,
              "primaryValue":40,"fobvalue":40,"netWgt":10}
        payload={"count":2,"data":[base|{"partnerCode":0},base|{"partnerCode":1}]}
        self.assertEqual(normalize(payload,"2025","30024100","X","kg")["asp"],4)
        with self.assertRaises(ValueError):
            normalize({"count":500,"data":payload["data"]*250},"2025","30024100","X","kg")
        with self.assertRaises(ValueError):
            normalize({"count":2,"data":[base|{"partnerCode":0},base|{"partnerCode":1,"primaryValue":400,"fobvalue":400}]},
                      "2025","30024100","X","kg")
