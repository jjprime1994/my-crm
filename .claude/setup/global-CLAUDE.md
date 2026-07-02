# JJ's global rules (all Windows PCs)

## Projects

- **Nu Vending CRM** (main work): `C:\Users\JJ Tan\OneDrive\Documents\Claude\Projects\my-crm`. Launch Claude Code there — type `crm` in PowerShell — so the project's CLAUDE.md, skills, and permissions load. If a session starts elsewhere and the user mentions "my crm", that folder is what they mean.
- **`D:\Claude Code 1`**: Instagram/social-media design work (HTML mockups, carousels).

## Windows rules

- Windows PowerShell here is **5.1**: no `&&`/`||` chaining, no ternary `?:`, no `?.`/`??` operators — parser errors. Use `;` and `if/else`.
- The Bash tool is Git Bash: POSIX commands only. Never run PowerShell cmdlets (`Get-ChildItem`, `Select-Object`, `Get-Content`, `Start-Sleep`, `2>$null`) through Bash.
- Python: use the `py` launcher, not `python` (the Microsoft Store stub intercepts `python`).
- Never update Claude Code from inside a running session — the exe is locked (EBUSY). Have the user close Claude Code, then run `npm i -g @anthropic-ai/claude-code` in a fresh PowerShell.
- Never echo, request, or store database connection strings or other secrets in chat, commands, or settings files.
