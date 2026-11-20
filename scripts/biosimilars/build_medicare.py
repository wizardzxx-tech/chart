"""Build the three-molecule Medicare series from CMS public-use files.

python3 build_medicare.py --inputs ./raw --approvals ./index.html --output ./medicare.json
Input directory: cms-annual.csv, cms-quarterly.csv, asp-manifest.json and the
20 asp-YYYYQn.zip files. See medicare-map.json for the exact download URLs.
"""

from argparse import ArgumentParser
from collections import Counter
from csv import DictReader, reader
from datetime import date
from decimal import Decimal
from pathlib import Path
from zipfile import ZipFile
import json
import re


def read_value(raw):
    """Use null for blank, suppressed or explicitly unavailable fields."""
    text = (raw or '').strip().replace(',', '').lstrip('$')
    if text.upper() in ('', 'NA', 'N/A', '*', 'SUPPRESSED', 'NULL', '—'):
        return None
    value = Decimal(text)
    if not value.is_finite() or value < 0:
        raise ValueError(f'Unexpected CMS value: {raw}')
    return float(value) if value % 1 else int(value)


def get_years(header):
    return sorted(int(col[-4:]) for col in header if re.fullmatch(r'Tot_Dsg_Unts_\d{4}', col))


def load_annual(path, codes):
    with path.open(encoding='utf-8-sig', newline='') as source:
        annual = DictReader(source)
        years = get_years(annual.fieldnames)
        assert len(years) == 5
        rows = []
        for entry in annual:
            code = entry['HCPCS_Cd'].upper()
            if code not in codes:
                continue
            assert re.search(r'\b10\s*mg\b', entry['HCPCS_Desc'], re.I), entry['HCPCS_Desc']
            for year in years:
                row = dict(code=code, period=str(year),
                    units=read_value(entry[f'Tot_Dsg_Unts_{year}']),
                    spending=read_value(entry[f'Tot_Spndng_{year}']),
                    claims=read_value(entry[f'Tot_Clms_{year}']))
                if entry[f'Outlier_Flag_{year}'] == '1':
                    row['outlier'] = True
                if any(row[key] not in (None, 0) for key in ('units', 'spending', 'claims')):
                    rows.append(row)
    return rows


def load_quarterly(path, codes, config):
    with path.open(encoding='utf-8-sig', newline='') as source:
        extracted = []
        observed_periods = set()
        for entry in DictReader(source):
            code = entry['HCPCS_Cd'].upper()
            if code not in codes:
                continue
            label = entry['Year'].strip()
            period = config[label]
            observed_periods.add(label)
            extracted.append(dict(code=code, period=period['id'],
                spending=read_value(entry['Tot_Spndng']),
                claims=read_value(entry['Tot_Clms']),
                beneficiaries=read_value(entry['Tot_Benes'])))
        assert observed_periods == set(config), observed_periods
    return extracted


def load_payments(directory, manifest, codes):
    rows = []
    for period, meta in sorted(manifest.items()):
        with ZipFile(directory / f'asp-{period}.zip') as archive:
            files = [name for name in archive.namelist() if name.lower().endswith('.csv')
                     and re.search(r'asp pricing file|payment limit file', name, re.I)]
            assert len(files) == 1, files
            csv = list(reader(archive.read(files[0]).decode('cp1252').splitlines()))
        header_index = next(index for index, row in enumerate(csv)
            if row and row[0].strip().casefold() == 'hcpcs code')
        cols = [field.strip().casefold() for field in csv[header_index]]
        code_index = cols.index('hcpcs code')
        limit_index = cols.index('payment limit')
        dosage_index = cols.index('hcpcs code dosage')
        for entry in csv[header_index + 1:]:
            if len(entry) <= limit_index:
                continue
            code = entry[code_index].strip().upper()
            if code not in codes:
                continue
            value = read_value(entry[limit_index])
            unit = entry[dosage_index].strip()
            assert value is None or re.fullmatch(r'10\s*mg', unit, re.I), (period, code, unit)
            rows.append(dict(code=code, period=period, price=value))
        meta['file'] = files[0]
    return rows


def read_approvals(path):
    text = path.read_text()
    if path.suffix == '.html':
        text = re.search(r'<script id="snapshot" type="application/json">(.*?)</script>', text, re.S)[1]
    return [r for r in json.loads(text)['approvals'] if r['region'] == 'US']


def release_start(period, periods):
    if len(period) == 4:
        return date(int(period), 1, 1)
    return date.fromisoformat(periods[period]['start'])


def link_products(groups, approvals, annual, quarterly, periods):
    for group in groups:
        records = {row['brand'].casefold(): row for row in approvals if row['molecule'] == group['id']}
        products = group['products']
        for name in group.pop('additionalApprovals', []):
            products.append(dict(name=name, reference=False))
        for product in products:
            record = records.get(product['name'].casefold())
            if record is not None:
                product['approval'] = {k: record[k] for k in ('date', 'holder', 'code', 'source')}
                if record.get('assetId'):
                    product['assetId'] = record['assetId']
                launch = product.get('launch')
                assert not launch or launch['date'] >= record['date'], (product['name'], launch)
            code = product.get('code')
            visible = [r['period'] for r in annual + quarterly if r['code'] == code and (r['claims'] or 0) > 0]
            if visible:
                product['firstClaim'] = min(visible, key=lambda value: release_start(value, periods))


def verify(groups, facts, payments):
    codes = {
        product['code'] for group in groups for product in group['products'] if 'code' in product
    }
    for data in facts:
        keys = [(row['code'], row['period']) for row in data]
        assert len(keys) == len(set(keys)), Counter(keys).most_common(5)
        assert {row['code'] for row in data} <= codes
    for group in groups:
        originals = [product['code'] for product in group['products'] if product.get('reference')]
        assert len(originals) == 1
        for period in payments:
            assert any(row['period'] == period and row['code'] == originals[0] and row['price'] > 0
                for row in facts[2]), (period, originals[0])
    assert len(payments) >= 20


def main():
    parser = ArgumentParser()
    parser.add_argument('--inputs', type=Path, required=True)
    parser.add_argument('--approvals', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    config = json.loads(Path(__file__).with_name('medicare-map.json').read_text())
    directory = args.inputs
    payments = json.loads((directory / 'asp-manifest.json').read_text())
    groups = config['groups']
    codes = {p['code'] for g in groups for p in g['products']}
    period_labels = config.pop('quarterLabels')
    periods = {p['id']: p for p in period_labels.values()}
    annual = load_annual(directory / 'cms-annual.csv', codes)
    quarterly = load_quarterly(directory / 'cms-quarterly.csv', codes, period_labels)
    price = load_payments(directory, payments, codes)
    link_products(groups, read_approvals(args.approvals), annual, quarterly, periods)
    verify(groups, [annual, quarterly, price], payments)
    config.update(annual=annual, quarterly=quarterly, price=price,
        quarterPeriods=periods, paymentPeriods=payments)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(config, ensure_ascii=False, separators=(',', ':')) + '\n')
    for name, data in [('annual', annual), ('quarterly', quarterly), ('payment', price)]:
        print(name, len(data), sorted({r['period'] for r in data}))


if __name__ == '__main__':
    main()
