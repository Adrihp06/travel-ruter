"""
MCP Tool: web_search

Provides real-time web search using OpenAI's Responses API with built-in
web_search tool.  Returns synthesised answers with source citations.
"""

import logging
from typing import Optional

from mcp.server.fastmcp import FastMCP

from mcp_server.config import mcp_settings

logger = logging.getLogger(__name__)


def register_tools(server: FastMCP):
    """Register web-search tool with the MCP server."""

    @server.tool()
    async def web_search(
        query: str,
        context: Optional[str] = None,
    ) -> dict:
        """
        Search the internet for real-time information using OpenAI web search.

        Use this tool whenever the user asks you to look something up, wants
        current/up-to-date information, or requests details you don't already
        have — prices, opening hours, events, news, reviews, visa requirements,
        safety advisories, local tips, transportation schedules, etc.

        Args:
            query: The search query. Be specific and include location context
                   when relevant.
                   - Good: "best ramen restaurants in Shibuya Tokyo 2026"
                   - Good: "entry requirements for EU citizens visiting Japan 2026"
                   - Avoid: "restaurants" (too vague)
            context: Optional extra context to help refine the search, e.g.
                     "The user is planning a trip to Tokyo in April 2026".

        Returns:
            A dict with:
            - answer: The synthesised answer text (markdown)
            - query: The original query
            - success: Whether the search succeeded
            - error: Error message if it failed
        """
        logger.info("web_search called with query='%s'", query)

        api_key = mcp_settings.OPENAI_API_KEY
        if not api_key:
            logger.warning("web_search: OPENAI_API_KEY not configured")
            return {
                "answer": "",
                "query": query,
                "success": False,
                "error": "OpenAI API key not configured. Set OPENAI_API_KEY in environment.",
            }

        try:
            import httpx

            # Build the input prompt
            user_input = query
            if context:
                user_input = f"{query}\n\nAdditional context: {context}"

            payload = {
                "model": mcp_settings.OPENAI_SEARCH_MODEL,
                "tools": [{"type": "web_search"}],
                "input": user_input,
            }

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/responses",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

            # Extract the text answer from the response
            answer = data.get("output_text", "")

            # If output_text isn't directly available, parse from output array
            if not answer and "output" in data:
                for item in data["output"]:
                    if item.get("type") == "message":
                        for content in item.get("content", []):
                            if content.get("type") == "output_text":
                                answer += content.get("text", "")

            logger.info(
                "web_search succeeded for query='%s' (%d chars)",
                query,
                len(answer),
            )

            return {
                "answer": answer,
                "query": query,
                "success": True,
            }

        except httpx.HTTPStatusError as e:
            error_body = e.response.text[:500] if e.response else str(e)
            logger.error("web_search HTTP error: %s — %s", e.response.status_code, error_body)
            return {
                "answer": "",
                "query": query,
                "success": False,
                "error": f"OpenAI API error ({e.response.status_code}): {error_body}",
            }
        except Exception as e:
            logger.error("web_search failed: %s", e)
            return {
                "answer": "",
                "query": query,
                "success": False,
                "error": str(e),
            }

    logger.info("Registered web search tool: web_search")
