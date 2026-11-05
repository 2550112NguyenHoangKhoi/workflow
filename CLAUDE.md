# CLAUDE.md

Read **[AGENTS.md](AGENTS.md)** first. It covers the architecture, repo map, API index, conventions, the full fix log (with file locations and root causes) and the open backlog.

Non-negotiables (details in AGENTS.md §9):
- Keep `if __name__ == "__main__":` as the last statement of `backend/main.py`.
- AI calls: `core.agent.agent_run` + `get_api_key`. Frontend: `api_key: getEngineKey()`.
- Inline styles use theme variables (dark mode).
- No secrets, databases or local-path notes in git.
- Before committing, run:
  - `python -m pytest tests/backend -q -p no:warnings`
  - `npx vite build`
  - `npm run lint | grep no-undef` (should print nothing)
