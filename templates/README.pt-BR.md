# Templates de fluxos

Fluxos do n8n prontos para importar que usam os [community nodes da ZapZap](../README.pt-BR.md). Instale antes o `n8n-nodes-zapzap` e, no n8n, escolha **Workflows > Import from file** com um dos arquivos JSON.

Depois de importar: selecione sua credencial **ZapZap API** em cada node ZapZap e escolha sua instância de WhatsApp na lista (troque `YOUR_INSTANCE_ID`). Números levam só dígitos com DDI (`5511999990001`).

| Arquivo | O que faz | Começa com |
|---|---|---|
| `01-auto-reply.json` | Responde mensagens recebidas que contêm "hello" | ZapZap Trigger (messages) |
| `02-form-to-whatsapp.json` | Envia uma confirmação ao telefone informado em um formulário | Webhook |
| `03-daily-reminder.json` | Envia um lembrete todo dia às 09:00 | Schedule |
| `04-poll-after-purchase.json` | Envia uma enquete nativa do WhatsApp após uma compra | Webhook |
| `05-buttons-menu.json` | Responde "menu" com botões de resposta rápida e de link | ZapZap Trigger (messages) |
| `06-instance-disconnect-alert.json` | Avisa um administrador quando uma instância desconecta | ZapZap Trigger (connection) |
| `07-create-instance-and-qr.json` | Cria uma instância e devolve o QR code | Manual |

Observações:

- O trigger precisa de URL do n8n com HTTPS público. Em ambiente local, ligue **Set Webhook Manually** no trigger.
- Criar instância (template 07) é cobrado do seu saldo na ZapZap. Veja a [página de preços](https://zapzapapi.com/precos?utm_source=n8n&utm_medium=community&utm_campaign=templates).
- Fale só com quem espera a sua mensagem. O WhatsApp pode restringir números que enviam mensagens indesejadas.
- Referência completa da API: [zapzapapi.com/docs](https://zapzapapi.com/docs?utm_source=n8n&utm_medium=community&utm_campaign=templates).
- Os textos de exemplo dentro dos fluxos estão em inglês; edite para o seu idioma.
