# n8n-nodes-zapzap

Nós da comunidade n8n para a [API do ZapZap](https://zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node). Envie texto, mídia, enquetes, botões e listas no WhatsApp, reaja a mensagens, gerencie grupos e instâncias e inicie fluxos a partir de eventos recebidos.

Idiomas: [English](README.md) | Português | [Español](README.es.md)

## Comece em 3 passos

1. **Instale.** No n8n abra **Settings > Community Nodes > Install**, digite `n8n-nodes-zapzap` e aceite. ([guia](https://docs.n8n.io/integrations/community-nodes/installation/))
2. **Cole suas chaves.** No painel do ZapZap ([app.zapzapapi.com](https://app.zapzapapi.com/?utm_source=n8n&utm_medium=community&utm_campaign=node)) abra **Configurações > API** e copie a API Key e o API Secret. No n8n crie uma credencial **ZapZap API**, cole os dois e clique em **Test**. Deve aparecer "Conectado como ..." com o número de instâncias.
3. **Envie a primeira mensagem.** Adicione o nó **ZapZap**, deixe Recurso = Mensagem e Operação = Send Text, escolha a instância na lista (aparece o nome e se está conectada), digite número e texto e execute.

Quer um fluxo pronto? Importe qualquer arquivo de [`templates/`](templates/README.pt-BR.md).

## Credencial

| Campo | O que colocar |
|---|---|
| API Key / API Secret | Copiados do painel do ZapZap, Configurações > API |
| Default Country Code | Opcional. Com `55`, o número `11 99999-0001` vira `5511999990001` |
| Language of Error Messages | English, Português ou Español |
| Base URL | Deixe como está. Só mude para instalação própria do ZapZap (precisa ser https) |

As chaves ficam no cofre de credenciais do n8n e vão somente nos cabeçalhos `x-api-key` e `x-api-secret` para a Base URL. Nunca entram na saída do nó, em logs ou em mensagens de erro.

## Nó ZapZap

| Recurso | Operações |
|---|---|
| Message | Send Text, Send Media (URL ou arquivo binário), Send Interactive (enquete, botões, lista), Send Location, Send Contact, React |
| Group | Get Many, Get, Create |
| Chat | Mark as Read |
| Instance | Create, Get, Get Many, Get Status, Get QR Code (também devolvido como imagem) |
| Account | Get |
| Custom API Call | Qualquer outro endpoint da [referência da API](https://zapzapapi.com/docs), já autenticado |

Bom saber:

- **Números** aceitam qualquer formato de país: `+1 (415) 555-0100`, `+44 7700 900123`, `5511999990001`. Espaços, parênteses, hífens e `00` ou `+` no início são limpos. Em números do Brasil, o nono dígito que faltar em celular é adicionado. Grupos usam o ID terminado em `@g.us`.
- **Arquivos binários** (do HTTP Request, Read Binary File etc.) vão até cerca de 1 MB. Acima disso use URL.
- **Texto** pode ter emoji e qualquer alfabeto (árabe, hebraico, chinês, japonês, coreano).
- **Vários itens** de entrada geram vários resultados. Ligue **Continue On Fail** para receber um item de erro nos que falharem e seguir adiante.
- **Limite de requisições**: resposta 429 é repetida até 3 vezes, esperando o tempo de `Retry-After`. Erros temporários 502/503/504 são repetidos só em consultas.
- **Sem mensagem duplicada**: um envio nunca é repetido após timeout ou erro do servidor, porque a mensagem pode já ter saído. O nó para com uma mensagem clara para você decidir. (A API não tem chave de idempotência.)
- **Redirecionamentos** nunca são seguidos, então suas chaves não vão para outro servidor.
- Pode ser usado como **ferramenta de agente de IA** no n8n.
- Criar instância é cobrado do saldo; veja os [preços](https://zapzapapi.com/precos?utm_source=n8n&utm_medium=community&utm_campaign=node) antes.

## Nó ZapZap Trigger

1. Adicione o **ZapZap Trigger**, escolha a credencial e a instância na lista.
2. Ative o fluxo. O nó registra a URL na instância e remove ao desativar. O n8n precisa de endereço HTTPS público.
3. Escolha os **Events** (padrão: mensagens).

A saída traz campos fáceis no topo: `from`, `text`, `type`, `time`, `chatId`, `isGroup`, `fromMe`, `messageId`, `instanceName`, além do conteúdo completo (`data.message...`).

- Toda entrega é assinada (`X-ZapZap-Signature`, HMAC-SHA256 com horário). O nó confere com comparação em tempo constante e recusa entregas falsas ou com mais de 5 minutos. Com **Set Webhook Manually**, cole o segredo em Options; sem ele não dá para verificar.
- Entregas repetidas (mesmo ID de entrega) são ignoradas. Ligue **Ignore My Own Messages** em respostas automáticas.
- A resposta sai na hora; seu fluxo roda depois.
- Enquanto usa "Listen for test event", o webhook da instância aponta para a URL de teste e volta ao normal quando você para.

## O que o nó envia ao ZapZap

Toda requisição ao ZapZap leva dois cabeçalhos, para o suporte e as estatísticas de uso saberem qual ferramenta está chamando:

```
X-ZapZap-Client: n8n-nodes-zapzap/<versão>
User-Agent: n8n-nodes-zapzap/<versão>
```

É só o nome e a versão deste nó. Nada sobre seus fluxos, seu n8n ou seus usuários é enviado, além dos dados que você mesmo coloca nas operações (mensagem, número, instância) e das suas chaves de API, que o ZapZap precisa para autenticar a chamada. O nó não lê variáveis de ambiente nem arquivos e não tem dependências em tempo de execução.

## Problemas comuns

| Mensagem | O que fazer |
|---|---|
| API Key ou API Secret inválidas | Copie os dois de novo em Configurações > API |
| Instância não está conectada | Abra a instância no painel e leia o QR code |
| Número parece inválido | Use o código do país e confira se o número tem WhatsApp |
| Limite de requisições | Coloque um nó Wait entre os envios |
| Webhook precisa de HTTPS | Defina `WEBHOOK_URL` no n8n com seu endereço https público, ou use Set Webhook Manually |

## Documentação

- [Documentação da API](https://zapzapapi.com/docs?utm_source=n8n&utm_medium=community&utm_campaign=node)
- [Docs para assistentes de IA (llms.txt)](https://api.zapzapapi.com/llms.txt)
- [Nós da comunidade n8n](https://docs.n8n.io/integrations/community-nodes/)

## Avisos

O ZapZap conecta contas comuns de WhatsApp por um canal não oficial. O WhatsApp pode restringir números que enviam mensagens não solicitadas ou em massa. Escreva só para quem espera receber e siga os termos do WhatsApp e as leis de privacidade que se aplicam aos seus contatos.

## Licença

[MIT](LICENSE) (c) GM Solutions Hub LTDA
