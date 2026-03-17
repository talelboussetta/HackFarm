"""
HackFarmer — Smart LLM Router.
Supports per-agent provider pinning + fallback chain.
Parallel agents (frontend, backend, business) get different
providers to avoid rate limit stacking.
"""

import asyncio
import json
import logging
import re
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
    "groq_fast": {
        "base_url": "https://api.groq.com/openai/v1",
        "model": "llama-3.1-8b-instant",
        "priority": 3,
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "model": "meta-llama/llama-3.3-70b-instruct:free",
        "priority": 4,
    },
}

# Which provider to try FIRST for each agent.
# Fallback chain still applies if that provider fails.
AGENT_PROVIDER_HINTS = {
    "analyst":        ["gemini", "groq_fast", "groq", "openrouter"],
    "architect":      ["gemini", "groq", "openrouter"],
    "frontend_agent": ["groq", "gemini", "openrouter"],
    "backend_agent":  ["openrouter", "groq", "gemini"],
    "business_agent": ["groq_fast", "groq", "gemini", "openrouter"],
    "integrator":     ["gemini", "groq_fast", "groq", "openrouter"],
    "validator":      ["groq_fast", "gemini", "groq"],
    "github_agent":   ["gemini", "groq_fast"],
}


class LLMRouter:
    def __init__(self, providers: list[dict]):
        """
        providers: [{"provider": "gemini", "decrypted_key": "..."},
                    {"provider": "groq",   "decrypted_key": "..."}]
        Builds one AsyncOpenAI client per provider supplied.
        Also adds groq_fast automatically if groq key present.
        """
        if not providers:
            raise ValueError("No LLM providers available")

        self._clients: dict[str, dict] = {}
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        self._call_count = 0

        for p in providers:
            name = p["provider"]
            if name not in PROVIDER_CONFIGS:
                continue
            cfg = PROVIDER_CONFIGS[name]
            self._clients[name] = {
                "client": AsyncOpenAI(
                    api_key=p["decrypted_key"],
                    base_url=cfg["base_url"],
                    timeout=50.0,
                ),
                "model": cfg["model"],
                "priority": cfg["priority"],
            }
            # Auto-add groq_fast when groq key is present
            if name == "groq":
                cfg_fast = PROVIDER_CONFIGS["groq_fast"]
                self._clients["groq_fast"] = {
                    "client": AsyncOpenAI(
                        api_key=p["decrypted_key"],
                        base_url=cfg_fast["base_url"],
                        timeout=50.0,
                    ),
                    "model": cfg_fast["model"],
                    "priority": cfg_fast["priority"],
                }

        if not self._clients:
            raise ValueError("No valid LLM providers configured")

    def _get_ordered_clients(self, agent_name: str | None) -> list[tuple]:
        """
        Return clients in the preferred order for this agent.
        Uses AGENT_PROVIDER_HINTS if agent_name is given,
        otherwise falls back to priority order.
        """
        hints = AGENT_PROVIDER_HINTS.get(agent_name, [])

        ordered = []
        # First: add hinted providers in hint order
        for hint in hints:
            if hint in self._clients:
                ordered.append((hint, self._clients[hint]))
        # Then: add remaining providers sorted by priority
        for name, info in sorted(
            self._clients.items(), key=lambda x: x[1]["priority"]
        ):
            if name not in [o[0] for o in ordered]:
                ordered.append((name, info))

        return ordered

    async def complete(
        self,
        prompt: str,
        response_format: str = "text",
        temperature: float = 0.3,
        agent_name: str | None = None,
    ) -> str:
        """
        Make an LLM call.
        Pass agent_name to use the optimal provider for that agent.
        Falls back through the chain on 429 or error.
        """
        if response_format == "json":
            prompt += (
                "\n\nRespond with ONLY valid JSON. "
                "No markdown. No explanation. No code fences."
            )

        ordered = self._get_ordered_clients(agent_name)

        for name, info in ordered:
            client = info["client"]
            model = info["model"]
            try:
                response = await asyncio.wait_for(
                    client.chat.completions.create(
                        model=model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=temperature,
                    ),
                    timeout=45.0,
                )
                content = response.choices[0].message.content
                if content is None:
                    continue
                result = content.strip()
                # Strip markdown code fences that LLMs often wrap JSON in
                if result.startswith("```"):
                    # Remove opening fence (```json, ```JSON, ```, etc.)
                    result = re.sub(r'^```\w*\s*\n?', '', result)
                    # Remove closing fence
                    result = re.sub(r'\n?```\s*$', '', result)
                    result = result.strip()

                # Track token usage from API response
                usage = getattr(response, "usage", None)
                input_tokens = getattr(usage, "prompt_tokens", 0) or 0
                output_tokens = getattr(usage, "completion_tokens", 0) or 0
                self._total_input_tokens += input_tokens
                self._total_output_tokens += output_tokens
                self._call_count += 1

                logger.info(
                    f"[LLM] agent={agent_name or '?'} "
                    f"provider={name} in={input_tokens} out={output_tokens}"
                )

                # Validate JSON responses — retry once on parse failure
                if response_format == "json":
                    try:
                        json.loads(result)
                    except (json.JSONDecodeError, ValueError):
                        logger.warning(
                            f"[LLM] {name} returned invalid JSON for "
                            f"agent={agent_name}, retrying..."
                        )
                        # One retry with stronger instruction
                        try:
                            retry_response = await asyncio.wait_for(
                                client.chat.completions.create(
                                    model=model,
                                    messages=[
                                        {"role": "user", "content": prompt},
                                        {"role": "assistant", "content": result},
                                        {"role": "user", "content": "That was not valid JSON. Return ONLY a valid JSON object, nothing else."},
                                    ],
                                    temperature=0.1,
                                ),
                                timeout=45.0,
                            )
                            retry_content = retry_response.choices[0].message.content
                            if retry_content:
                                retry_result = retry_content.strip()
                                if retry_result.startswith("```"):
                                    retry_result = re.sub(r'^```\w*\s*\n?', '', retry_result)
                                    retry_result = re.sub(r'\n?```\s*$', '', retry_result)
                                    retry_result = retry_result.strip()
                                json.loads(retry_result)  # validate
                                result = retry_result
                                r_usage = getattr(retry_response, "usage", None)
                                self._total_input_tokens += getattr(r_usage, "prompt_tokens", 0) or 0
                                self._total_output_tokens += getattr(r_usage, "completion_tokens", 0) or 0
                                self._call_count += 1
                        except Exception:
                            pass  # let the agent handle the invalid JSON

                return result

            except asyncio.TimeoutError:
                logger.warning(f"[LLM] {name} timed out (45s)")
                continue
            except Exception as e:
                msg = str(e).lower()
                if "429" in msg or "rate_limit" in msg or "rate limit" in msg:
                    logger.warning(f"[LLM] {name} rate limited — trying next")
                else:
                    logger.error(f"[LLM] {name} failed: {e}")
                continue

        raise RuntimeError(
            f"All LLM providers exhausted for agent={agent_name}"
        )

    @property
    def token_usage(self) -> dict:
        """Return accumulated token usage stats."""
        return {
            "input_tokens": self._total_input_tokens,
            "output_tokens": self._total_output_tokens,
            "total_tokens": self._total_input_tokens + self._total_output_tokens,
            "llm_calls": self._call_count,
        }
