"""
HackFarmer — PDF parser.
Extracts text from PDF using PyMuPDF (fitz).
"""

import logging

import fitz  # pymupdf

logger = logging.getLogger(__name__)


def parse_pdf(file_bytes: bytes) -> str:
    """
    Extract text from every page of a PDF.
    Returns empty string on total failure — never raises.
    """
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = []
        for page in doc:
            text = page.get_text()
            if text and text.strip():
                pages.append(text.strip())
        doc.close()
        return "\n\n".join(pages)
    except Exception as e:
        logger.warning(f"[PDF] Failed to parse PDF: {e}")
        return ""
