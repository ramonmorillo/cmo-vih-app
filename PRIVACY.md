# PRIVACY.md

## Privacy-first design
This application is designed for privacy-first use and does not require personal identifiers to operate.

## Recommended usage
- Use de-identified or minimally necessary clinical text.
- Avoid including names, national identifiers, exact addresses, phone numbers, or other direct identifiers.
- Review exported files before sharing or storing them.
- Text-analysis proposals only enter the calculation after the professional confirms them. The pasted clinical text is never exported and is not kept in the browser draft (explicitly saved cases are unchanged). A pseudonymized identifier is still personal data.

## Data handling model
- The app runs as a static web application.
- State is stored locally in the browser through local storage for autosave and recovery.
- No server-side storage, remote analytics, or cloud processing is implemented in this version.

## Operational caveat
Because browser storage is local, users should apply their own institutional governance for endpoint security, browser hygiene, and export handling.
