# n8n-nodes-zapzap

n8n community nodes for the [ZapZap API](https://zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node). Send WhatsApp text, media, polls, buttons and lists, react to messages, manage groups and instances, and start workflows from incoming WhatsApp events.

[![npm](https://img.shields.io/npm/v/n8n-nodes-zapzap.svg)](https://www.npmjs.com/package/n8n-nodes-zapzap)

Languages: English | [Português](README.pt-BR.md) | [Español](README.es.md)

## Get started in 3 steps

1. **Install.** In n8n open **Settings > Community Nodes > Install**, type `n8n-nodes-zapzap` and accept. ([guide](https://docs.n8n.io/integrations/community-nodes/installation/))
2. **Paste your keys.** In the ZapZap panel ([app.zapzapapi.com](https://app.zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node)) open **Settings > API** and copy the API Key and API Secret. In n8n create a **ZapZap API** credential, paste both and save (n8n tests the credential when you save). You should see a green success message; if it is red, see Troubleshooting below.
3. **Send your first message.** Add a **ZapZap** node, keep Resource = Message and Operation = Send Text, choose your instance from the list (an "instance" is a connected WhatsApp number; it shows the name and whether it is connected; if the list is empty, create and connect one in app.zapzapapi.com first), type a number and a text, and run it.

Want a ready workflow? Import any file from [`templates/`](templates/README.md).

## Credentials

| Field | What to put |
|---|---|
| API Key / API Secret | Copied from the ZapZap panel, Settings > API |
| Default Country Code | Optional. With `55`, the number `11 99999-0001` becomes `5511999990001` |
| Language of Error Messages | English, Português or Español |
| Base URL | Leave as is. Only change it for your own ZapZap installation (must be https) |

The keys stay in the n8n credential store. They are sent only as the `x-api-key` and `x-api-secret` headers to the Base URL. They are never added to node output, logs or error messages.

## ZapZap node

| Resource | Operations |
|---|---|
| Message | Send Text, Send Media (URL or binary file), Send Interactive (poll, buttons, list), Send Location, Send Contact, React |
| Group | Get Many, Get, Create |
| Chat | Mark as Read |
| Instance | Create, Get, Get Many, Get Status, Get QR Code (also returned as an image) |
| Account | Get |
| Custom API Call | Any other endpoint of the [API reference](https://zapzapapi.com/docs), already authenticated |

Good to know:

- **Numbers** are accepted in any country format: `+1 (415) 555-0100`, `+44 7700 900123`, `5511999990001`. Spaces, brackets, dashes and a leading `00` or `+` are cleaned. With Brazilian numbers a missing ninth digit on a mobile number is added. Groups use the group ID ending in `@g.us`.
- **Binary files** (from HTTP Request, Read Binary File and so on) can be sent up to about 1 MB. For larger files use a URL.
- **Text** can have emoji and any script, including Arabic, Hebrew and CJK.
- **Several items** in, several results out. Turn on **Continue On Fail** to get an error item for the ones that fail and keep going.
- **Rate limits**: a 429 answer is retried up to 3 times, waiting as long as `Retry-After` says. Temporary 502/503/504 errors are retried for read calls only.
- **No duplicate messages**: a send is never repeated after a timeout or a server error, because the message may already have gone out. The node then stops with a warning ("The message may have been sent already. Check the chat before sending again") so you can decide. (The API has no idempotency key.)
- **Redirects** are never followed, so your keys cannot be sent to another host.
- Usable as an **AI agent tool** in n8n.
- Instance creation is billed to your ZapZap balance; check the [pricing](https://zapzapapi.com/precos?utm_source=n8n&utm_medium=community&utm_campaign=node) first.

## ZapZap Trigger node

1. Add **ZapZap Trigger**, pick the credential and the instance from the list.
2. Activate the workflow. The node registers its URL on the instance and removes it when you deactivate. n8n needs a public HTTPS address.
3. Choose the **Events** (default: messages).

The output has easy fields at the top: `from`, `text`, `type`, `time`, `chatId`, `isGroup`, `fromMe`, `messageId`, `instanceName`, plus the full payload (`data.message...`).

- Every delivery is signed (`X-ZapZap-Signature`, HMAC-SHA256 with timestamp). The node checks it with a constant-time comparison and rejects forged or older than 5 minutes deliveries. With **Set Webhook Manually** paste the secret in Options, otherwise anyone who knows the URL could send fake events. With automatic setup the node refuses to activate if ZapZap does not return the secret.
- Retried deliveries (same delivery ID) are skipped. Turn on **Ignore My Own Messages** for auto replies.
- The answer is sent immediately; your workflow runs after it.
- While you use "Listen for test event" the instance webhook points to the test URL and is restored when you stop.

## What the node sends to ZapZap

Every request to ZapZap carries two headers so support and usage statistics can tell which tool is calling:

```
X-ZapZap-Client: n8n-nodes-zapzap/<version>
User-Agent: n8n-nodes-zapzap/<version>
```

That is only the name and version of this node. Nothing about your workflows, your n8n instance or your users is sent, other than the data you put in the operations themselves (message, number, instance) and your API keys, which ZapZap needs to authenticate the call. The node does not read environment variables or files and has no runtime dependencies.

## Troubleshooting

| Message | What to do |
|---|---|
| Invalid API Key or API Secret | Copy both again from Settings > API |
| Instance is not connected | Open the instance in the panel and scan the QR code |
| Number looks invalid | Use the country code; check the number has WhatsApp |
| Rate limit reached | Add a Wait node between sends |
| Webhook needs HTTPS | Set `WEBHOOK_URL` in n8n to your public https address, or use Set Webhook Manually |

## Documentation

- [API documentation](https://zapzapapi.com/docs?utm_source=n8n&utm_medium=community&utm_campaign=node)
- [Docs for AI assistants (llms.txt)](https://api.zapzapapi.com/llms.txt)
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)

## Notes

ZapZap connects regular WhatsApp accounts through a non-official channel. WhatsApp can restrict numbers that send unsolicited or bulk messages. Message only people who expect to hear from you, and follow the WhatsApp terms and the privacy laws that apply to your contacts.

## License

[MIT](LICENSE) (c) GM Solutions Hub LTDA
