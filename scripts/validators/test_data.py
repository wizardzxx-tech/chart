from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from data_update import load_registry, ROOT
from build.audit import verify_inventory
from updaters.notices import notices_from_html, reporting_end
from updaters.comtrade import periods
from validators.data import ValidationFailed, validate_records


class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.row = {"id": "2026-09", "period": "2026-09-30", "unit": "ten thousand visits",
                    "basis": "monthly", "source": "https://example.gov/stat", "total": 40,
                    "public": 35, "private": 5}
        self.contract = {"contract": {"allowed": {"unit": ["ten thousand visits"]},
                          "monthly_continuity": True, "totals": {"total": ["public","private"]}}}

    def check(self, rows, old=None):
        return validate_records(self.contract, rows, old or [], "2026-12-01")

    def test_identical_dedup_and_conflicting_rejection(self):
        self.assertEqual(self.check([self.row, self.row])[0], [self.row])
        with self.assertRaises(ValidationFailed):
            self.check([self.row, self.row | {"total": 42}])

    def test_continuity_revision_unit_and_scope(self):
        for item in [{"total": 42}, {"unit": "million visits"}, {"basis": "cumulative"},
                     {"source": "http://example.gov/stat"}, {"id":"2026-11", "period":"2026-11-30"}]:
            with self.subTest(item=item), self.assertRaises(ValidationFailed):
                self.check([self.row | item], [self.row])

    def test_official_revision_yields_before_and_after(self):
        self.contract["contract"]["accept_revisions"] = True
        original = self.row | {"official_revision": None}
        updated = self.row | {"total": 41, "private": 6, "official_revision":"https://example.gov/correction"}
        result, changed, revisions = self.check([updated], [original])
        self.assertEqual(result, changed)
        self.assertEqual(revisions[0]["before"], original)
        self.assertEqual(revisions[0]["after"], updated)

    def test_known_registry_files_and_sections(self):
        registry = load_registry()
        verify_inventory(ROOT, registry)
        homepage = (ROOT / "v2/index.html").read_text()
        for row in registry:
            self.assertIn(f'id="topic-{row["topic"]}"', homepage)
            self.assertIn(f'id="{row["section"]}"', (ROOT / "v2" / row["topic"] / "index.html").read_text())


class AdapterTests(unittest.TestCase):
    def test_nhsa_cdata_and_month_scope(self):
        html = '<script type="text/xml"><record><![CDATA[<li><a href="/art/2026/11/24/a.html">2026年1-10月基本医疗保险统筹基金和生育保险主要指标</a><span>2026-11-24</span></li>]]></record></script>'
        items = notices_from_html(html.encode(), "https://www.nhsa.gov.cn/col/col7/index.html", "统筹基金")
        self.assertEqual(items[0]["published"], "2026-11-24")
        self.assertEqual(reporting_end(items[0]["title"], items[0]["published"]), "2026-10-31")

    def test_notice_date_spans_calendar_year(self):
        title = "中检院生物制品批签发信息公示表(签发日期:2026年12月28日至1月3日)"
        self.assertEqual(reporting_end(title, "2027-01-05"), "2027-01-03")

    def test_customs_periods(self):
        self.assertEqual(periods("2025-12-11","2026-02-20","M"), ["202512", "202601", "202602"])
