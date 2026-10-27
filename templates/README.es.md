# Plantillas de flujos

Flujos de n8n listos para importar que usan los [nodos de comunidad de ZapZap](../README.es.md). Instala primero `n8n-nodes-zapzap` y en n8n elige **Workflows > Import from file** con uno de los archivos JSON.

Después de importar: selecciona tu credencial **ZapZap API** en cada nodo ZapZap y elige tu instancia de WhatsApp de la lista (el campo empieza vacío). Los números llevan solo dígitos con código de país (`5511999990001`).

| Archivo | Qué hace | Empieza con |
|---|---|---|
| `01-auto-reply.json` | Responde a los mensajes entrantes que contienen "hello" | ZapZap Trigger (messages) |
| `02-form-to-whatsapp.json` | Envía una confirmación al teléfono recibido en un formulario | Webhook |
| `03-daily-reminder.json` | Envía un recordatorio todos los días a las 09:00 | Schedule |
| `04-poll-after-purchase.json` | Envía una encuesta nativa de WhatsApp tras una compra | Webhook |
| `05-buttons-menu.json` | Responde a "menu" con botones de respuesta rápida y de enlace | ZapZap Trigger (messages) |
| `06-instance-disconnect-alert.json` | Avisa a un administrador cuando una instancia se desconecta | ZapZap Trigger (connection) |
| `07-create-instance-and-qr.json` | Crea una instancia y devuelve su código QR | Manual |

Notas:

- El trigger necesita una URL de n8n con HTTPS público. En local, activa **Set Webhook Manually** en el trigger.
- Crear una instancia (plantilla 07) se cobra de tu saldo de ZapZap. Consulta la [página de precios](https://zapzapapi.com/precos?utm_source=n8n&utm_medium=community&utm_campaign=templates).
- Escribe solo a personas que esperan tu mensaje. WhatsApp puede restringir números que envían mensajes no deseados.
- Referencia completa de la API: [zapzapapi.com/docs](https://zapzapapi.com/docs?utm_source=n8n&utm_medium=community&utm_campaign=templates).
- Los textos de ejemplo dentro de los flujos están en inglés; edítalos a tu idioma.
