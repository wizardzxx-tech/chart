import json
from pathlib import Path
import tempfile
import unittest
from datetime import datetime

import pandas as pd

from update import cny_cap, eligible_end, fx_cross, read_history, validate_prices, valuation, write_output


class TrackerTests(unittest.TestCase):
    def test_fx_and_stake_value(self):
        self.assertAlmostEqual(fx_cross(7.9, 8.6), 7.9 / 8.6)
        self.assertAlmostEqual(cny_cap(470.2, 124547255, .91), 53.29152856391)
        self.assertEqual(cny_cap(28, 1_500_000_000), 42)

    def test_observable_metrics_allow_negative_residual(self):
        self.assertEqual(valuation(40, 50), {"listed": 50, "residual": -10, "coverage": 1.25})
        self.assertEqual(valuation(40, None), {"listed": None, "residual": None, "coverage": None})

    def test_history_and_placement(self):
        rows = read_history()
        self.assertEqual({r["asset"] for r in rows}, {"kelun", "skb", "cn", "ssy", "cisen"})
        skb = next(r for r in rows if r["asset"] == "skb" and r["effective"] == "2026-07-10")
        self.assertAlmostEqual(skb["economic_shares"] / skb["shares"], .5211, places=4)

    def test_incomplete_session_excluded(self):
        self.assertEqual(eligible_end(datetime(2026, 11, 27, 15, 0)), pd.Timestamp("2026-11-26"))
        self.assertEqual(eligible_end(datetime(2026, 11, 27, 17, 30)), pd.Timestamp("2026-11-27"))

    def test_validate_prices(self):
        base = {"asset":"kelun","date":"2026-11-26","close":30,"provider":"test"}
        end = pd.Timestamp("2026-11-26")
        self.assertEqual(len(validate_prices(pd.DataFrame([base, base]), end)), 1)
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            validate_prices(pd.DataFrame([base, {**base, "close":31}]), end)
        with self.assertRaisesRegex(ValueError, "Invalid"):
            validate_prices(pd.DataFrame([{**base, "close":-1}]), end)

    def test_bad_refresh_preserves_prior_files(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder)
            prior = {"metadata":{"kelun":{"last_trade":"2026-11-26","rows":400}}}
            (target / "tracker.json").write_text(json.dumps(prior))
            (target / "daily.csv").write_text("prior")
            bad = {"metadata":{"kelun":{"last_trade":"2026-11-25","rows":400}}}
            with self.assertRaisesRegex(ValueError, "regressed"):
                write_output(target, bad)
            self.assertEqual(json.loads((target / "tracker.json").read_text()), prior)
            self.assertEqual((target / "daily.csv").read_text(), "prior")


if __name__ == "__main__":
    unittest.main()
