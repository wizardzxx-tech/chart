"""Extract and verify the NHSA pooled-fund image table."""
from calendar import monthrange
from decimal import Decimal
from hashlib import sha256
from io import BytesIO
import re
import subprocess
import tempfile
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup
from PIL import Image, ImageOps

CATEGORIES = {"total": "合计", "employee": "职工医保（含生育）", "resident": "城乡居民医保"}
AMOUNT = re.compile(r"\d{2,6}\.\d{2}")
SCOPE = "YTD pooled fund including maternity; excluding employee personal accounts"


def grids(image):
    width, height = image.size
    if not 1.05 < width / height < 1.4:
        raise ValueError("Unexpected NHSA image proportions")
    dark = image.point(lambda p: 1 if p < 100 else 0)
    pixels = dark.load()
    horizontal = [y for y in range(height) if sum(pixels[x, y] for x in range(width)) > .85 * width]
    vertical = [x for x in range(width) if sum(pixels[x, y] for y in range(height)) > .73 * height]

    def centers(lines):
        groups = []
        for line in lines:
            if not groups or line > groups[-1][-1] + 1:
                groups.append([])
            groups[-1].append(line)
        return [group[len(group)//2] for group in groups]

    xs, ys = centers(vertical), centers(horizontal)
    if len(xs) != 4 or len(ys) != 11:
        raise ValueError(f"NHSA table layout changed ({len(xs)} columns, {len(ys)} lines)")
    return xs, ys


def ocr(cell, lang="eng"):
    original = cell
    ink = cell.point(lambda pixel: 255 if pixel < 150 else 0).getbbox()
    if ink:
        cell = cell.crop(ink)
    raster = ImageOps.expand(cell.resize((cell.width * 3, cell.height * 3)), border=25, fill=255)
    if lang == "chi_tra+eng":
        raster = original
    with tempfile.TemporaryFile() as image:
        raster.save(image, "PNG")
        image.seek(0)
        result = subprocess.run(["tesseract", "stdin", "stdout", "-l", lang, "--psm", "7",
            *([] if lang != "eng" else ["-c", "tessedit_char_whitelist=0123456789."])],
            stdin=image, capture_output=True, check=True, timeout=12)
    return re.sub(r"\s+", "", result.stdout.decode())


def extract_image(body):
    image = Image.open(BytesIO(body))
    if image.format != "PNG" or image.width * image.height > 5_000_000:
        raise ValueError("Unexpected NHSA attachment")
    image = image.convert("L")
    xs, ys = grids(image)

    def cell(row, col):
        return image.crop((xs[col] + 6, ys[row] + 5, xs[col+1] - 5, ys[row+1] - 5))

    header = ocr(cell(0, 2), "chi_sim")
    if "本期" not in header:
        raise ValueError(f"Expected the 本期 column: {header}")
    lookup = {2:("income", "total", "基本医疗保险"), 3:("income", "employee", "职工"),
              4:("income", "resident", "居民"), 6:("spending", "total", "基本医疗保险"),
              7:("spending", "employee", "职工"), 8:("spending", "maternity", "生育"),
              9:("spending", "resident", "居民")}
    result = {}
    for index, (measure, group, expected) in lookup.items():
        label = ocr(cell(index, 0), "chi_sim") or ocr(cell(index, 0), "chi_tra+eng")
        num = ocr(cell(index, 2))
        label_matches = expected in label or (group == "resident" and not re.search(r"[一-龥]",label))
        if not label_matches or not AMOUNT.fullmatch(num):
            raise ValueError(f"OCR needs review at {group} {measure}: {label} / {num}")
        result[f"{group}_{measure}"] = num
    if "亿元" not in ocr(cell(6, 1), "chi_sim"):
        raise ValueError("Fund unit was not 亿人民币")
    return result


def validate(rows, previous):
    values = {key: Decimal(value) for key, value in rows.items()}
    for field in ("income", "spending"):
        total, employee, resident = [values[f"{group}_{field}"] for group in CATEGORIES]
        if not 0 < total < 100_000 or min(employee, resident) <= 0:
            raise ValueError("Unexpected fund value range")
        if abs(total - employee - resident) > Decimal("0.02"):
            raise ValueError(f"NHSA {field} subtotals do not reconcile")
    if not 0 <= values["maternity_spending"] <= values["employee_spending"]:
        raise ValueError("Maternity spending exceeds employee fund spending")
    for key in rows:
        if previous and (values[key] < Decimal(str(previous[key])) or
                values[key] > Decimal(str(previous[key])) * Decimal("1.55")):
            raise ValueError(f"Cumulative value decreased or unusual month-to-date change: {key}")
    return True


def candidate(task, read, previous):
    article = read(task["url"])
    soup = BeautifulSoup(article, "html.parser")
    table = [a["href"] for a in soup.select('a[href*="/picture/"]') if a.find("img")]
    if len(table) != 1:
        raise ValueError("Expected one linked official summary table")
    if "个人账户" not in soup.get_text() or "统筹基金" not in soup.get_text():
        raise ValueError("NHSA scope footnote absent")
    title = soup.find("meta", attrs={"name": "ArticleTitle"})["content"]
    period = re.match(r"(20\d\d)年(?:1[-—–])?(\d{1,2})月基本医疗保险统筹基金和生育保险主要指标", title)
    if not period:
        raise ValueError(f"Unexpected report title: {title}")
    year, month = map(int, period.groups())
    end = f"{year:04d}-{month:02d}-{monthrange(year, month)[1]}"
    if end != task["period"]:
        raise ValueError("Article month does not match the review task")
    image = urljoin(task["url"], table[0])
    if urlsplit(image).hostname != "www.nhsa.gov.cn":
        raise ValueError("Unrecognized NHSA attachment origin")
    raw = read(image)
    rows = extract_image(raw)
    validate(rows, previous)
    return {"period": end[:7], "source": task["url"], "image": image, "image_sha256": sha256(raw).hexdigest(),
            "basis": SCOPE, "unit": "亿元", **rows}
