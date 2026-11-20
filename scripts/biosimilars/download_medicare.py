"""Download the CMS files pinned by a published Medicare snapshot.

Run from the repository root:
    python3 scripts/biosimilars/download_medicare.py ./raw
    python3 scripts/biosimilars/build_medicare.py --inputs ./raw \
        --approvals v2/biosimilars/index.html --output v2/biosimilars/data/medicare.json
"""
from argparse import ArgumentParser
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import is_zipfile
import json


def download_source(item):
    path, url = item
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(request, timeout=30) as response:
        body = response.read()
    next_path = path.with_suffix(path.suffix + '.incoming')
    next_path.write_bytes(body)
    valid = is_zipfile(next_path) if path.suffix == '.zip' else body.lstrip(b'\xef\xbb\xbf').startswith(
        (b'HCPCS_Cd,', b'Brnd_Name,'))
    if not valid:
        next_path.unlink()
        raise ValueError(f'CMS returned an unexpected format for {path.name}')
    next_path.replace(path)
    return path.name


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--snapshot', type=Path,
        default=Path('v2/biosimilars/data/medicare.json'))
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    with args.snapshot.open() as file:
        snapshot = json.load(file)
    files = {f'cms-{name}.csv': snapshot['sources'][name]['file'] for name in ('annual', 'quarterly')}
    payment = snapshot['paymentPeriods']
    files.update({f'asp-{period}.zip': meta['url'] for period, meta in payment.items()})
    print(f'Downloading {len(files)} public CMS files.')
    with ThreadPoolExecutor(max_workers=5) as pool:
        for result in pool.map(download_source, ((args.directory / name, url) for name, url in files.items())):
            print(result)
    (args.directory / 'asp-manifest.json').write_text(json.dumps(payment, indent=2) + '\n')


if __name__ == '__main__':
    main()
