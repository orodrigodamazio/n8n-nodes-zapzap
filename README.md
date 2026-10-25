# n8n-nodes-zapzap

n8n community nodes for the [ZapZap API](https://zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node). Send WhatsApp text, media, polls, buttons and lists, react to messages, manage instances and trigger workflows from incoming WhatsApp events.

[![npm](https://img.shields.io/npm/v/n8n-nodes-zapzap.svg)](https://www.npmjs.com/package/n8n-nodes-zapzap)

You need a ZapZap account and at least one WhatsApp instance. Create them at [app.zapzapapi.com](https://app.zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node).

## Install

In n8n, go to **Settings > Community Nodes > Install**, enter `n8n-nodes-zapzap` and accept the community node notice. See the [n8n community nodes guide](https://docs.n8n.io/integrations/community-nodes/installation/) for details.

The **ZapZap** and **ZapZap Trigger** nodes then show up when you search for "ZapZap" or "WhatsApp".

## Credentials

1. In the ZapZap panel, open **Settings** and copy your **API Key** and **API Secret**.
2. In n8n, create a **ZapZap API** credential:
   - **API Key**: sent as the `x-api-key` header.
   - **API Secret**: sent as the `x-api-secret` header.
   - **Base URL**: `https://api.zapzapapi.com/api/v1` (leave as is).
3. Press **Test**. The node calls `GET /account` and confirms the keys work.

Keep the keys in the n8n credential store. Never expose them in a browser.

## ZapZap node

### Message

| Operation | API call | Main fields |
|---|---|---|
| Send Text | `POST /{instanceId}/send/text` | Number, Text, optional mentions, reply ID, delay |
| Send Media | `POST /{instanceId}/send/media` | Number, Media Type, File URL, optional caption and document name |
| Send Interactive | `POST /{instanceId}/send/poll`, `/send/buttons` or `/send/list` | Number, Text, choices or buttons as JSON |
| React | `POST /{instanceId}/message/react` | Number, Message ID, Emoji |

Media types: image, video, document, audio, voice note (PTT), native audio, video note and sticker.

### Instance

| Operation | API call |
|---|---|
| Create | `POST /instances` |
| Get Status | `GET /{instanceId}/instance/status` |
| Get QR Code | `GET /instances/{instanceId}/qrcode` |
| List | `GET /instances` |

Phone numbers use the international format, digits only: country code, area code and number (for example `5511999999999`). For groups use the group ID, which ends in `@g.us`.

Creating an instance is billed to your ZapZap balance. Check the current price on the [pricing page](https://zapzapapi.com/precos?utm_source=n8n&utm_medium=community&utm_campaign=node) before you automate it.

## ZapZap Trigger node

Starts a workflow when WhatsApp events arrive on one of your instances.

1. Add **ZapZap Trigger**, pick the credential and enter the **Instance ID**.
2. Activate the workflow. The node registers its production URL as the instance webhook and removes it when you deactivate the workflow.
3. Optionally limit **Events** (messages, connection, messages update, groups, contacts, chats, presence). Empty means the main events.

The webhook URL must be public HTTPS. A local `http://localhost` n8n is rejected; use a tunnel, or turn on **Set Webhook Manually** and point the webhook yourself.

Each event carries `instance_id`, `instance_name`, `metadata`, `event` and `data`. For an incoming message the text is at `data.message.text`, the chat at `data.message.chatid` and `data.message.fromMe` tells whether you sent it. Connection events carry the state in `data.instance.status` (`connecting`, `connected`, `disconnected` or `qrcode`).

## Examples

Ready to import workflows are in [`templates/`](templates/README.md):

- Auto reply to incoming messages
- Send a WhatsApp message when a form is submitted
- Daily reminder from a schedule
- Poll after a purchase
- Buttons menu on a keyword
- Alert when an instance disconnects
- Create an instance and fetch its QR code

Quick pattern: `ZapZap Trigger` (messages) > `IF` `data.message.fromMe` is false and text contains "hello" > `ZapZap` Send Text, with Number set to `{{ $json.data.message.chatid.replace('@s.whatsapp.net', '') }}`.

## Documentation

- [API documentation](https://zapzapapi.com/docs?utm_source=n8n&utm_medium=community&utm_campaign=node)
- [Docs for AI assistants (llms.txt)](https://api.zapzapapi.com/llms.txt)
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)

## Notes

ZapZap connects regular WhatsApp accounts through a non-official channel. WhatsApp can restrict numbers that send unsolicited or bulk messages. Message only people who expect to hear from you, and follow the WhatsApp terms and the privacy laws that apply to your contacts.

## License

[MIT](LICENSE) (c) GM Solutions Hub LTDA
