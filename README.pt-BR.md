# n8n-nodes-zapzap

Nodos da comunidade n8n para a [API da ZapZap](https://zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node). Envie texto, mídia, enquetes, botões e listas pelo WhatsApp, reaja a mensagens, gerencie instâncias e inicie fluxos a partir de eventos recebidos.

Idiomas: [English](README.md) | Português | [Español](README.es.md)

Você precisa de uma conta ZapZap e de ao menos uma instância de WhatsApp. Crie em [app.zapzapapi.com](https://app.zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node).

## Instalação

No n8n vá em **Settings > Community Nodes > Install**, digite `n8n-nodes-zapzap` e aceite o aviso de community nodes. Os nodes **ZapZap** e **ZapZap Trigger** aparecem ao buscar "ZapZap" ou "WhatsApp".

## Credenciais

1. No painel da ZapZap abra **Configurações** e copie sua **API Key** e seu **API Secret**.
2. No n8n crie uma credencial **ZapZap API**: API Key (header `x-api-key`), API Secret (header `x-api-secret`) e Base URL `https://api.zapzapapi.com/api/v1`.
3. Clique em **Test**. O node chama `GET /account` e confirma que as chaves funcionam.

Guarde as chaves no cofre de credenciais do n8n. Nunca as exponha em um navegador.

## Node ZapZap

### Message

| Operação | Chamada da API | Campos principais |
|---|---|---|
| Send Text | `POST /{instanceId}/send/text` | Number, Text, opcional: menções, ID de resposta, delay |
| Send Media | `POST /{instanceId}/send/media` | Number, Media Type, File URL, opcional: legenda e nome do documento |
| Send Interactive | `POST /{instanceId}/send/poll`, `/send/buttons` ou `/send/list` | Number, Text, opções ou botões em JSON |
| React | `POST /{instanceId}/message/react` | Number, Message ID, Emoji |

### Instance

| Operação | Chamada da API |
|---|---|
| Create | `POST /instances` |
| Get Status | `GET /{instanceId}/instance/status` |
| Get QR Code | `GET /instances/{instanceId}/qrcode` |
| List | `GET /instances` |

Os números usam formato internacional, só dígitos: DDI, DDD e número (por exemplo `5511999999999`). Para grupos use o ID do grupo, que termina em `@g.us`.

Criar uma instância é cobrado do seu saldo na ZapZap. Veja o preço atual na [página de preços](https://zapzapapi.com/precos?utm_source=n8n&utm_medium=community&utm_campaign=node) antes de automatizar.

## Node ZapZap Trigger

Inicia um fluxo quando chegam eventos de WhatsApp em uma das suas instâncias.

1. Adicione o **ZapZap Trigger**, escolha a credencial e informe o **Instance ID**.
2. Ative o fluxo. O node registra a URL de produção como webhook da instância e remove ao desativar.
3. Opcionalmente limite os **Events** (messages, connection, messages update, groups, contacts, chats, presence). Vazio significa os eventos principais.

A URL do webhook precisa ser HTTPS pública. Um n8n local em `http://localhost` é recusado: use um túnel ou ligue **Set Webhook Manually**.

Cada evento traz `instance_id`, `instance_name`, `metadata`, `event` e `data`. Em uma mensagem recebida o texto está em `data.message.text`, o chat em `data.message.chatid` e `data.message.fromMe` indica se foi você quem enviou. Eventos de conexão trazem o estado em `data.instance.status` (`connecting`, `connected`, `disconnected` ou `qrcode`).

## Exemplos

Os fluxos prontos para importar estão em [`templates/`](templates/README.pt-BR.md): resposta automática, formulário para WhatsApp, lembrete diário, enquete pós-compra, menu de botões, alerta de desconexão e criar instância com QR.

Padrão rápido: `ZapZap Trigger` (messages) > `IF` com `data.message.fromMe` falso e texto contendo "oi" > `ZapZap` Send Text, com Number `{{ $json.data.message.chatid.replace('@s.whatsapp.net', '') }}`.

## Documentação

- [Documentação da API](https://zapzapapi.com/docs?utm_source=n8n&utm_medium=community&utm_campaign=node)
- [Docs para assistentes de IA (llms.txt)](https://api.zapzapapi.com/llms.txt)
- [Community nodes do n8n](https://docs.n8n.io/integrations/community-nodes/)

## Avisos

A ZapZap conecta contas comuns de WhatsApp por um canal não oficial. O WhatsApp pode restringir números que enviam mensagens indesejadas ou em massa. Fale só com quem espera a sua mensagem e respeite os termos do WhatsApp e as leis de privacidade aplicáveis.

## Licença

[MIT](LICENSE) (c) GM Solutions Hub LTDA
