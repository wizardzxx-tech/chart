"""Refresh a Kelun tracker dataset. Unlicensed source mode only writes local files."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from io import StringIO
import json
import os
from pathlib import Path
import tempfile
import time
from zoneinfo import ZoneInfo

import exchange_calendars as calendars
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "kelun-tracker"
START = pd.Timestamp("2023-07-11")
SHANGHAI = ZoneInfo("Asia/Shanghai")
UNIVERSE = json.loads((SITE / "config/universe.json").read_text())
HISTORY = SITE / "config/ownership.json"
FX_URL = "https://data-api.ecb.europa.eu/service/data/EXR/D.CNY+HKD.EUR.SP00.A"
LOCAL_SOURCES = {"AKShare / Eastmoney": "https://quote.eastmoney.com/",
                 "Yahoo Finance": "https://finance.yahoo.com/"}
FX_SOURCE = "https://www.ecb.europa.eu/stats/exchange_rates/html/index.en.html"
YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/"
PRICE_COLUMNS = ["asset", "date", "close", "provider"]
EVENT_COLUMNS = ["asset", "date", "type", "amount", "numerator", "denominator"]
TRACKED = [a["id"] for a in UNIVERSE if a["kind"] in ("parent", "investee")]
INVESTEES = TRACKED[1:]


def request(url, **kwargs):
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=(5, 18), headers={"User-Agent": "Mozilla/5.0"}, **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def read_history():
    history = json.loads(HISTORY.read_text())
    seen = set()
    for row in history:
        key = row["asset"], row["effective"]
        assert key not in seen and key[0] in TRACKED
        seen.add(key)
        assert pd.Timestamp(row["effective"]) <= pd.Timestamp(row["disclosed"])
        assert row["source"].startswith("https://")
        if row.get("shares") is not None:
            assert isinstance(row["shares"], int) and row["shares"] > 0
        if row.get("economic_shares") is not None:
            assert isinstance(row["economic_shares"], int) and row["economic_shares"] >= 0
            assert row.get("shares") is None or row["economic_shares"] <= row["shares"]
        if row.get("economic_pct") is not None:
            assert 0 <= row["economic_pct"] <= 1
    return history


def eligible_end(now):
    date = pd.Timestamp(now.date())
    return date if now.hour > 17 or (now.hour == 17 and now.minute >= 20) else date - pd.Timedelta(days=1)


def exchange_sessions(end):
    return {market: calendars.get_calendar(market, start=START, end=end).sessions
            for market in {a["market"] for a in UNIVERSE}}


def akshare_prices(a, start, end):
    import akshare as ak
    function = ak.stock_hk_hist if a["market"] == "XHKG" else ak.stock_zh_a_hist
    data = function(symbol=a["secid"].split(".")[1], period="daily",
                    start_date=start.strftime("%Y%m%d"), end_date=end.strftime("%Y%m%d"), adjust="")
    return data.assign(date=pd.to_datetime(data["日期"]).dt.strftime("%Y-%m-%d")).set_index("date").rename(
        columns={"收盘": "close"})[["close"]].assign(provider="AKShare / Eastmoney")


def yahoo(a, start, end):
    ticker = a["ticker"].replace(".SH", ".SS")
    point = lambda day: int(day.tz_localize(SHANGHAI).timestamp())
    response = request(YAHOO + ticker, params={
        "period1": point(start), "period2": point(end + pd.Timedelta(days=1)),
        "interval": "1d", "events": "div,splits",
    }).json()["chart"]["result"][0]
    if response["meta"]["symbol"] != ticker or response["meta"]["currency"] != a["currency"]:
        raise ValueError("Yahoo instrument or quote currency mismatch")

    def date(value):
        return datetime.fromtimestamp(value, SHANGHAI).date().isoformat()
    idx = [date(v) for v in response["timestamp"]]
    frame = pd.DataFrame({"close": response["indicators"]["quote"][0]["close"],
                          "provider": "Yahoo Finance"}, index=idx).dropna(subset=["close"])
    actions = []
    for category, events in response.get("events", {}).items():
        for event in events.values():
            actions.append({"asset": a["id"], "date": date(event["date"]), "type": category,
                            "amount": event.get("amount"), "numerator": event.get("numerator"),
                            "denominator": event.get("denominator")})
    return frame, actions


def safe_yahoo(a, start, end):
    try:
        return yahoo(a, start, end)
    except (requests.RequestException, KeyError, ValueError, TypeError, IndexError):
        return None, None


def validate_prices(frame, end, start=START):
    data = frame[PRICE_COLUMNS + (["source_url"] if "source_url" in frame else [])].copy()
    data["date"] = pd.to_datetime(data["date"], format="%Y-%m-%d", errors="raise").dt.normalize()
    data["close"] = pd.to_numeric(data["close"], errors="coerce")
    if data["close"].isna().any() or (~data["close"].between(0, 1e7, inclusive="right")).any():
        raise ValueError("Invalid closing price")
    if not data["asset"].isin([a["id"] for a in UNIVERSE]).all():
        raise ValueError("Unknown instrument")
    if data[["asset", "provider", "date"]].isna().any().any():
        raise ValueError("Missing market data identifier, source, or date")
    data = data.loc[data["date"].between(start, end)]
    data = data.drop_duplicates()
    if data.duplicated(["asset", "date"]).any():
        raise ValueError("Conflicting observations for an asset and date")
    return data.sort_values(["asset", "date"])


def local_history(end, sessions, start=START):
    def one(a):
        expected = sessions[a["market"]]
        expected = expected[expected >= start]
        chosen = None
        try:
            candidate = akshare_prices(a, start, end)
            # Treat an incomplete series as a source error. Fall back for the entire instrument.
            if len(candidate.dropna()) >= len(expected) * .94 and candidate.index.max() >= expected[-1].strftime("%Y-%m-%d"):
                chosen = candidate
        except Exception as error:
            print(f"{a['ticker']} primary: {type(error).__name__}", flush=True)
        alternative, actions = safe_yahoo(a, start, end)
        if chosen is None:
            chosen = alternative
        if chosen is None or chosen.empty:
            raise RuntimeError(f"No market history available for {a['ticker']}")
        frame = chosen.rename_axis("date").reset_index().assign(asset=a["id"])
        print(f"{a['ticker']} {frame['provider'].iloc[0]} {len(frame)} bars, actions: "
              f"{len(actions) if actions is not None else 'unavailable'}", flush=True)
        frame["source_url"] = frame["provider"].map(LOCAL_SOURCES)
        return frame, actions or []
    with ThreadPoolExecutor(max_workers=4) as executor:
        batches = list(executor.map(one, UNIVERSE))
    return pd.concat([frame for frame, _ in batches]), [action for _, actions in batches for action in actions]


def fx_cross(cny_per_eur, hkd_per_eur):
    return cny_per_eur / hkd_per_eur


def fetch_fx(end):
    raw = request(FX_URL, params={"startPeriod": "2023-07-01", "endPeriod": end.date().isoformat(),
                                 "format": "csvdata"}).text
    data = pd.read_csv(StringIO(raw)).pivot(index="TIME_PERIOD", columns="CURRENCY", values="OBS_VALUE").dropna()
    if (data[["CNY", "HKD"]] <= 0).any().any():
        raise ValueError("Invalid ECB reference legs")
    data["fx"] = fx_cross(data["CNY"], data["HKD"])
    data.index = pd.to_datetime(data.index)
    return data


def asof_record(records, date, field):
    return next((record for record in reversed(records)
                 if pd.Timestamp(record["effective"]) <= date and field in record), None)


def cny_cap(close, shares, rate=1):
    return close * shares * rate / 1e9


def valuation(market_cap, listed):
    if market_cap is None or listed is None:
        return {"listed": listed, "residual": None, "coverage": None}
    return {"listed": listed, "residual": market_cap - listed,
            "coverage": listed / market_cap if market_cap > 0 else None}


def build(prices, actions, history, fx, sessions, end, timestamp):
    frames = {asset: frame.set_index("date") for asset, frame in prices.groupby("asset")}
    dates = sessions["XSHG"].union(sessions["XHKG"]).union(pd.DatetimeIndex(prices["date"].unique()))
    by_asset = {a: sorted([x for x in history if x["asset"] == a], key=lambda x: x["effective"]) for a in TRACKED}
    metadata, observations = {}, {}
    alerts = []
    for asset in UNIVERSE:
        key = asset["id"]
        actual = frames.get(key)
        if actual is None or actual.empty:
            raise ValueError(f"Missing time series for {key}")
        open_dates = sessions[asset["market"]]
        last = actual.index[-1]
        if (open_dates > last).sum() > 1:
            raise ValueError(f"{key} is stale by more than one exchange session")
        if len(actual) < len(open_dates) * .94:
            raise ValueError(f"{key} has insufficient coverage")
        missing = open_dates.difference(actual.index)
        moves = actual["close"].pct_change().abs()
        unusual = moves[moves > .30].index.strftime("%Y-%m-%d").tolist()
        metadata[key] = {"last_trade": last.date().isoformat(), "rows": len(actual),
                         "missing_sessions": len(missing), "missing_dates": missing.strftime("%Y-%m-%d").tolist(),
                         "unusual_move_dates": unusual, "providers": sorted(actual["provider"].unique()),
                         "sources": sorted(actual["source_url"].dropna().unique()) if "source_url" in actual else []}
        expanded = actual.reindex(dates).ffill()
        expanded["last_trade"] = pd.Series(actual.index, index=actual.index).reindex(dates).ffill()
        observations[key] = (expanded, open_dates, set(open_dates), set(actual.index))

    fx_date = pd.Series(fx.index, index=fx.index).reindex(dates, method="ffill")
    fx_values = fx["fx"].reindex(dates, method="ffill")
    rows = []
    for day in dates:
        iso = day.date().isoformat()
        rate = float(fx_values[day]) if pd.notna(fx_date[day]) and (day-fx_date[day]).days <= 5 else None
        row = {"date": iso, "fx": rate, "fx_date": fx_date[day].date().isoformat() if rate is not None else None,
               "assets": {}, "flags": []}
        for asset in UNIVERSE[:len(TRACKED)]:
            key = asset["id"]
            expanded, exchange_dates, open_days, traded_days = observations[key]
            point = expanded.loc[day]
            # Closed-exchange dates may use the most recent close only if the previous scheduled session had a close.
            prior_session = exchange_dates[exchange_dates.searchsorted(day, side="right") - 1]
            can_carry = pd.notna(point.last_trade) and point.last_trade >= prior_session
            quote_state = "traded" if day in traded_days else "closed" if day not in open_days and can_carry else "missing"
            price = float(point.close) if quote_state in ("traded", "closed") else None
            capital = asof_record(by_asset[key], day, "shares")
            ownership = asof_record(by_asset[key], day, "ownership_status")
            shares = capital["shares"] if capital else None
            fx_multiplier = rate if asset["currency"] == "HKD" else 1
            market_cap = cny_cap(price, shares, fx_multiplier) if None not in (price, shares, fx_multiplier) else None
            economic_shares = ownership.get("economic_shares") if ownership else None
            pct = ownership.get("economic_pct") if ownership else None
            if economic_shares is not None and shares is not None and economic_shares > shares:
                raise ValueError(f"Ownership exceeds shares outstanding for {key} on {iso}")
            claim = None
            if economic_shares is not None and None not in (price, fx_multiplier):
                claim = cny_cap(price, economic_shares, fx_multiplier)
            elif pct is not None and market_cap is not None:
                claim = market_cap * pct
            name = {"kelun":"科伦药业", "skb":"科伦博泰", "cn":"川宁生物", "ssy":"石四药集团", "cisen":"辰欣药业"}[key]
            if key != "kelun" and (ownership is None or claim is None):
                row["flags"].append(f"{name}缺少报价或经济持股")
            if capital and capital.get("capital_status") != "event" and capital["effective"] != iso:
                row["flags"].append(f"{name}沿用上次股本快照")
            if ownership and ownership["ownership_status"] != "event" and ownership["effective"] != iso:
                row["flags"].append(f"{name}沿用上次持股披露")
            if quote_state == "missing":
                row["flags"].append(f"{name}开市但无有效报价")
            row["assets"][key] = {"close": price, "trade_date": point.last_trade.date().isoformat()
                                  if pd.notna(point.last_trade) else None, "quote_state": quote_state,
                                  "shares": shares, "capital_date": capital["effective"] if capital else None,
                                  "economic_shares": economic_shares, "economic_pct": pct,
                                  "ownership_date": ownership["effective"] if ownership else None,
                                  "cap": market_cap, "stake": claim}
        stake_values = [row["assets"][key]["stake"] for key in INVESTEES]
        row["parent_cap"] = row["assets"]["kelun"]["cap"]
        row.update(valuation(row["parent_cap"], sum(stake_values) if all(v is not None for v in stake_values) else None))
        row["status"] = "incomplete" if row["residual"] is None else "provisional" if row["flags"] else "complete"
        rows.append(row)
    for key in TRACKED:
        cap = [(r["effective"], r["shares"]) for r in by_asset[key] if r.get("shares")]
        for (_, before), (date, after) in zip(cap, cap[1:]):
            if abs(after / before - 1) > .05:
                alerts.append({"asset": key, "date": date, "type": "Capital change greater than 5%"})
    if not any(row["status"] != "incomplete" for row in rows[-10:]):
        raise ValueError("No recent usable group valuation; prior dataset preserved")
    return {"schema_version": 1, "updated_at": timestamp, "scope": "daily", "metadata": metadata,
            "actions": actions, "alerts": alerts, "rows": rows}


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")


def write_output(out, dataset, inputs=None):
    out.mkdir(parents=True, exist_ok=True)
    old = out / "tracker.json"
    if old.exists():
        previous = json.loads(old.read_text())
        for key, item in previous["metadata"].items():
            current = dataset["metadata"][key]
            if current["last_trade"] < item["last_trade"] or current["rows"] < item["rows"] * .99:
                raise ValueError(f"Source history regressed for {key}; preserving previous files")
    with tempfile.TemporaryDirectory(dir=out) as directory:
        stage = Path(directory)
        save_json(stage / "tracker.json", dataset)
        records = []
        for row in dataset["rows"]:
            record = {key: value for key, value in row.items() if key not in ("assets", "flags")}
            record["flags"] = " | ".join(row["flags"])
            for key, values in row["assets"].items():
                record.update({key+"_"+label: value for label, value in values.items()})
            records.append(record)
        pd.DataFrame(records).to_csv(stage / "daily.csv", index=False)
        for name in ("tracker.json", "daily.csv"):
            (stage / name).replace(out / name)
    if inputs:
        raw_dir, prices, actions, fx = inputs
        raw_dir.mkdir(parents=True, exist_ok=True)
        prices.to_csv(raw_dir / "prices.csv", index=False)
        pd.DataFrame(actions, columns=EVENT_COLUMNS).to_csv(raw_dir / "corporate-actions.csv", index=False)
        fx.to_csv(raw_dir / "fx-reference.csv", index_label="date")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--raw", type=Path, default=Path(".kelun-local/raw"))
    parser.add_argument("--end", type=pd.Timestamp)
    parser.add_argument("--smoke", action="store_true", help="Test providers without saving the fetched quotes")
    parser.add_argument("--publish", action="store_true", help="Use only the licensed market feed supplied to CI")
    parser.add_argument("--public-reference", action="store_true", help="Refresh the openly reusable ECB reference FX series")
    args = parser.parse_args()
    now = datetime.now(SHANGHAI)
    end = args.end if args.end is not None else eligible_end(now)
    if args.public_reference:
        fx = fetch_fx(end)
        if fx.empty or (end - fx.index[-1]).days > 5:
            raise ValueError("ECB reference rate is stale; preserving the previous public reference file")
        observations = [[date.date().isoformat(), round(float(value), 7)] for date, value in fx["fx"].items()]
        target = (args.output or SITE / "data") / "fx.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=target.parent) as directory:
            staged = Path(directory) / target.name
            save_json(staged, {"source": FX_SOURCE, "observations": observations})
            staged.replace(target)
        return
    sessions = exchange_sessions(end)
    if args.smoke:
        probe = end - pd.Timedelta(days=15)
        local_history(end, sessions, probe)
        fetch_fx(end)
        return
    history = read_history()
    output = args.output or (SITE / "data" if args.publish else Path(".kelun-local/processed"))
    if not args.publish and output.resolve().is_relative_to(SITE.resolve()):
        parser.error("Local provider observations must stay outside the published site directory")
    if args.publish:
        url = os.environ.get("KELUN_LICENSED_FEED_URL")
        if not url:
            parser.error("Licensed feed setting missing")
        token = os.environ.get("KELUN_FEED_TOKEN")
        try:
            response = requests.get(url, timeout=30, headers={"Authorization": "Bearer " + token} if token else {})
            response.raise_for_status()
            feed = response.json()
        except (requests.RequestException, ValueError):
            raise SystemExit("Licensed feed request failed") from None
        prices, actions = pd.DataFrame(feed["prices"]), feed.get("actions", [])
        if "source_url" not in prices or not prices["source_url"].str.startswith("https://").fillna(False).all():
            raise ValueError("Licensed feed requires an HTTPS citation per observation")
    else:
        prices, actions = local_history(end, sessions)
    prices = validate_prices(prices, end)
    fx = fetch_fx(end)
    if fx.empty or (end - fx.index[-1]).days > 5:
        raise ValueError("ECB rate is stale or unavailable; preserving previous files")
    result = build(prices, actions, history, fx, sessions, end, now.isoformat())
    write_output(output, result, None if args.publish else (args.raw, prices, actions, fx))
    print(f"{len(result['rows'])} dates; "
          f"{sum(r['status'] != 'incomplete' for r in result['rows'])} usable valuations", flush=True)


if __name__ == "__main__":
    main()
