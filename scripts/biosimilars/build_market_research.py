"""Build the research view from the pinned CMS datasets and normalized issuer evidence."""

import argparse
from collections import defaultdict
import csv
import json
from pathlib import Path
import re


MOLECULES = ('adalimumab', 'ustekinumab')
PART_D_SOURCE = 'https://catalog.data.gov/dataset/medicare-part-d-spending-by-drug-2024-01-01'
PART_D_FILE = (
    'https://data.cms.gov/sites/default/files/2026-06/98218f98-166c-4723-8438-c344a4ef96a6/'
    'DSD_PTD_RY26_P04_V10_DY24_BGM.csv'
)
FRANCE_SOURCE = 'https://www.assurance-maladie.ameli.fr/etudes-et-donnees/medicaments-classe-atc-medicam'
ARCHIVE = 'https://purplebooksearch.fda.gov/patent-list'
FDA = 'https://purplebooksearch.fda.gov/advanced-search'
VERIFY_DATE = '2026-11-21'


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')


def load_part_d(path):
    grouped = defaultdict(list)
    fields = {'claims': 'Clms', 'spending': 'Spndng', 'units': 'Dsg_Unts'}
    with path.open(encoding='utf-8-sig') as file:
        for record in csv.DictReader(file):
            generic = record['Gnrc_Name'].casefold().strip()
            molecule = next((m for m in MOLECULES if re.fullmatch(m + r'(?:-[a-z]{4})?', generic)), None)
            if record['Mftr_Name'] != 'Overall' or not molecule:
                continue
            original = record['Brnd_Name'].rstrip('*')
            # Concentrations, injectors and indication packs retain their original
            # claims but roll up to the same marketed brand. An unbranded suffix
            # remains separate even where a commercial label has the same BLA.
            brand = re.split(r'[ (]', original, maxsplit=1)[0]
            for year in range(2020, 2025):
                values = {}
                for key, field in fields.items():
                    value = record[f'Tot_{field}_{year}'].strip()
                    values[key] = float(value) if value else None
                if any(values.values()):
                    grouped[molecule, brand, str(year)].append(dict(label=original, **values))
    rows = [dict(molecule=molecule, brand=brand, period=year, presentations=len(records), **{
        key: sum(row[key] for row in records if row[key] is not None)
        if any(row[key] is not None for row in records) else None
        for key in fields}) for (molecule, brand, year), records in sorted(grouped.items())]
    assert {row['molecule'] for row in rows} == set(MOLECULES)
    return dict(source=PART_D_SOURCE, file=PART_D_FILE, rows=rows)


def as_quarter(value):
    if re.fullmatch(r'\d{4}-\d{2}(?:-\d{2})?', value):
        year, month = int(value[:4]), int(value[5:7])
        return year * 4 + (month - 1) // 3
    year, quarter = re.fullmatch(r'(\d{4})Q([1-4])', value).groups()
    return int(year) * 4 + int(quarter) - 1


def make_indexes(cms, groups, first_launch):
    indexes = {}
    for group in groups:
        key = group['id']
        products = {p['code']: p for p in group['products'] if p.get('code')}
        reference = next(code for code, p in products.items() if p.get('reference'))
        launch = first_launch.get(key)
        launch_q = as_quarter(launch['date']) if launch else None
        prices = sorted((r for r in cms['price'] if r['code'] == reference and r.get('price')),
                        key=lambda row: row['period'])
        base = next((r for r in prices if launch_q is not None and as_quarter(r['period']) == launch_q - 1), None)
        pre_competition = base is not None
        base = base or prices[0]
        payment = dict(base=base['period'], preCompetition=pre_competition, launch=launch,
                       rows=[dict(period=r['period'], value=r['price'], index=r['price'] / base['price'] * 100)
                             for r in prices if r['period'] >= base['period']])
        annual = []
        for year in sorted({r['period'] for r in cms['annual']}):
            rows = [r for r in cms['annual'] if r['period'] == year and r['code'] in products]
            # If a visible code lacks either field, keep the year's price index blank.
            comparable = all(r.get('units') and r.get('spending') is not None for r in rows)
            if not comparable or not any(r['code'] == reference for r in rows):
                continue
            units = sum(r['units'] for r in rows)
            spending = sum(r['spending'] for r in rows)
            annual.append(dict(period=year, value=spending / units, units=units, spending=spending,
                               codes=sorted(r['code'] for r in rows),
                               outliers=sorted(r['code'] for r in rows if r.get('outlier'))))
        annual_base = next((r for r in annual if launch and int(r['period']) == int(launch['date'][:4]) - 1), None)
        annual_pre = annual_base is not None
        annual_base = annual_base or (annual[0] if annual else None)
        if annual_base:
            annual = [dict(r, index=r['value'] / annual_base['value'] * 100) for r in annual
                      if r['period'] >= annual_base['period']]
        indexes[key] = dict(unit=group['unit'], scope=group['scope'], originator=payment,
                            weighted=dict(base=annual_base['period'] if annual_base else None,
                                          preCompetition=annual_pre, rows=annual))
    return indexes


