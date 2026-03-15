"""
HackFarmer — n8n webhook caller (fire-and-forget).
"""

import logging

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)


def fire_webhook(payload: dict) -> None:
    """Fire a webhook to n8n. Non-critical — failures are logged and ignored."""
    if not settings.N8N_WEBHOOK_URL:
        return
    try:
        httpx.post(settings.N8N_WEBHOOK_URL, json=payload, timeout=5.0)
    except Exception as e:
        logger.warning(f"[n8n] Webhook failed (non-critical): {e}")
