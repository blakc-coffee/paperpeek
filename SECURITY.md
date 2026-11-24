# Security policy

Please report security problems privately through **[GitHub's private vulnerability reporting](https://github.com/blakc-coffee/paperpeek/security/advisories/new)**, not as a public issue.

Useful to include: the affected version, the page where it happens, and the steps to reproduce.

## Scope

PaperPeek runs on web pages, so these matter most:
- page content executing inside the popup (cloned formulas are sanitized);
- data leaving the browser without consent;
- permissions broader than the user granted.

Only the latest release is supported.