def enrich_pipeline(snapshot, cms, dossiers):
    assets = {a['id']: a for a in snapshot['assets']}
    approvals = {(a['molecule'], a['region'], a['brand'].casefold()): a for a in snapshot['approvals']}
    stage_order = {'获批': 80, '已商业化': 90}
    companies = {c['id']: c for c in snapshot['companies']}
    for company in snapshot['companies']:
        if '三生国健' in company['name']:
            company['note'] += ' 历史后续生物药及地区权益待核。'
    for group in cms['groups']:
        for product in group['products']:
            launch = product.get('launch')
            row = approvals.get((group['id'], 'US', product['name'].casefold()))
            if row and launch:
                row['launch'] = launch['date']
                row['launchSource'] = launch['source']
    for record in dossiers.get('brandLaunches', []):
        row = approvals.get((record['molecule'], record['region'], record['brand'].casefold()))
        if row and (not row['date'] or record['date'] >= row['date']):
            row['launch'] = record['date']
            row['launchSource'] = record['source']
        if record['region'] == 'US':
            group = next((item for item in cms['groups'] if item['id'] == record['molecule']), None)
            product = next((item for item in group['products'] if item['name'].casefold() ==
                            record['brand'].casefold()), None) if group else None
            if product and not product.get('launch'):
                product['launch'] = {key: record[key] for key in ('date', 'source')}
    for record in dossiers.get('assets', []):
        if record['id'] in assets:
            continue
        assert record['company'] in companies and record['molecule'] in snapshot['molecules']
        asset = dict(record, current={}, milestones=[], partners=[], state='Active',
                     developer=companies[record['company']]['name'], companyIds=[record['company']],
                     display=record['id'], lastVerifiedAt=VERIFY_DATE)
        snapshot['assets'].append(asset)
        assets[asset['id']] = asset
        for brand, region in record['approvalKeys']:
            row = approvals.get((record['molecule'], region, brand.casefold()))
            if row:
                assert row['assetId'] in (None, record['id'])
                row['assetId'] = record['id']

    def add(asset, record):
        if any(r['region'] == record['region'] and r['date'] == record['date']
               and r['stage'] == record['stage'] for r in asset['milestones'] if r.get('date')):
            return
        region = record['region']
        current = asset['current'].get(region)
        asset['milestones'].append(dict(record, verified=VERIFY_DATE))
        if record.get('expected') or record['stage'] in ('历史获批', '授权合作'):
            return
        higher = not current or stage_order.get(record['stage'], 0) > stage_order.get(current['stage'], 0)
        same_stage_new_date = current and record['stage'] == current['stage'] and not current.get('date')
        if higher or same_stage_new_date or record.get('setCurrent'):
            asset['current'][region] = dict(record, verified=VERIFY_DATE)
        asset['lastVerifiedAt'] = VERIFY_DATE

    for row in snapshot['approvals']:
        asset = assets.get(row.get('assetId'))
        if not asset or not row.get('date') or not row.get('source'):
            continue
        assert asset['molecule'] == row['molecule']
        common = dict(region=row['region'], description=row['brand'] + ' · ' + row['code'])
        stage = '获批' if '失效' not in row['status'] and '撤回' not in row['status'] else '历史获批'
        add(asset, dict(common, stage=stage, date=row['date'], source=row['source']))
        if row.get('launch') and row.get('launchSource'):
            add(asset, dict(common, stage='已商业化', date=row['launch'], source=row['launchSource']))
    for record in dossiers.get('development', []):
        add(assets[record['asset']], {k: v for k, v in record.items() if k != 'asset'})
    for record in dossiers.get('partners', []):
        asset = assets[record['asset']]
        if not any(partner['name'] == record['name'] for partner in asset['partners']):
            asset['partners'].append({key: value for key, value in record.items() if key != 'asset'})
    for asset in snapshot['assets']:
        # Retain the original overview stage while surfacing dated regional evidence.
        if not asset.get('date'):
            dates = [e['date'] for e in asset['milestones'] if e.get('date') and not e.get('expected')]
            if dates:
                asset['date'] = max(dates)
    linked = [row for row in snapshot['approvals'] if row.get('assetId')]
    snapshot['pipelineApprovals'] = dict(total=len(snapshot['approvals']), matched=len(linked),
        byRegion={region: sum(row['region'] == region for row in linked) for region in ('US', 'CN', 'EU')})
    for audit in snapshot['pipelineAudit']:
        audit['recorded'] = sum(audit['company'] in asset['companyIds'] for asset in snapshot['assets'])
    snapshot['pipelineVerifiedAt'] = VERIFY_DATE


