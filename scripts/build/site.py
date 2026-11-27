"""Stage the existing static site for the GitHub Pages deployment artifact."""
from argparse import ArgumentParser
from pathlib import Path
from shutil import copy2, copytree
import json
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from build.financial_coverage import build as financial_coverage
from build.operating_coverage import build as operating_coverage

ROOT = Path(__file__).resolve().parents[2]


def build(destination):
    state = json.loads((ROOT / "v2/update-center/status.json").read_text())
    for row in state["datasets"]:
        if row.get("last_success") and row.get("data_url"):
            path = ROOT / "v2" / row["data_url"].removeprefix("../")
            if not path.is_file():
                raise ValueError(f"Published update is missing: {path}")
    destination.mkdir(exist_ok=True, parents=True)
    copy2(ROOT / "index.html", destination)
    copy2(ROOT / ".nojekyll", destination)
    copytree(ROOT / "v2", destination / "v2", dirs_exist_ok=True)
    financial_coverage(ROOT,destination)
    operating_coverage(ROOT,destination)


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    build(parser.parse_args().destination)
