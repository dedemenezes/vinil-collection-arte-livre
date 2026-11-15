#!/usr/bin/env python3
"""Convert Discogs collection + track analysis CSVs into slim JSON for the site."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data"


def clean(value: str | None) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in {"não identificado", "nao identificado", "n/a", "-"}:
        return ""
    return text


def build_albums(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    albums = []
    for row in rows:
        year = clean(row.get("Released"))
        if year == "0":
            year = ""
        albums.append(
            {
                "id": clean(row.get("release_id")),
                "catalog": clean(row.get("Catalog#")),
                "artist": clean(row.get("Artist")),
                "title": clean(row.get("Title")),
                "label": clean(row.get("Label")),
                "format": clean(row.get("Format")),
                "year": year,
                "added": clean(row.get("Date Added"))[:10],
                "media": clean(row.get("Collection Media Condition")),
                "sleeve": clean(row.get("Collection Sleeve Condition")),
                "notes": clean(row.get("Collection Notes")),
            }
        )
    return albums


def build_tracks(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    tracks = []
    for row in rows:
        bpm_raw = clean(row.get("bpm"))
        bpm = None
        if bpm_raw:
            try:
                bpm = round(float(bpm_raw.replace(",", ".")), 1)
            except ValueError:
                bpm = None

        year = clean(row.get("released"))
        if year == "0":
            year = ""

        tracks.append(
            {
                "rid": clean(row.get("release_id")),
                "pos": clean(row.get("track_position")),
                "artist": clean(row.get("track_artist")) or clean(row.get("collection_artist")),
                "title": clean(row.get("track_title")),
                "album": clean(row.get("collection_title")),
                "album_artist": clean(row.get("collection_artist")),
                "label": clean(row.get("label")),
                "year": year,
                "dur": clean(row.get("duration")),
                "bpm": bpm,
                "key": clean(row.get("nota")),
                "camelot": clean(row.get("camelot")),
            }
        )
    return tracks


def camelot_sort_key(value: str) -> tuple:
    number = int(re.sub(r"\D", "", value) or 0)
    letter = value[-1] if value else ""
    return (letter, number)


def write_json(path: Path, payload: object, *, pretty: bool = False) -> None:
    if pretty:
        text = json.dumps(payload, ensure_ascii=False, indent=2)
    else:
        text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    print(f"{path.relative_to(ROOT)} → {path.stat().st_size / 1024:.0f} KB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--albums", type=Path, required=True, help="Discogs collection CSV")
    parser.add_argument("--tracks", type=Path, required=True, help="Tracks BPM/key CSV")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)

    albums = build_albums(args.albums)
    tracks = build_tracks(args.tracks)

    write_json(OUT / "albums.json", albums)
    write_json(OUT / "tracks.json", tracks)

    meta = {
        "keys": sorted({t["key"] for t in tracks if t["key"]}),
        "camelots": sorted({t["camelot"] for t in tracks if t["camelot"]}, key=camelot_sort_key),
        "formats": sorted({a["format"] for a in albums if a["format"]}),
        "years": sorted({a["year"] for a in albums if a["year"]}),
        "album_count": len(albums),
        "track_count": len(tracks),
    }
    write_json(OUT / "meta.json", meta, pretty=True)
    print(f"albums={len(albums)} tracks={len(tracks)}")


if __name__ == "__main__":
    main()
