#!/usr/bin/env python3
"""Helpers for watching an invoice batch (Notion log + QuickBooks) for changes.

Every subcommand reads the most recent tool results straight from this Claude
session's transcript, so page text and invoice JSON never have to be retyped:
call the Notion/QuickBooks tool first, then run the subcommand.

  watch.py STATE log-diff     latest fetch of the log page vs the saved baseline
  watch.py STATE log-save     latest fetch -> baseline; records last edit + thread ids
  watch.py STATE threads      after a page-wide get_comments call: thread ids it
                              left out (fetch those by discussion_id), and threads
                              whose last comment isn't "🤖 Claude:"
  watch.py STATE qbo-diff     latest QuickBooks read vs the invoice snapshot in STATE
  watch.py STATE qbo-save     latest QuickBooks read -> snapshot (keeps service dates)

STATE is the batch's state JSON (see references/state-file.md). Pass
--transcript PATH to read a specific session transcript; by default the newest
transcript in this project that mentions the batch's log page is used.
"""
import argparse
import difflib
import json
import os
import re
import sys

CLAUDE_MARK = "🤖 Claude:"
SAVED_TO = re.compile(r"Output has been saved to (\S+?\.txt)")
DISCUSSION = r"discussion://{page}/[0-9a-f-]{{36}}/([0-9a-f-]{{36}})"


def dashed(page_id):
    p = page_id.replace("-", "")
    return f"{p[:8]}-{p[8:12]}-{p[12:16]}-{p[16:20]}-{p[20:]}" if len(p) == 32 else page_id


def project_dir():
    return os.path.expanduser("~/.claude/projects/" + os.getcwd().replace("/", "-").replace(".", "-"))


def find_transcript(log_page):
    d = project_dir()
    files = sorted((os.path.join(d, f) for f in os.listdir(d) if f.endswith(".jsonl")),
                   key=os.path.getmtime, reverse=True)
    needles = (log_page, log_page.replace("-", ""))
    for f in files[:8]:
        with open(f, "rb") as fh:
            fh.seek(max(0, os.path.getsize(f) - 4_000_000))
            tail = fh.read().decode("utf-8", "ignore")
        if any(n in tail for n in needles):
            return f
    sys.exit(f"no recent transcript in {d} mentions the log page; pass --transcript")


def body_text(content):
    if isinstance(content, list):
        content = "".join(x.get("text", "") for x in content if isinstance(x, dict))
    content = content or ""
    m = SAVED_TO.search(content)
    if m and os.path.exists(m.group(1)):
        content = open(m.group(1)).read()
    return content


