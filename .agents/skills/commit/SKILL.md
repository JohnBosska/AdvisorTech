---
name: commit
description: Create Git commits for repository changes, following the repository's language and issue-branch naming conventions.
metadata:
  short-description: Commit repository changes
---

# Commit Changes

Use this skill when asked to create a Git commit.

## Message conventions

- Inspect the repository name with `git rev-parse --show-toplevel` and the current branch with `git branch --show-current` before drafting the message.
- If the branch matches `issue_<issue_number>` (where the suffix is a decimal issue number), write the commit subject in Russian and begin it exactly with `<repo_name>#<issue_number> `, for example: `techadviser-api#42 добавлена проверка доступности записи`.
- For other branch names, follow the repository's established commit convention and language. Do not infer an issue number from unrelated branch text.
- Keep the subject concise and describe the actual change. Use a body only when useful.

## Commit workflow

- Inspect `git status` and the relevant diff before committing. Stage only changes that belong to the requested commit; preserve unrelated staged and unstaged work.
- If the requested scope is ambiguous, inspect the diff and choose a focused commit for the requested work.
- Create the commit only when the user asks to commit. Then report the commit hash and subject.
