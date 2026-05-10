---
name: marksnip-dev-philosophy
description: >
  Core development philosophy for the MarkSnip browser extension. Use this skill
  whenever implementing a bug fix, new feature, or any code change to MarkSnip —
  especially when a specific website, page, or reproduction case is involved.
  Always consult this before writing or proposing any code changes.
---

# MarkSnip Development Philosophy

## The Core Constraint

MarkSnip is not a tool built for a specific website or a known set of websites. It is built for **the entire web** — an effectively infinite set of HTML structures, DOM patterns, content types, and site architectures. This has one critical implication:

> **Any change to MarkSnip's behavior is a policy change, not a patch. It applies to every website simultaneously.**

This must be the first thing on your mind before writing a single line of code.

---

## The Balance: Abstract vs. Specific

When implementing a fix or feature, the solution must be calibrated correctly on a spectrum:

```
Too Narrow ◄─────────────────────────────────► Too Broad
(hardcoded to one site)              (changes baseline behavior for all sites)
```

Both extremes are wrong.

### Too Narrow (Never acceptable)
- Checking for a specific domain, URL, class name, or HTML pattern
- Any logic that says "if this site does X, then Y"
- Hardcoded selectors, strings, or IDs tied to a specific page

This solves nothing for the general case, and creates invisible technical debt.

### Too Broad (High risk)
- Changing default behavior in the core pipeline (Readability extraction, Turndown rules, template processing)
- Modifying how content is stripped, parsed, or transformed for *everyone* based on *one* reproduction case
- Treating a sample page as the full specification for a feature

This silently breaks sites that were working correctly before, in ways that won't surface until users report regressions.

### The Right Level
The correct solution is one that:
- Addresses the **underlying general problem**, not the specific symptom observed on the sample site
- Does not assume the sample page is representative of all cases where the problem exists
- Introduces new behavior **additionally** rather than replacing existing behavior

---

## The Sample Page Is Evidence, Not Specification

When a GitHub issue includes a sample website to reproduce a problem, that page is a **single data point**. It illustrates the class of problem, but it does not define the full scope of the solution.

**Do not:**
- Inspect the sample page and then design the fix around what you observe there
- Expand or contract the scope of a fix based on what that one page happens to do

**Do:**
- Understand what the user is asking for conceptually
- Think about how that concept generalizes across websites
- Implement the general concept — even if the sample page uses a slightly different mechanism

### Example

An issue requests an option to include `aria-hidden` content. The sample page happens to hide content with `display:none`. The wrong move is to implement a "skip hidden content" toggle that covers `display:none`, `visibility:hidden`, `[hidden]`, and `aria-hidden` all at once, because that's what the sample page does. The right move is to implement what was actually asked for — and do it correctly and generally.

---

## Rules for Safe Implementation

1. **Never hardcode anything.** No domains, no selectors, no site-specific strings. Ever.

2. **New behavior must be opt-in.** Add new options with safe defaults that preserve existing behavior. Do not change what users who haven't touched settings will experience.

3. **Default behavior is sacred.** The current behavior works for the majority of the web. A fix must not silently alter it, even if the fix seems like an improvement.

4. **Core pipeline changes require disproportionate justification.** Changes to Readability extraction, Turndown rules, or template processing affect every single conversion. The bar for touching these is high.

5. **Site-specific quirks belong in `site-rules.js`.** If a behavior really is unique to a domain or class of domains, that's what `site-rules.js` is for — not the core logic.

6. **Test your mental model against other sites, not just the sample.** Before finalizing a fix, ask: does this change make sense for Wikipedia? For a news article? For a documentation page? For a forum? If it breaks the mental model for any common site type, reconsider.

---

## Live Snapshot Verification

For every MarkSnip bug fix or feature, include the live markdown snapshot workflow in the verification pass unless the change clearly cannot affect clipping, extraction, conversion, options, popup capture, service-worker routing, or browser output. If it is skipped, state the concrete reason.

Default live snapshot command:

```powershell
npm.cmd run verify:live-snapshots
```

When a fix is option-dependent, also run the relevant option mode. For hidden-content changes, run:

```powershell
npm.cmd run verify:live-snapshots:hidden
```

When an issue includes a public reproduction URL, add that URL as a case in `src/tests/helpers/live-public-cases.js` and run that case explicitly:

```powershell
npm.cmd run snapshot:live-markdown -- --cases <case-id>
```

Review the generated `src/test-artifacts/live-markdown-comparisons/<run-id>/diff/summary.json` before finalizing. A diff is not automatically a failure, but it must be understood and described as intentional or risky.

If live network or browser access is unavailable, do not pretend the verification passed. Say that the live snapshot workflow could not be run, include the blocker, and rely on the narrower local tests only as a fallback.

---

## Summary

When you receive a bug report or feature request:

1. Read what the user is actually asking for — not just what the sample page shows
2. Identify the general, abstract version of the problem
3. Implement a solution at that level of abstraction
4. Ensure it is opt-in and does not change existing defaults
5. Do not hardcode anything specific to the sample site or any site
