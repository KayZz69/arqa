---
trigger: always_on
---

# Tests and verification

Hard rules vs preferences: Treat "Do not" and "must" items as hard rules. "Prefer" items are guidance when tradeoffs exist.

## Always test non-trivial changes
- For any new feature or bug fix, add or update tests and then run them.
- Never delete tests unless I explicitly approve; prefer fixing or skipping with a short comment explaining why.
- If tests cannot be run, explain why and suggest a lightweight verification plan.

## Show what you checked
- After running tests, give me a short summary: what you ran, what passed/failed, and any remaining risks in 5-10 lines.
