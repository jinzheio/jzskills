#!/usr/bin/env python3
"""Inspect PDF text blocks and apply translated overlays.

This helper is intentionally small: it preserves the original PDF page graphics,
redacts selected text blocks with the right background fill, and writes supplied
Chinese replacements back into the same geometry.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

import fitz


DEFAULT_SERIF_TTC = "/System/Library/Fonts/Supplemental/Songti.ttc"
DEFAULT_SANS_TTC = "/System/Library/Fonts/STHeiti Light.ttc"
TMP_SERIF = "/tmp/pdf_to_chinese_SongtiSC-Light.ttf"
TMP_SANS = "/tmp/pdf_to_chinese_HeitiSC-Light.ttf"


def parse_pages(value: str, page_count: int) -> list[int]:
    pages: list[int] = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = [int(x) for x in part.split("-", 1)]
            pages.extend(range(start - 1, end))
        else:
            pages.append(int(part) - 1)
    return [p for p in pages if 0 <= p < page_count]


def page_background(page: fitz.Page) -> tuple[float, float, float]:
    rect = page.rect
    for drawing in page.get_drawings():
        fill = drawing.get("fill")
        drect = drawing.get("rect")
        if fill and drect and fitz.Rect(drect).contains(rect):
            return tuple(float(x) for x in fill[:3])
    return (1.0, 1.0, 1.0)


def extract_ttc_face(source: str, index: int, target: str) -> str:
    if os.path.exists(target):
        return target
    try:
        from fontTools.ttLib import TTCollection
    except Exception:
        return source
    TTCollection(source).fonts[index].save(target)
    return target


def default_fonts() -> dict[str, str]:
    serif = extract_ttc_face(DEFAULT_SERIF_TTC, 3, TMP_SERIF)
    sans = extract_ttc_face(DEFAULT_SANS_TTC, 1, TMP_SANS)
    return {"serif": serif, "sans": sans}


def block_text(block: dict) -> str:
    return "\n".join(
        "".join(span["text"] for span in line["spans"]).rstrip()
        for line in block.get("lines", [])
    ).strip()


def inspect(args: argparse.Namespace) -> None:
    doc = fitz.open(args.pdf)
    pages = parse_pages(args.pages, len(doc))
    result = {"source": os.path.abspath(args.pdf), "pages": []}
    for page_index in pages:
        page = doc[page_index]
        item = {
            "page": page_index + 1,
            "size": [page.rect.width, page.rect.height],
            "background": list(page_background(page)),
            "blocks": [],
        }
        for block_index, block in enumerate(page.get_text("dict")["blocks"]):
            if block.get("type") != 0:
                continue
            text = block_text(block)
            if not text:
                continue
            x0, y0, x1, y1 = block["bbox"]
            spans = [span for line in block["lines"] for span in line["spans"]]
            item["blocks"].append(
                {
                    "id": f"p{page_index + 1}-b{block_index}",
                    "bbox": [x0, y0, x1, y1],
                    "text": text,
                    "translation": "",
                    "font_role": "serif",
                    "font_size": round(spans[0]["size"], 2) if spans else 9,
                    "align": "left",
                    "keep": False,
                    "background": "page",
                }
            )
        result["pages"].append(item)
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")


def font_length(font: fitz.Font, text: str, size: float) -> float:
    return font.text_length(text, fontsize=size)


def tokens(text: str) -> list[str]:
    out: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch.isspace():
            out.append(ch)
            i += 1
        elif re.match(r"[A-Za-z0-9/._+-]", ch):
            j = i + 1
            while j < len(text) and re.match(r"[A-Za-z0-9/._+-]", text[j]):
                j += 1
            out.append(text[i:j])
            i = j
        else:
            out.append(ch)
            i += 1
    return out


def wrap_text(text: str, font: fitz.Font, size: float, width: float) -> list[str]:
    lines: list[str] = []
    for para_index, para in enumerate(text.split("\n")):
        current = ""
        for token in tokens(para):
            candidate = current + token
            if current and font_length(font, candidate, size) > width:
                lines.append(current.rstrip())
                current = token.lstrip()
            else:
                current = candidate
        if current.strip():
            lines.append(current.rstrip())
        if para_index != len(text.split("\n")) - 1:
            lines.append("")
    return lines


def draw_textbox(page: fitz.Page, rect: fitz.Rect, text: str, font_path: str, font_name: str, size: float, align: str) -> None:
    font = fitz.Font(fontfile=font_path)
    if align == "center":
        width = font.text_length(text, fontsize=size)
        x = rect.x0 + (rect.width - width) / 2
        y = rect.y0 + (rect.height - size * (font.ascender - font.descender)) / 2 + size * font.ascender
        page.insert_text((x, y), text, fontname=font_name, fontfile=font_path, fontsize=size, color=(0, 0, 0))
        return
    line_height = size * 1.45
    y = rect.y0 + size
    for line in wrap_text(text, font, size, rect.width):
        page.insert_text((rect.x0, y), line, fontname=font_name, fontfile=font_path, fontsize=size, color=(0, 0, 0))
        y += line_height


def apply(args: argparse.Namespace) -> None:
    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    fonts = default_fonts()
    doc = fitz.open(args.pdf)
    wanted = [page_spec["page"] - 1 for page_spec in spec["pages"]]
    for i in range(len(doc) - 1, -1, -1):
        if i not in wanted:
            doc.delete_page(i)
    page_map = {original: new for new, original in enumerate(wanted)}

    for page_spec in spec["pages"]:
        page = doc[page_map[page_spec["page"] - 1]]
        page_bg = tuple(page_spec.get("background") or page_background(page))
        for block in page_spec["blocks"]:
            if block.get("keep"):
                continue
            text = block.get("translation") or ""
            if not text:
                continue
            rect = fitz.Rect(block["bbox"])
            fill = page_bg if block.get("background", "page") == "page" else tuple(block["background"])
            page.add_redact_annot(rect, fill=fill)
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

        for block in page_spec["blocks"]:
            if block.get("keep"):
                continue
            text = block.get("translation") or ""
            if not text:
                continue
            role = block.get("font_role", "serif")
            font_path = fonts["sans"] if role == "sans" else fonts["serif"]
            font_name = "cnsans" if role == "sans" else "cnserif"
            draw_textbox(
                page,
                fitz.Rect(block["bbox"]),
                text,
                font_path,
                font_name,
                float(block.get("font_size") or 9),
                block.get("align", "left"),
            )

    try:
        doc.subset_fonts()
    except Exception:
        pass
    doc.save(args.out, garbage=4, deflate=True, clean=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p_inspect = sub.add_parser("inspect")
    p_inspect.add_argument("pdf")
    p_inspect.add_argument("--pages", default="1-4")
    p_inspect.add_argument("--out", required=True)
    p_inspect.set_defaults(func=inspect)

    p_apply = sub.add_parser("apply")
    p_apply.add_argument("pdf")
    p_apply.add_argument("--spec", required=True)
    p_apply.add_argument("--out", required=True)
    p_apply.set_defaults(func=apply)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