def tool_results(transcript, match):
    """Yield (input, result_text) in order for tool calls where match(name, input) is true."""
    calls = {}
    for line in open(transcript):
        try:
            o = json.loads(line)
        except ValueError:
            continue
        content = (o.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        for c in content:
            if not isinstance(c, dict):
                continue
            if c.get("type") == "tool_use" and match(c.get("name", ""), c.get("input") or {}):
                calls[c["id"]] = c.get("input") or {}
            elif c.get("type") == "tool_result" and c.get("tool_use_id") in calls:
                yield calls[c["tool_use_id"]], body_text(c.get("content"))


def same_page(value, page):
    v = str(value or "").split("?")[0].rstrip("/").split("/")[-1]
    v = v.split("-")[-1] if len(v.replace("-", "")) > 32 else v
    return v.replace("-", "") == page.replace("-", "")


def latest_fetch(transcript, page):
    last = None
    for _, text in tool_results(transcript, lambda n, i: n.endswith("notion-fetch") and same_page(i.get("id"), page)):
        last = text
    if last is None:
        sys.exit("no notion-fetch of the log page in the transcript yet: fetch it first")
    try:
        last = json.loads(last)
    except ValueError:
        last = {"text": last}
    text = last.get("text", "")
    edited = last.get("page_last_edited_at") or (re.search(r'page_last_edited_at"?:\s*"([^"]+)', text) or [None, None])[1]
    start, end = text.find("<content>"), text.rfind("</content>")
    content = text[start + len("<content>"):end].strip() + "\n" if start >= 0 else text
    return content, edited


def load(path):
    return json.load(open(path))


def save(path, state):
    json.dump(state, open(path, "w"), indent=2, ensure_ascii=False)


def log_diff(state, transcript, path):
    log = state["log"]
    content, edited = latest_fetch(transcript, state["log_page_id"])
    ids = set(re.findall(DISCUSSION.format(page=dashed(state["log_page_id"])), content))
    new_ids = sorted(ids - set(log.get("known_discussion_ids", [])))
    print(f"page_last_edited_at {edited}  (my last edit {log.get('last_edited_by_me')})")
    print("new threads:", ", ".join(new_ids) if new_ids else "none")
    base = log.get("baseline_file")
    if not base or not os.path.exists(base):
        print("no baseline yet: run log-save")
        return
    old = open(base).read().splitlines(keepends=True)
    diff = [l for l in difflib.unified_diff(old, content.splitlines(keepends=True), "baseline", "now", n=1)]
    print("".join(diff) if diff else "page text: no changes since the baseline")


def log_save(state, transcript, path):
    log = state["log"]
    content, edited = latest_fetch(transcript, state["log_page_id"])
    base = log.get("baseline_file") or os.path.join(os.path.dirname(os.path.abspath(path)), "log-baseline.md")
    open(base, "w").write(content)
    log["baseline_file"] = base
    log["last_edited_by_me"] = edited
    log["known_discussion_ids"] = sorted(set(re.findall(DISCUSSION.format(page=dashed(state["log_page_id"])), content)))
    save(path, state)
    print(f"baseline saved ({len(content)} chars), last edit {edited}, {len(log['known_discussion_ids'])} threads")


def threads(state, transcript, path):
    """A sweep starts with one page-wide get_comments call (no discussion_id).
    Threads it leaves out are listed as NOT READ YET: fetch each by
    discussion_id, then run this again to see which are unanswered."""
    page = state["log_page_id"]
    pattern = re.compile(DISCUSSION.format(page=dashed(page)))
    latest = {}
    order = 0
    sweep_start = None
    replied = {}  # discussion id -> order of my latest reply posted in it
    for inp, text in tool_results(transcript, lambda n, i: n.endswith(("notion-get-comments", "notion-create-comment"))
                                  and same_page(i.get("page_id"), page)):
        order += 1
        if "rich_text" in inp or "markdown" in inp:
            d = str(inp.get("discussion_id", "")).rstrip("/").split("/")[-1]
            if d:
                replied[d] = order
            continue
        if not inp.get("discussion_id"):
            sweep_start = order
        try:
            text = json.loads(text).get("text") or ""
        except (ValueError, AttributeError):
            pass
        for block in re.split(r"(?=<discussion id=)", text):
            m = pattern.search(block)
            if not m or not block.startswith("<discussion"):
                continue
            comments = re.findall(r'<comment [^>]*datetime=\\?"([^"\\]+)\\?"[^>]*>(.*?)</comment>', block, re.S)
            latest[m.group(1)] = (order, comments)
    if sweep_start is None:
        sys.exit("start the sweep with notion-get-comments for the log page (no discussion_id), then rerun")
    known = set(state["log"].get("known_discussion_ids", []))
    try:  # threads anchored since the last log-save count too
        known |= set(pattern.findall(latest_fetch(transcript, page)[0]))
    except SystemExit:
        pass
    known = sorted(known)
    unread, unanswered = [], []
    for d in known:
        if d not in latest or latest[d][0] < sweep_start:
            unread.append(d)
            continue
        if replied.get(d, -1) > latest[d][0]:
            continue  # I replied after the last read
        comments = latest[d][1]
        tail = []
        for dt, txt in reversed(comments):
            if txt.strip().startswith(CLAUDE_MARK):
                break
            tail.append((dt, txt.strip()))
        if tail:
            unanswered.append((d, list(reversed(tail))))
    print(f"{len(known)} known threads; {len(unread)} not read in this sweep; {len(unanswered)} unanswered")
    for d in unread:
        print("NOT READ YET:", d)
    for d, tail in unanswered:
        print(f"\nUNANSWERED {d}")
        for dt, txt in tail:
            print(f"  {dt}: {re.sub('<[^>]+>', ' ', txt)[:600]}")


def latest_invoices(state, transcript):
    docs = set(state["invoices"])
    found = {}
    for inp, text in tool_results(transcript, lambda n, i: n.endswith("qbo_sales_get_invoices")):
        try:
            data = json.loads(text).get("data") or []
        except ValueError:
            continue
        for inv in data:
            if inv.get("reference_number") in docs:
                found[inv["reference_number"]] = inv
    missing = docs - set(found)
    if missing:
        sys.exit("no QuickBooks read yet for #" + ", #".join(sorted(missing)))
    return found


def line_view(l):
    return {"id": l["id"], "item": l["item_name"], "item_id": l.get("item_id"), "qty": float(l["quantity"]),
            "rate": float(l["rate"]), "amount": float(l["amount"]), "description": l["description"]}


def qbo_diff(state, transcript, path):
    live = latest_invoices(state, transcript)
    diffs, total = [], 0.0
    for doc in sorted(state["invoices"]):
        inv, want = live[doc], state["invoices"][doc]
        total += float(inv["amount"])
        for key, got in (("total", float(inv["amount"])), ("txn_date", inv["txn_date"]), ("due_date", inv["due_date"])):
            if got != want.get(key):
                diffs.append(f"#{doc} {key}: {want.get(key)} -> {got}")
        got_lines = [line_view(l) for l in inv["lines"] if "id" in l]
        want_by_id = {l["id"]: l for l in want.get("lines", [])}
        if [l["id"] for l in got_lines] != [l["id"] for l in want.get("lines", [])]:
            diffs.append(f"#{doc} lines: {[l['id'] for l in want.get('lines', [])]} -> {[l['id'] for l in got_lines]}")
        for l in got_lines:
            w = want_by_id.get(l["id"])
            if w is None:
                diffs.append(f"#{doc} new line {l['id']}: {l['item']} {l['qty']} x {l['rate']} = {l['amount']} {l['description']!r}")
                continue
            for key in ("item", "qty", "rate", "amount", "description"):
                if l[key] != w.get(key):
                    diffs.append(f"#{doc} line {l['id']} {key}: {w.get(key)!r} -> {l[key]!r}")
    print("\n".join(diffs) if diffs else "invoices match the snapshot")
    print(f"batch total {total:,.2f} across {len(live)} invoices")


def qbo_save(state, transcript, path):
    live = latest_invoices(state, transcript)
    for doc, inv in live.items():
        old = {l["id"]: l for l in state["invoices"][doc].get("lines", [])}
        lines = []
        for l in inv["lines"]:
            if "id" not in l:
                continue
            v = line_view(l)
            v["service_date"] = old.get(l["id"], {}).get("service_date", "UNKNOWN")
            lines.append(v)
        state["invoices"][doc].update(total=float(inv["amount"]), txn_date=inv["txn_date"], due_date=inv["due_date"],
                                      txn_id=inv["id"].split(":")[-1], lines=lines)
    save(path, state)
    unknown = [f"#{d} line {l['id']}" for d, i in state["invoices"].items() for l in i["lines"] if l["service_date"] == "UNKNOWN"]
    print(f"snapshot saved for {len(live)} invoices")
    if unknown:
        print("set service_date by hand (QuickBooks doesn't return it) for:", ", ".join(unknown))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("state")
    ap.add_argument("command", choices=["log-diff", "log-save", "threads", "qbo-diff", "qbo-save"])
    ap.add_argument("--transcript")
    a = ap.parse_args()
    state = load(a.state)
    transcript = a.transcript or find_transcript(state["log_page_id"])
    {"log-diff": log_diff, "log-save": log_save, "threads": threads,
     "qbo-diff": qbo_diff, "qbo-save": qbo_save}[a.command](state, transcript, a.state)


if __name__ == "__main__":
    main()
