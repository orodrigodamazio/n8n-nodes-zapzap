# n8n-nodes-zapzap

Nodos de comunidad de n8n para la [API de ZapZap](https://zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node). Envía texto, medios, encuestas, botones y listas por WhatsApp, reacciona a mensajes, gestiona instancias e inicia flujos a partir de eventos entrantes.

Idiomas: [English](README.md) | [Português](README.pt-BR.md) | Español

Necesitas una cuenta de ZapZap y al menos una instancia de WhatsApp. Créalas en [app.zapzapapi.com](https://app.zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node).

## Instalación

En n8n ve a **Settings > Community Nodes > Install**, escribe `n8n-nodes-zapzap` y acepta el aviso de nodos de comunidad. Los nodos **ZapZap** y **ZapZap Trigger** aparecen al buscar "ZapZap" o "WhatsApp".

## Credenciales

1. En el panel de ZapZap abre **Configuración** y copia tu **API Key** y tu **API Secret**.
2. En n8n crea una credencial **ZapZap API**: API Key (cabecera `x-api-key`), API Secret (cabecera `x-api-secret`) y Base URL `https://api.zapzapapi.com/api/v1`.
3. Pulsa **Test**. El nodo llama a `GET /account` y confirma que las claves funcionan.

Guarda las claves en el almacén de credenciales de n8n. Nunca las expongas en un navegador.

## Nodo ZapZap

### Message

| Operación | Llamada a la API | Campos principales |
|---|---|---|
| Send Text | `POST /{instanceId}/send/text` | Number, Text, opcional: menciones, ID de respuesta, delay |
| Send Media | `POST /{instanceId}/send/media` | Number, Media Type, File URL, opcional: texto y nombre del documento |
| Send Interactive | `POST /{instanceId}/send/poll`, `/send/buttons` o `/send/list` | Number, Text, opciones o botones en JSON |
| React | `POST /{instanceId}/message/react` | Number, Message ID, Emoji |

### Instance

| Operación | Llamada a la API |
|---|---|
| Create | `POST /instances` |
| Get Status | `GET /{instanceId}/instance/status` |
| Get QR Code | `GET /instances/{instanceId}/qrcode` |
| List | `GET /instances` |

Los números usan formato internacional, solo dígitos: código de país, código de área y número (por ejemplo `5511999999999`). Para grupos usa el ID del grupo, que termina en `@g.us`.

Crear una instancia se cobra de tu saldo de ZapZap. Consulta el precio vigente en la [página de precios](https://zapzapapi.com/precos?utm_source=n8n&utm_medium=community&utm_campaign=node) antes de automatizarlo.

## Nodo ZapZap Trigger

Inicia un flujo cuando llegan eventos de WhatsApp a una de tus instancias.

1. Añade **ZapZap Trigger**, elige la credencial e indica el **Instance ID**.
2. Activa el flujo. El nodo registra su URL de producción como webhook de la instancia y la elimina al desactivar el flujo.
3. Opcionalmente limita los **Events** (messages, connection, messages update, groups, contacts, chats, presence). Vacío significa los eventos principales.

La URL del webhook debe ser HTTPS pública. Un n8n local en `http://localhost` se rechaza: usa un túnel o activa **Set Webhook Manually**.

Cada evento trae `instance_id`, `instance_name`, `metadata`, `event` y `data`. En un mensaje entrante el texto está en `data.message.text`, el chat en `data.message.chatid` y `data.message.fromMe` indica si lo enviaste tú. Los eventos de conexión traen el estado en `data.instance.status` (`connecting`, `connected`, `disconnected` o `qrcode`).

## Ejemplos

Los flujos listos para importar están en [`templates/`](templates/README.es.md): respuesta automática, formulario a WhatsApp, recordatorio diario, encuesta tras una compra, menú de botones, alerta de desconexión y crear instancia con su QR.

Patrón rápido: `ZapZap Trigger` (messages) > `IF` con `data.message.fromMe` falso y texto que contiene "hola" > `ZapZap` Send Text, con Number `{{ $json.data.message.chatid.replace('@s.whatsapp.net', '') }}`.

## Documentación

- [Documentación de la API](https://zapzapapi.com/docs?utm_source=n8n&utm_medium=community&utm_campaign=node)
- [Documentación para asistentes de IA (llms.txt)](https://api.zapzapapi.com/llms.txt)
- [Nodos de comunidad de n8n](https://docs.n8n.io/integrations/community-nodes/)

## Avisos

ZapZap conecta cuentas normales de WhatsApp por un canal no oficial. WhatsApp puede restringir números que envían mensajes no solicitados o masivos. Escribe solo a personas que esperan tu mensaje y respeta los términos de WhatsApp y las leyes de privacidad aplicables.

## Licencia

[MIT](LICENSE) (c) GM Solutions Hub LTDA
