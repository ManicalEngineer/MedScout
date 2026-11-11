"""Build backend/data/zip_areas.csv: ZIP → named area (metro/micro area, else county).

One-off; re-run only when the Census publishes new delineations. Inputs (public
Census Bureau files, not checked in):

  ZCTA→county: https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
  CBSA list:   https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx

Usage (from backend/):
  python scripts/build_zip_areas.py ZCTA_COUNTY_TXT LIST1_XLSX

Output rows: key,area_code,area_name
  key        5-digit ZIP, or a 3-digit prefix used as a fallback for ZIPs that
             aren't ZCTAs (PO-box-only ZIPs etc.): the area most of that
             prefix's ZIPs belong to
  area_code  "m<CBSA code>" for a metropolitan/micropolitan area,
             "c<county FIPS>" for a ZIP outside any CBSA
  area_name  "Albany-Schenectady-Troy, NY" or "Essex County, NY"

A ZIP spanning several counties is assigned to the county holding most of its
land area.
"""
import csv
import os
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "zip_areas.csv")

STATE_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
    "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
    "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
    "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
    "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
    "55": "WI", "56": "WY", "72": "PR",
}

# The 2020 ZCTA file uses Connecticut's old counties; the 2023 CBSA list uses
# the planning regions that replaced them in 2022. Old county → the 2023 CBSA
# covering most of it.
CT_LEGACY_COUNTY_CBSA = {
    "09001": "14860",  # Fairfield  → Bridgeport-Stamford-Danbury
    "09003": "25540",  # Hartford   → Hartford-West Hartford-East Hartford
    "09005": "45860",  # Litchfield → Torrington (micro)
    "09007": "25540",  # Middlesex  → Hartford-West Hartford-East Hartford
    "09009": "35300",  # New Haven  → New Haven
    "09011": "35980",  # New London → Norwich-New London-Willimantic
    "09013": "25540",  # Tolland    → Hartford-West Hartford-East Hartford
    "09015": "35980",  # Windham    → Norwich-New London-Willimantic
}

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _xlsx_rows(path):
    """Rows of the first sheet as lists of strings (stdlib only)."""
    with zipfile.ZipFile(path) as z:
        shared = [
            "".join(t.text or "" for t in si.iter(_NS + "t"))
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(_NS + "si")
        ]
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    for row in sheet.iter(_NS + "row"):
        cells = {}
        for c in row.findall(_NS + "c"):
            ref = "".join(ch for ch in c.get("r") if ch.isalpha())
            v = c.find(_NS + "v")
            val = v.text if v is not None else ""
            if c.get("t") == "s":
                val = shared[int(val)]
            cells[ref] = val or ""
        yield cells


def load_cbsas(xlsx_path):
    """county FIPS → CBSA code, and CBSA code → title."""
    county_cbsa, titles = {}, {}
    header_seen = False
    for cells in _xlsx_rows(xlsx_path):
        if cells.get("A") == "CBSA Code":
            header_seen = True
            continue
        if not header_seen or not cells.get("A", "").isdigit():
            continue
        code, title = cells["A"], cells["D"]
        fips = cells["J"].zfill(2) + cells["K"].zfill(3)
        county_cbsa[fips] = code
        titles[code] = title
    if not titles:
        sys.exit("no CBSA rows found — has the spreadsheet layout changed?")
    return county_cbsa, titles


def load_zip_counties(txt_path):
    """ZIP → (county FIPS, county name) for the county with most of its land."""
    best = {}
    with open(txt_path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f, delimiter="|"):
            z = row["GEOID_ZCTA5_20"]
            if not z:
                continue  # county rows with no ZCTA overlap
            land = int(row["AREALAND_PART"] or 0)
            if z not in best or land > best[z][0]:
                best[z] = (land, row["GEOID_COUNTY_20"], row["NAMELSAD_COUNTY_20"])
    return {z: (fips, name) for z, (_, fips, name) in best.items()}


def build(txt_path, xlsx_path):
    county_cbsa, titles = load_cbsas(xlsx_path)
    for legacy, code in CT_LEGACY_COUNTY_CBSA.items():
        if code not in titles:
            sys.exit(f"CT mapping for {legacy} points at missing CBSA {code}")
        county_cbsa.setdefault(legacy, code)

    rows = {}
    for z, (fips, county_name) in load_zip_counties(txt_path).items():
        cbsa = county_cbsa.get(fips)
        if cbsa:
            rows[z] = ("m" + cbsa, titles[cbsa])
        else:
            st = STATE_ABBR.get(fips[:2])
            if st is None:
                continue  # island areas: no state abbreviation, no CBSA
            rows[z] = ("c" + fips, f"{county_name}, {st}")

    by_prefix = defaultdict(Counter)
    for z, area in rows.items():
        by_prefix[z[:3]][area] += 1
    prefix_rows = {p: c.most_common(1)[0][0] for p, c in by_prefix.items()}
    return rows, prefix_rows


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    rows, prefix_rows = build(sys.argv[1], sys.argv[2])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["key", "area_code", "area_name"])
        for key in sorted(prefix_rows):
            w.writerow([key, *prefix_rows[key]])
        for key in sorted(rows):
            w.writerow([key, *rows[key]])
    areas = {a for a, _ in rows.values()}
    print(f"wrote {len(rows)} ZIPs, {len(prefix_rows)} prefixes, {len(areas)} areas → {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
