"""Async wrapper for the synchronous supabase-py client.

supabase-py 2.x is sync-only: every ``.execute()`` is a blocking HTTP call. In
an ``async def`` endpoint that blocks the event loop and serializes all other
requests. Two ways to avoid that in this codebase:

1. Pure-sync endpoints are declared ``def`` (not ``async def``) — FastAPI then
   runs them in its threadpool automatically, so their blocking DB calls don't
   touch the event loop. No code change at the call sites.

2. Genuinely-async endpoints (which also ``await`` LLM/streaming work) keep
   ``async def`` and wrap each blocking query with ``await aexec(query)`` so the
   ``.execute()`` runs off the loop.
"""
from __future__ import annotations

import asyncio
from typing import Any


async def aexec(query: Any) -> Any:
    """Run a supabase-py query builder's blocking ``.execute()`` off the event loop."""
    return await asyncio.to_thread(query.execute)
