---
trigger: always_on
---

# Safety and scope
## Only touch what the task needs
- “Do not modify config, database schema, CI/CD, or deployment files unless the task explicitly says to.”
- “If a change might break other parts of the app, stop and ask me before continuing.”

##   No dangerous terminal actions
- “Only run read‑only or safe commands by default (tests, linters, listing files). Ask for confirmation before any command that installs, deletes, or migrates.”