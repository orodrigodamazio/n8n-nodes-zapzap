# n8n-nodes-zapzap

Nodos de la comunidad n8n para la [API de ZapZap](https://zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node). Envía texto, archivos, encuestas, botones y listas por WhatsApp, reacciona a mensajes, gestiona grupos e instancias e inicia flujos con eventos recibidos.

Idiomas: [English](README.md) | [Português](README.pt-BR.md) | Español

## Empieza en 3 pasos

1. **Instala.** En n8n abre **Settings > Community Nodes > Install**, escribe `n8n-nodes-zapzap` y acepta. ([guía](https://docs.n8n.io/integrations/community-nodes/installation/))
2. **Pega tus claves.** En el panel de ZapZap ([app.zapzapapi.com](https://app.zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node)) abre **Configuración > API** y copia la API Key y el API Secret. En n8n crea una credencial **ZapZap API**, pega ambas y pulsa **Test**. Debe aparecer "Conectado como ..." con tu número de instancias.
3. **Envía tu primer mensaje.** Añade el nodo **ZapZap**, deja Recurso = Mensaje y Operación = Send Text, elige tu instancia de la lista (muestra el nombre y si está conectada), escribe un número y un texto y ejecuta.

¿Quieres un flujo listo? Importa cualquier archivo de [`templates/`](templates/README.es.md).

## Credencial

| Campo | Qué poner |
|---|---|
| API Key / API Secret | Copiados del panel de ZapZap, Configuración > API |
| Default Country Code | Opcional. Con `55`, el número `11 99999-0001` pasa a `5511999990001` |
| Language of Error Messages | English, Português o Español |
| Base URL | Déjala como está. Cámbiala solo para una instalación propia de ZapZap (debe ser https) |

Las claves quedan en el almacén de credenciales de n8n y se envían solo en los encabezados `x-api-key` y `x-api-secret` a la Base URL. Nunca aparecen en la salida del nodo, en logs ni en mensajes de error.

## Nodo ZapZap

| Recurso | Operaciones |
|---|---|
| Message | Send Text, Send Media (URL o archivo binario), Send Interactive (encuesta, botones, lista), Send Location, Send Contact, React |
| Group | Get Many, Get, Create |
| Chat | Mark as Read |
| Instance | Create, Get, Get Many, Get Status, Get QR Code (también como imagen) |
| Account | Get |
| Custom API Call | Cualquier otro endpoint de la [referencia de la API](https://zapzapapi.com/docs), ya autenticado |

Conviene saber:

- **Números** en cualquier formato de país: `+1 (415) 555-0100`, `+44 7700 900123`, `5511999990001`. Se limpian espacios, paréntesis, guiones y `00` o `+` iniciales. En números de Brasil se añade el noveno dígito que falte en móviles. Los grupos usan el ID terminado en `@g.us`.
- **Archivos binarios** (de HTTP Request, Read Binary File, etc.) hasta cerca de 1 MB. Para más, usa una URL.
- **Texto** con emoji y cualquier alfabeto (árabe, hebreo, chino, japonés, coreano).
- **Varios ítems** de entrada dan varios resultados. Activa **Continue On Fail** para recibir un ítem de error en los que fallen y seguir.
- **Límite de solicitudes**: una respuesta 429 se reintenta hasta 3 veces esperando lo que indique `Retry-After`. Los errores temporales 502/503/504 se reintentan solo en consultas.
- **Sin mensajes duplicados**: un envío nunca se repite tras un timeout o error del servidor, porque el mensaje puede haber salido ya. El nodo se detiene con un mensaje claro para que decidas. (La API no tiene clave de idempotencia.)
- **Redirecciones** nunca se siguen, así tus claves no viajan a otro servidor.
- Se puede usar como **herramienta de agente de IA** en n8n.
- Crear una instancia se cobra de tu saldo; revisa los [precios](https://zapzapapi.com/precos?utm_source=n8n&utm_medium=community&utm_campaign=node) antes.

## Nodo ZapZap Trigger

1. Añade **ZapZap Trigger**, elige la credencial y la instancia de la lista.
2. Activa el flujo. El nodo registra su URL en la instancia y la quita al desactivar. n8n necesita una dirección HTTPS pública.
3. Elige los **Events** (por defecto: mensajes).

La salida trae campos fáciles arriba: `from`, `text`, `type`, `time`, `chatId`, `isGroup`, `fromMe`, `messageId`, `instanceName`, además del contenido completo (`data.message...`).

- Cada entrega va firmada (`X-ZapZap-Signature`, HMAC-SHA256 con hora). El nodo la verifica con comparación en tiempo constante y rechaza entregas falsas o de más de 5 minutos. Con **Set Webhook Manually** pega el secreto en Options; sin él no se puede verificar.
- Las entregas repetidas (mismo ID de entrega) se ignoran. Activa **Ignore My Own Messages** en respuestas automáticas.
- La respuesta sale de inmediato; tu flujo corre después.
- Mientras usas "Listen for test event", el webhook de la instancia apunta a la URL de prueba y se restaura al parar.

## Qué envía el nodo a ZapZap

Cada solicitud a ZapZap lleva dos encabezados para que soporte y estadísticas de uso sepan qué herramienta llama:

```
X-ZapZap-Client: n8n-nodes-zapzap/<versión>
User-Agent: n8n-nodes-zapzap/<versión>
```

Es solo el nombre y la versión de este nodo. No se envía nada de tus flujos, de tu n8n ni de tus usuarios, aparte de los datos que tú pones en las operaciones (mensaje, número, instancia) y tus claves de API, que ZapZap necesita para autenticar la llamada. El nodo no lee variables de entorno ni archivos y no tiene dependencias en tiempo de ejecución.

## Problemas comunes

| Mensaje | Qué hacer |
|---|---|
| API Key o API Secret inválidas | Cópialas de nuevo en Configuración > API |
| La instancia no está conectada | Abre la instancia en el panel y escanea el QR |
| El número parece inválido | Usa el código de país y revisa que tenga WhatsApp |
| Límite de solicitudes | Pon un nodo Wait entre envíos |
| El webhook necesita HTTPS | Define `WEBHOOK_URL` en n8n con tu dirección https pública, o usa Set Webhook Manually |

## Documentación

- [Documentación de la API](https://zapzapapi.com/docs?utm_source=n8n&utm_medium=community&utm_campaign=node)
- [Docs para asistentes de IA (llms.txt)](https://api.zapzapapi.com/llms.txt)
- [Nodos de la comunidad n8n](https://docs.n8n.io/integrations/community-nodes/)

## Avisos

ZapZap conecta cuentas normales de WhatsApp por un canal no oficial. WhatsApp puede restringir números que envían mensajes no solicitados o masivos. Escribe solo a quien espera tu mensaje y respeta los términos de WhatsApp y las leyes de privacidad aplicables a tus contactos.

## Licencia

[MIT](LICENSE) (c) GM Solutions Hub LTDA
