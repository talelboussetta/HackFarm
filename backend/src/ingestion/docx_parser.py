"""
HackFarmer — DOCX parser.
Extracts text from DOCX using python-docx.
"""

import io
import logging

from docx import Document

logger = logging.getLogger(__name__)


def parse_docx(file_bytes: bytes) -> str:
    """
    Extract all paragraphs from a DOCX file.
    Skips empty paragraphs. Returns empty string on failure.
    """
    try:
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                paragraphs.append(text)
        return "\n".join(paragraphs)
    except Exception as e:
        logger.warning(f"[DOCX] Failed to parse DOCX: {e}")
        return ""