def build_dossiers(snapshot, dossiers):
    by_id = {c['id']: c for c in snapshot['cliffs']}
    for profile in dossiers['profiles']:
        identity = profile['id']
        if identity not in snapshot['molecules']:
            snapshot['molecules'][identity] = profile.pop('molecule')
        if identity in by_id:
            if 'regionalSales' in profile:
                by_id[identity]['regionalSales'].update(profile['regionalSales'])
            if 'source' in profile:
                by_id[identity]['source'] = profile['source']
            by_id[identity]['events'].extend(profile.get('events', []))
        else:
            snapshot['cliffs'].append(profile)
    assert len(snapshot['cliffs']) >= 15


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--page', type=Path, required=True)
    parser.add_argument('--part-d', type=Path, required=True)
    parser.add_argument('--france', type=Path)
    parser.add_argument('--evidence', type=Path, required=True)
    parser.add_argument('--baseline-page', type=Path, required=True)
    args = parser.parse_args()
    data = args.page.parent / 'data'
    cms = json.loads((data / 'medicare.json').read_text())
    dossiers = json.loads(args.evidence.read_text())
    pattern = r'(<script id="snapshot" type="application/json">)(.*?)(</script>)'
    baseline = json.loads(re.search(pattern, args.baseline_page.read_text(), re.S)[2])
    baseline['edition'] = VERIFY_DATE
    build_dossiers(baseline, dossiers)
    enrich_pipeline(baseline, cms, dossiers)
    write_json(data / 'medicare.json', cms)
    page = args.page.read_text()
    page = re.sub(pattern, lambda match: match[1] + json.dumps(baseline, ensure_ascii=False,
                  separators=(',', ':')).replace('</', '<\\/') + match[3], page, count=1, flags=re.S)
    args.page.write_text(page)
    research = dict(indexes=make_indexes(cms, cms['groups'], dossiers['firstLaunch']),
                    partD=load_part_d(args.part_d), brandSales=dossiers['brandSales'],
                    france=json.loads(args.france.read_text()) if args.france else dict(source=FRANCE_SOURCE, rows=[]),
                    patentResources=dossiers['patentResources'], evidenceDate=VERIFY_DATE,
                    quarterlyAudit=dossiers['quarterlyAudit'])
    write_json(data / 'market-research.json', research)


if __name__ == '__main__':
    main()
