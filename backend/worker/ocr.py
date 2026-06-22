"""
ocr.py — Document text extraction layer.

Supports:
  - Native/digital PDFs: pdfplumber (fast, layout-aware)
  - Scanned PDFs: pypdfium2 page rendering → Tesseract OCR
  - HTML files: BeautifulSoup text extraction
"""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text(file_path: str, filename: str) -> list[dict]:
    """
    Main extraction dispatcher. Returns a list of page dicts:
        [{"page_number": int, "text": str, "method": str}, ...]
    """
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return _extract_from_pdf(file_path)
    elif ext in {".html", ".htm"}:
        return _extract_from_html(file_path)
    else:
        logger.warning(f"Unsupported file type for OCR: {ext}")
        return []


def _extract_from_pdf(file_path: str) -> list[dict]:
    """
    Two-pass PDF extraction:
    1. pdfplumber for digital (selectable) text.
    2. pypdfium2 rendering + Tesseract OCR for scanned pages.
    """
    pages: list[dict] = []

    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            for idx, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                if len(text.strip()) > 50:
                    pages.append({
                        "page_number": idx + 1,
                        "text": text,
                        "method": "digital",
                    })
                else:
                    pages.append({
                        "page_number": idx + 1,
                        "text": "",
                        "method": "needs_ocr",
                    })
    except Exception as e:
        logger.error(f"pdfplumber failed for {file_path}: {e}")
        # Mark all pages for OCR
        try:
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(file_path)
            for idx in range(len(pdf)):
                pages.append({"page_number": idx + 1, "text": "", "method": "needs_ocr"})
        except Exception as inner_e:
            logger.error(f"pypdfium2 fallback also failed: {inner_e}")
            return []

    # OCR pass — only for pages that need it
    needs_ocr = [p for p in pages if p["method"] == "needs_ocr"]
    if needs_ocr:
        logger.info(f"{len(needs_ocr)} page(s) require OCR in {file_path}")
        try:
            import pypdfium2 as pdfium
            import pytesseract

            pdf = pdfium.PdfDocument(file_path)
            for p in needs_ocr:
                idx = p["page_number"] - 1
                page = pdf[idx]
                bitmap = page.render(scale=2)  # scale=2 for better OCR accuracy
                pil_image = bitmap.to_pil()
                p["text"] = pytesseract.image_to_string(pil_image)
                p["method"] = "ocr"
        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")

    return pages


def _extract_from_html(file_path: str) -> list[dict]:
    """Extract visible text from an HTML file using BeautifulSoup."""
    try:
        from bs4 import BeautifulSoup

        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            html = f.read()

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "meta", "link"]):
            tag.decompose()

        lines = (line.strip() for line in soup.get_text().splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = "\n".join(chunk for chunk in chunks if chunk)

        return [{"page_number": 1, "text": text, "method": "html"}]
    except Exception as e:
        logger.error(f"HTML extraction failed for {file_path}: {e}")
        return []
