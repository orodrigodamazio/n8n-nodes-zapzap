# Changelog

## 0.1.2 (not yet published)

- Every request now sends `X-ZapZap-Client: n8n-nodes-zapzap/<version>` and a matching `User-Agent` (actions, trigger registration, credential test, instance list). The version is read from package.json at build time.
- New: instance picker (names and status), more operations (location, contact, groups, chat, account, instance get), Custom API Call, binary file upload, QR code as image.
- New credential test message ("Connected as ..."), default country code, language of error messages.
- Human error messages in English, Portuguese and Spanish; retry on 429 honoring Retry-After; no automatic retry of sends after timeouts or server errors; redirects are never followed; Base URL must be https.
- Trigger: signature check with replay window, retry deduplication, quick fields at the top of the output, only removes the webhook if it still points to the workflow.
- Fixed: instance names are uppercase on the API (the node now converts them and explains the rule); the instance list no longer returns the account API key in the output.
- Tests against a fake local server (`npm test`).

## 0.1.1

- Add pt-BR and es READMEs to the package.

## 0.1.0

- First version.
