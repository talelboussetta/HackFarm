"""
HackFarmer — ZIP builder.
Creates in-memory ZIP from generated files dict.
"""

import io
import zipfile


def build_zip(job_id: str, files: dict[str, str]) -> bytes:
    """
    Create an in-memory ZIP archive.
    Each key in files becomes a path inside the ZIP.
    Returns: raw bytes of the ZIP file.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in sorted(files.items()):
            zf.writestr(path, content)
    return buf.getvalue()
