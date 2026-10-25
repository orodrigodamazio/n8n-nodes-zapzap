# Workflow templates

Importable n8n workflows that use the [ZapZap community nodes](../README.md). Install `n8n-nodes-zapzap` first, then in n8n choose **Workflows > Import from file** and pick a JSON file.

After importing: select your **ZapZap API** credential on each ZapZap node and replace `YOUR_INSTANCE_ID` with the ID of your WhatsApp instance. Numbers use digits only with country code (`5511999999999`).

| File | What it does | Starts with |
|---|---|---|
| `01-auto-reply.json` | Replies to incoming messages that contain "hello" | ZapZap Trigger (messages) |
| `02-form-to-whatsapp.json` | Sends a confirmation to the phone submitted in a form | Webhook |
| `03-daily-reminder.json` | Sends a reminder every day at 09:00 | Schedule |
| `04-poll-after-purchase.json` | Sends a native WhatsApp poll after a purchase | Webhook |
| `05-buttons-menu.json` | Answers "menu" with quick-reply and link buttons | ZapZap Trigger (messages) |
| `06-instance-disconnect-alert.json` | Warns an admin when an instance disconnects | ZapZap Trigger (connection) |
| `07-create-instance-and-qr.json` | Creates an instance and returns its QR code | Manual |

Notes:

- The trigger needs a public HTTPS n8n URL. On a local setup, turn on **Set Webhook Manually** in the trigger.
- Creating an instance (template 07) is billed to your ZapZap balance. See the [pricing page](https://zapzapapi.com/precos?utm_source=n8n&utm_medium=community&utm_campaign=templates).
- Message only people who expect to hear from you. WhatsApp can restrict numbers that send unwanted messages.
- Full API reference: [zapzapapi.com/docs](https://zapzapapi.com/docs?utm_source=n8n&utm_medium=community&utm_campaign=templates).
