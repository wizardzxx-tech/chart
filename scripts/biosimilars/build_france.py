"""Aggregate French CNAM Open Medic annual public-use files by molecule and brand."""

import argparse
from collections import defaultdict
import csv
from decimal import Decimal
import hashlib
import io
import json
from pathlib import Path
import re
from zipfile import ZipFile

CNAM = 'https://www.assurance-maladie.ameli.fr/etudes-et-donnees/open-medic-base-complete-depenses-medicaments'
CATALOG = 'https://open-data-assurance-maladie.ameli.fr/medicaments/download.php?Dir_Rep=Open_MEDIC_Base_Complete&Annee='
ATC = {'L04AB04': 'adalimumab', 'L04AC05': 'ustekinumab'}
BRAND = {
    'adalimumab': ('Humira', 'Amgevita', 'Amsparity', 'Hukyndra', 'Hulio', 'Hyrimoz',
                   'Idacio', 'Imraldi', 'Yuflyma', 'Yusimry'),
    'ustekinumab': ('Stelara', 'Uzpruvo', 'Wezenla', 'Pyzchiva', 'Steqeyma', 'Otulfi', 'Fymskina',
                    'Usymro', 'Yesintek', 'Iluvien', 'Imuldosa', 'Usgena', 'Kyntheum'),
}


def assemble(inputs, manifest):
    observations, releases = [], []
    checksums = {Path(row['path']).name: row['sha256'] for row in manifest['files']}
    years = set()
    for file in inputs:
        year = re.search(r'20\d{2}', file.name)[0]
        assert year not in years, year
        years.add(year)
        checksum = hashlib.sha256(file.read_bytes()).hexdigest()
        expected = checksums.get(f'OPEN_MEDIC_{year}.zip')
        if expected:
            assert checksum == expected, (year, checksum, expected)
        with ZipFile(file) as archive:
            return_bytes = archive.open(next(name for name in archive.namelist() if name.lower().endswith('.csv')))
            with io.TextIOWrapper(return_bytes, encoding='cp1252', errors='replace') as stream:
                totals = defaultdict(lambda: [0, Decimal(0), set(), 0])
                reader = csv.DictReader(stream, delimiter=';')
                lookup = {name.upper(): name for name in reader.fieldnames}
                for row in reader:
                    code = row[lookup['ATC5']]
                    label = row[lookup['L_ATC5']] or ''
                    molecule = ATC.get(code) or next((m for m in BRAND if label.casefold() == m), None)
                    if molecule is None:
                        continue
                    product = row[lookup['L_CIP13']]
                    brand = next((b for b in BRAND[molecule]
                                  if re.match(re.escape(b) + r'\b', product, re.I)), None)
                    brand = brand or product.split(' ')[0].title()
                    cip = row[lookup['CIP13']]
                    data = totals[molecule, brand]
                    data[2].add(cip)
                    data[3] += 1
                    packs, euros = row[lookup['BOITES']], row[lookup['REM']]
                    assert packs and euros, (year, molecule, cip)
                    data[0] += int(packs)
                    normalized = euros.replace('.', '').replace(',', '.') if ',' in euros else euros
                    data[1] += Decimal(normalized)
                assert {k[0] for k in totals} == set(BRAND)
                for (molecule, brand), (packs, amount, codes, line_count) in sorted(totals.items()):
                    observations.append(dict(molecule=molecule, period=year, brand=brand, packs=packs,
                                             spending=float(amount), cip13=sorted(codes), strata=line_count,
                                             source=CATALOG + year))
        releases.append(dict(period=year, sha256=checksum, source=CATALOG + year))
    return dict(source=CNAM, attribution='Caisse nationale de l’Assurance Maladie · Licence Ouverte 2.0',
                releases=sorted(releases, key=lambda item: item['period']),
                rows=sorted(observations, key=lambda item: (item['period'], item['molecule'], item['brand'])))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', type=Path, nargs='+', required=True)
    p.add_argument('--manifest', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    result = assemble(a.input, json.loads(a.manifest.read_text()))
    a.output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(len(result['rows']), ', '.join(row['period'] for row in result['releases']))
