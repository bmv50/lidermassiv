#!/usr/bin/env python3
"""Upgrade low-resolution catalog thumbnails from their exact source product pages.

The source site exposes full-size product gallery links. This script copies those
original image bytes without altering the product appearance. Failed or missing
images are left unchanged.
"""
from __future__ import annotations

import argparse
import html
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app/data/products.json"
PUBLIC = ROOT / "public"
UA = "Mozilla/5.0 (compatible; LiderMassivCatalogRefresh/1.0)"
FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


def get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read()


def image_size(content: bytes) -> tuple[str, tuple[int, int]]:
    with Image.open(io.BytesIO(content)) as picture:
        picture.load()
        return picture.format or "", picture.size


def source_photo(page_url: str) -> str:
    if urllib.parse.urlsplit(page_url).hostname not in {"www.mebelru1.ru", "mebelru1.ru"}:
        raise ValueError("unexpected source host")
    markup = get(page_url).decode("utf-8", "replace")
    marker = "product-detail-gallery swipeignore"
    if marker not in markup:
        raise ValueError("product gallery missing")
    gallery = markup.split(marker, 1)[1].split('class="product-main"', 1)[0]
    found = re.search(r'<link\s+href="(/upload/iblock/[^"]+)"\s+itemprop="image"', gallery)
    if not found:
        found = re.search(r'<a\s+href="(/upload/iblock/[^"]+)"[^>]*data-fancybox="gallery"', gallery)
    if not found:
        raise ValueError("full-size gallery photo missing")
    photo_url = urllib.parse.urljoin(page_url, html.unescape(found.group(1)))
    if urllib.parse.urlsplit(photo_url).hostname not in {"www.mebelru1.ru", "mebelru1.ru"}:
        raise ValueError("unexpected photo host")
    return photo_url


def upgrade(product: dict) -> tuple[str, str, str, int, tuple[int, int]]:
    product_id = str(product["id"])
    try:
        photo_url = source_photo(product["source"])
        content = get(photo_url)
        image_format, dimensions = image_size(content)
        if image_format not in FORMATS:
            raise ValueError("unsupported image format: " + image_format)
        if max(dimensions) < 450:
            raise ValueError("source photo remains small: " + str(dimensions))
        target = PUBLIC / "images" / (product_id + "-full" + FORMATS[image_format])
        target.write_bytes(content)
        return product_id, "/" + target.relative_to(PUBLIC).as_posix(), photo_url, len(content), dimensions
    except Exception as exc:
        return product_id, "", str(exc), 0, (0, 0)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    raw = DATA.read_bytes()
    products = json.loads(raw.decode("utf-8"))
    candidates = []
    for product in products:
        current = PUBLIC / product["image"].lstrip("/")
        if not current.exists():
            continue
        with Image.open(current) as picture:
            if max(picture.size) <= 300:
                candidates.append(product)
    selected = candidates[args.start:args.start + args.limit if args.limit else None]
    print("low_resolution={} selected={}".format(len(candidates), len(selected)), flush=True)
    if not selected:
        return 0
    successes = {}
    failures = {}
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 6))) as pool:
        jobs = {pool.submit(upgrade, product): product for product in selected}
        for index, future in enumerate(as_completed(jobs), 1):
            product_id, path, detail, count, dimensions = future.result()
            if path:
                successes[product_id] = (path, detail, count, dimensions)
                total_bytes += count
            else:
                failures[product_id] = detail
            if index % 25 == 0 or index == len(selected):
                print("done={} success={} failed={} MiB={:.1f}".format(
                    index, len(successes), len(failures), total_bytes / 1048576), flush=True)
    for product in products:
        if str(product["id"]) in successes:
            product["image"] = successes[str(product["id"])][0]
    if successes:
        body = json.dumps(products, ensure_ascii=False, indent=2) + "\n"
        if b"\r\n" in raw:
            body = body.replace("\n", "\r\n")
        DATA.write_bytes(body.encode("utf-8"))
    report = {
        "selected": len(selected),
        "updated": len(successes),
        "failed": failures,
        "bytes": total_bytes,
        "examples": [
            {"id": product_id, "path": info[0], "source_photo": info[1],
             "bytes": info[2], "dimensions": info[3]}
            for product_id, info in list(successes.items())[:10]
        ],
    }
    (ROOT / "work/image-upgrade-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("updated={} failed={}".format(len(successes), len(failures)), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
