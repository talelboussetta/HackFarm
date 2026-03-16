"""
HackFarmer — LLM Router.
Instantiated per-job. Handles fallback and routing across Gemini, Groq, and OpenRouter.
"""

import logging
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

PROVIDER_CONFIGS = {
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "model": "gemini-2.0-flash",
        "priority": 1,
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "llama-3.3-70b-versatile",
        "priority": 2,
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "model": "meta-llama/llama-3.3-70b-instruct:free",
        "priority": 3,
    },
}


class LLMRouter:
    def __init__(self, providers: list[dict]):
        """
        providers expected format: [{"provider": "gemini", "decrypted_key": "..."}]
        """
        if not providers:
            raise ValueError("No LLM providers available")

        clients = []
        for p in providers:
            p_name = p["provider"]
            if p_name in PROVIDER_CONFIGS:
                cfg = PROVIDER_CONFIGS[p_name]
                client = AsyncOpenAI(
                    api_key=p["decrypted_key"],
                    base_url=cfg["base_url"],
                    timeout=120.0,
                )
                clients.append({
                    "client": client,
                    "name": p_name,
                    "model": cfg["model"],
                    "priority": cfg["priority"]
                })

        if not clients:
            raise ValueError("No valid LLM providers configured")

        # Sort clients by priority: 1, 2, 3
        self.clients = sorted(clients, key=lambda x: x["priority"])

    async def complete(
        self,
        prompt: str,
        response_format: str = "text",
        temperature: float = 0.3
    ) -> str:
        """
        Make an LLM call. Tries providers in priority order.
        """
        if response_format == "json":
            prompt += "\n\nRespond with ONLY valid JSON. No markdown. No explanation. No code fences."

        for client_info in self.clients:
            client = client_info["client"]
            name = client_info["name"]
            model = client_info["model"]

            try:
                response = await client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                )

                content = response.choices[0].message.content
                if content is None:
                    continue

                logger.info(f"[LLM] Used {name}, ~{len(prompt)//4} tokens")
                return content.strip()

            except Exception as e:
                err_msg = str(e).lower()
                # If HTTP 429 or rate limit, warn. Else error.
                if "429" in err_msg or "rate_limit" in err_msg:
                    logger.warning(f"[LLM] {name} rate limited: {e}")
                else:
                    logger.error(f"[LLM] {name} failed: {e}")
                continue

        raise RuntimeError("All LLM providers exhausted")
