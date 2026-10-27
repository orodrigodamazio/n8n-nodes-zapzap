# Changelog

## 0.1.3 (not yet published)

- Security: the trigger now rejects (401) a delivery when a secret is set but the raw body is missing; network errors no longer pass the raw library error (which can carry the API headers) to n8n; automatic webhook setup fails closed and undoes the registration when ZapZap does not return a webhook secret; manual setup explains that no secret means fake events are accepted.
- Safer sends: after a timeout, network error or 5xx on a send, the message says it may have been sent already.
- Node messages (missing number, bad name, polls, buttons, lists, file URL, Base URL, JSON) follow the credential language (English, Portuguese, Spanish) and say what to do. The instance field explains what an instance is and what to do when the list is empty.
- Plain names for audio types (Audio File, Voice Message, Round Video). Examples in the JSON fields. Delay is shown in milliseconds with a hint.
- Templates use the easy Trigger fields (from, text), start with an empty instance and are now included in the npm package. READMEs in Portuguese and Spanish use the real names shown in the interface.
- Credential: test and icon now live in the credential class; the install checks use `@n8n/node-cli` (lint) with ESLint 9; deprecated `helpers.request` removed; client version is a constant checked against package.json by a test.

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
