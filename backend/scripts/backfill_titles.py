"""Backfill conversation titles that were never written.

Conversations titled before the auto_title fix were saved with an empty string:
the reasoning model spent its whole max_tokens budget on hidden chain-of-thought,
returned "" with finish_reason="length", and "" is not an exception — so the
fallback never fired and the inbox rendered blank rows.

This repairs those rows from the exchange that is already stored. Safe to re-run:
it only touches conversations whose title is null or blank.

    python -m scripts.backfill_titles           # apply
    python -m scripts.backfill_titles --dry-run # preview
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from application.handlers.chat_handler import auto_title, fallback_title  # noqa: E402
from infrastructure.services.supabase_client import get_supabase  # noqa: E402


async def backfill(dry_run: bool = False) -> int:
    db = get_supabase()
    rows = (
        db.schema("misir")
        .table("chat_conversation")
        .select("id, title")
        .is_("archived_at", "null")
        .order("updated_at", desc=True)
        .execute()
    )

    targets = [r for r in (rows.data or []) if not (r.get("title") or "").strip()]
    if not targets:
        print("Nothing to backfill — every conversation has a title.")
        return 0

    print(f"{len(targets)} conversation(s) missing a title\n")
    fixed = 0
    for row in targets:
        cid = row["id"]
        msgs = (
            db.schema("misir")
            .table("chat_message")
            .select("role, content")
            .eq("conversation_id", cid)
            .order("created_at")
            .limit(2)
            .execute()
        )
        data = msgs.data or []
        if not data:
            # No exchange to title from; a fresh chat gets named on its first reply.
            print(f"  conv {cid}: no messages, skipped")
            continue

        user_msg = next((m["content"] for m in data if m["role"] == "user"), "")
        reply = next((m["content"] for m in data if m["role"] == "misir"), "")
        title = await auto_title(user_msg, reply) if reply else fallback_title(user_msg)

        if not title.strip():  # belt and braces: never write "" again
            title = fallback_title(user_msg)

        print(f"  conv {cid}: {title!r}")
        if not dry_run:
            db.schema("misir").table("chat_conversation").update({"title": title}).eq("id", cid).execute()
        fixed += 1

    print(f"\n{'Would update' if dry_run else 'Updated'} {fixed} conversation(s).")
    return fixed


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="show titles without writing")
    args = ap.parse_args()
    asyncio.run(backfill(dry_run=args.dry_run))
