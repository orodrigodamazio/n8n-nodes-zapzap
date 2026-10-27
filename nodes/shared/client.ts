import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

// Keep in sync with package.json "version". test/action.test.js fails if they differ.

export const CLIENT_NAME = 'n8n-nodes-zapzap';
export const CLIENT_VERSION = '0.1.3';
export const CLIENT_HEADER = 'X-ZapZap-Client';
export const CLIENT_ID = `${CLIENT_NAME}/${CLIENT_VERSION}`;
export const DEFAULT_BASE_URL = 'https://api.zapzapapi.com/api/v1';

/** Headers sent on every request to ZapZap: node name and version only. */
export function clientHeaders(): Record<string, string> {
	return { [CLIENT_HEADER]: CLIENT_ID, 'User-Agent': CLIENT_ID };
}

type Ctx = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

/** Tunable at runtime so tests do not wait for real backoff. */
export const runtime = {
	sleep: (ms: number): Promise<void> => sleep(ms),
	maxRetries: 3,
	maxWaitMs: 30_000,
	timeoutMs: 60_000,
};

export type Lang = 'en' | 'pt' | 'es';
export function toLang(v: unknown): Lang {
	const l = String(v || '').toLowerCase();
	if (l.startsWith('pt')) return 'pt';
	if (l.startsWith('es')) return 'es';
	return 'en';
}

const MESSAGES: Record<string, Record<Lang, string>> = {
	'400': {
		en: 'ZapZap rejected the request: a field is missing or invalid.',
		pt: 'O ZapZap recusou a requisição: algum campo está faltando ou inválido.',
		es: 'ZapZap rechazó la solicitud: falta un campo o es inválido.',
	},
	'401': {
		en: 'Invalid API Key or API Secret. Check the ZapZap API credential.',
		pt: 'API Key ou API Secret inválidas. Confira a credencial ZapZap API.',
		es: 'API Key o API Secret inválidas. Revisa la credencial ZapZap API.',
	},
	'402': {
		en: 'Not enough balance in your ZapZap account. Add funds and try again.',
		pt: 'Saldo insuficiente na conta ZapZap. Adicione saldo e tente de novo.',
		es: 'Saldo insuficiente en tu cuenta ZapZap. Agrega saldo e inténtalo de nuevo.',
	},
	'403': {
		en: 'Access denied. The account may be suspended or the key lacks access to this instance.',
		pt: 'Acesso negado. A conta pode estar suspensa ou a chave não tem acesso a esta instância.',
		es: 'Acceso denegado. La cuenta puede estar suspendida o la clave no tiene acceso a esta instancia.',
	},
	'404': {
		en: 'Not found. Check the Instance ID (pick it from the list) and the other IDs.',
		pt: 'Não encontrado. Confira o ID da instância (escolha na lista) e os demais IDs.',
		es: 'No encontrado. Revisa el ID de la instancia (elígelo de la lista) y los demás IDs.',
	},
	'409': {
		en: 'Conflict: the operation is already in progress. Wait a moment and try again.',
		pt: 'Conflito: a operação já está em andamento. Aguarde um instante e tente de novo.',
		es: 'Conflicto: la operación ya está en curso. Espera un momento e inténtalo de nuevo.',
	},
	'413': {
		en: 'The file is too large. Send it by URL instead of binary data.',
		pt: 'O arquivo é grande demais. Envie por URL em vez de dado binário.',
		es: 'El archivo es demasiado grande. Envíalo por URL en lugar de datos binarios.',
	},
	'429': {
		en: 'Rate limit reached and retries were exhausted. Slow down or add a Wait node between sends.',
		pt: 'Limite de requisições atingido e as tentativas acabaram. Diminua o ritmo ou use um nó Wait entre os envios.',
		es: 'Límite de solicitudes alcanzado y se agotaron los reintentos. Reduce el ritmo o usa un nodo Wait entre envíos.',
	},
	'5xx': {
		en: 'ZapZap had a temporary error. Try again in a moment.',
		pt: 'O ZapZap teve um erro temporário. Tente de novo em instantes.',
		es: 'ZapZap tuvo un error temporal. Inténtalo de nuevo en un momento.',
	},
	disconnected: {
		en: 'The WhatsApp instance is not connected. Open the instance in the ZapZap panel and scan the QR code again.',
		pt: 'A instância do WhatsApp não está conectada. Abra a instância no painel do ZapZap e leia o QR code de novo.',
		es: 'La instancia de WhatsApp no está conectada. Abre la instancia en el panel de ZapZap y escanea el código QR otra vez.',
	},
	badNumber: {
		en: 'The number looks invalid or is not on WhatsApp. Use the country code, for example 5511999990001.',
		pt: 'O número parece inválido ou não tem WhatsApp. Use o código do país, por exemplo 5511999990001.',
		es: 'El número parece inválido o no tiene WhatsApp. Usa el código de país, por ejemplo 5511999990001.',
	},
	redirect: {
		en: 'ZapZap answered with a redirect, which is blocked to protect your keys. Check the Base URL in the credential.',
		pt: 'O ZapZap respondeu com um redirecionamento, bloqueado para proteger suas chaves. Confira a Base URL na credencial.',
		es: 'ZapZap respondió con una redirección, bloqueada para proteger tus claves. Revisa la Base URL en la credencial.',
	},
	network: {
		en: 'Could not reach ZapZap (network error or timeout). Check the Base URL and your connection.',
		pt: 'Não foi possível falar com o ZapZap (erro de rede ou tempo esgotado). Confira a Base URL e a conexão.',
		es: 'No se pudo conectar con ZapZap (error de red o tiempo agotado). Revisa la Base URL y tu conexión.',
	},
};

type Vars = Record<string, string>;

/** Messages raised by the node itself (before any call). Each says what happened and what to do. */
const LOCAL: Record<string, Record<Lang, string>> = {
	required: {
		en: '{label} is required. Fill in this field in the node.',
		pt: '{label} é obrigatório. Preencha este campo no nó.',
		es: '{label} es obligatorio. Completa este campo en el nodo.',
	},
	instanceRequired: {
		en: 'Pick an instance in the node. If the list is empty, create and connect one in app.zapzapapi.com first.',
		pt: 'Escolha uma instância no nó. Se a lista estiver vazia, crie e conecte uma em app.zapzapapi.com antes.',
		es: 'Elige una instancia en el nodo. Si la lista está vacía, crea y conecta una en app.zapzapapi.com antes.',
	},
	noInstances: {
		en: 'No instances yet. Create one in app.zapzapapi.com',
		pt: 'Nenhuma instância ainda. Crie uma em app.zapzapapi.com',
		es: 'Aún no hay instancias. Crea una en app.zapzapapi.com',
	},
	numberRequired: {
		en: 'Number is required. Type the WhatsApp number with country code, for example 5511999990001.',
		pt: 'O número é obrigatório. Digite o número do WhatsApp com código do país, por exemplo 5511999990001.',
		es: 'El número es obligatorio. Escribe el número de WhatsApp con código de país, por ejemplo 5511999990001.',
	},
	nameInvalid: {
		en: 'Name can only have letters, numbers, _ and -. Remove spaces and accents, for example MY-SHOP.',
		pt: 'O nome só pode ter letras, números, _ e -. Tire espaços e acentos, por exemplo MINHA-LOJA.',
		es: 'El nombre solo puede tener letras, números, _ y -. Quita espacios y acentos, por ejemplo MI-TIENDA.',
	},
	participantsRequired: {
		en: 'Add at least one participant. Type numbers with country code, separated by commas.',
		pt: 'Adicione pelo menos um participante. Digite os números com código do país, separados por vírgula.',
		es: 'Agrega al menos un participante. Escribe los números con código de país, separados por coma.',
	},
	pollChoices: {
		en: 'A poll needs at least 2 choices. Example: ["Great", "Good", "Bad"]',
		pt: 'Uma enquete precisa de pelo menos 2 opções. Exemplo: ["Ótimo", "Bom", "Ruim"]',
		es: 'Una encuesta necesita al menos 2 opciones. Ejemplo: ["Excelente", "Bueno", "Malo"]',
	},
	buttons: {
		en: 'Buttons need 1 to 3 items. Keep the example shape: [{"text":"Yes","id":"yes"}]',
		pt: 'Os botões precisam de 1 a 3 itens. Mantenha o formato do exemplo: [{"text":"Sim","id":"sim"}]',
		es: 'Los botones necesitan de 1 a 3 elementos. Mantén el formato del ejemplo: [{"text":"Sí","id":"si"}]',
	},
	listChoices: {
		en: 'A list needs at least 1 choice. Example: ["[Products]", "T-shirt|p1|$ 50"]',
		pt: 'Uma lista precisa de pelo menos 1 opção. Exemplo: ["[Produtos]", "Camiseta|p1|R$ 50"]',
		es: 'Una lista necesita al menos 1 opción. Ejemplo: ["[Productos]", "Camiseta|p1|$ 50"]',
	},
	fileUrl: {
		en: 'File URL must start with http:// or https://',
		pt: 'A URL do arquivo precisa começar com http:// ou https://',
		es: 'La URL del archivo debe empezar con http:// o https://',
	},
	tooLarge: {
		en: 'The file is too large to send as binary data (limit about 1 MB). Upload it somewhere and use the URL source.',
		pt: 'O arquivo é grande demais para enviar como dado binário (limite de cerca de 1 MB). Suba o arquivo em algum lugar e use a origem URL.',
		es: 'El archivo es demasiado grande para enviarlo como datos binarios (límite de 1 MB aprox.). Súbelo a algún sitio y usa el origen URL.',
	},
	jsonInvalid: {
		en: '{label} is not valid JSON. Check commas and double quotes. Example: ["Option 1", "Option 2"]',
		pt: '{label} não é um JSON válido. Confira vírgulas e aspas duplas. Exemplo: ["Opção 1", "Opção 2"]',
		es: '{label} no es un JSON válido. Revisa las comas y las comillas dobles. Ejemplo: ["Opción 1", "Opción 2"]',
	},
	pathInvalid: {
		en: 'Path must start with "/" and stay inside the ZapZap API. Example: /account',
		pt: 'O caminho precisa começar com "/" e ficar dentro da API do ZapZap. Exemplo: /account',
		es: 'La ruta debe empezar con "/" y quedarse dentro de la API de ZapZap. Ejemplo: /account',
	},
	baseUrl: {
		en: 'Base URL is invalid ({why}). Fix it in the ZapZap API credential. The default is {def}',
		pt: 'A Base URL é inválida ({why}). Corrija na credencial ZapZap API. O padrão é {def}',
		es: 'La Base URL no es válida ({why}). Corrígela en la credencial ZapZap API. El valor por defecto es {def}',
	},
	unknownOp: {
		en: 'Unknown operation: {op}. Pick the operation again in the node.',
		pt: 'Operação desconhecida: {op}. Escolha a operação de novo no nó.',
		es: 'Operación desconocida: {op}. Elige la operación otra vez en el nodo.',
	},
	maybeSent: {
		en: 'The message may have been sent already. Check the chat before sending again.',
		pt: 'A mensagem pode já ter sido enviada. Confira a conversa antes de enviar de novo.',
		es: 'Es posible que el mensaje ya se haya enviado. Revisa el chat antes de volver a enviarlo.',
	},
	noSecret: {
		en: 'ZapZap did not return a webhook secret, so incoming calls to this trigger cannot be verified. Anyone with the URL could send fake events. Update the ZapZap instance or paste the secret in Options > Webhook Secret.',
		pt: 'O ZapZap não devolveu o segredo do webhook, então as chamadas recebidas por este gatilho não podem ser verificadas. Quem tiver a URL poderia enviar eventos falsos. Atualize a instância do ZapZap ou cole o segredo em Options > Webhook Secret.',
		es: 'ZapZap no devolvió el secreto del webhook, así que las llamadas entrantes a este disparador no se pueden verificar. Cualquiera con la URL podría enviar eventos falsos. Actualiza la instancia de ZapZap o pega el secreto en Options > Webhook Secret.',
	},
};

/** Field names as shown in the UI, per language, for the "is required" message. */
const FIELDS: Record<string, Record<Lang, string>> = {
	Instance: { en: 'Instance', pt: 'Instância', es: 'Instancia' },
	Path: { en: 'Path', pt: 'Caminho', es: 'Ruta' },
	Name: { en: 'Name', pt: 'Nome', es: 'Nombre' },
	Text: { en: 'Text', pt: 'Texto', es: 'Texto' },
	'Group ID': { en: 'Group ID', pt: 'ID do grupo', es: 'ID del grupo' },
	'Group Name': { en: 'Group Name', pt: 'Nome do grupo', es: 'Nombre del grupo' },
	'File URL': { en: 'File URL', pt: 'URL do arquivo', es: 'URL del archivo' },
	'Input Binary Field': { en: 'Input Binary Field', pt: 'Campo binário de entrada', es: 'Campo binario de entrada' },
	'Full Name': { en: 'Full Name', pt: 'Nome completo', es: 'Nombre completo' },
	'Phone Numbers': { en: 'Phone Numbers', pt: 'Telefones', es: 'Teléfonos' },
	'Message ID': { en: 'Message ID', pt: 'ID da mensagem', es: 'ID del mensaje' },
	Body: { en: 'Body', pt: 'Corpo', es: 'Cuerpo' },
	Query: { en: 'Query', pt: 'Query', es: 'Query' },
	Choices: { en: 'Choices', pt: 'Opções', es: 'Opciones' },
	Buttons: { en: 'Buttons', pt: 'Botões', es: 'Botones' },
	Metadata: { en: 'Metadata', pt: 'Metadados', es: 'Metadatos' },
};

/** Text raised by the node itself, in the language chosen in the credential. */
export function msg(lang: Lang, key: string, vars: Vars = {}): string {
	const base = (LOCAL[key] ?? { en: key, pt: key, es: key })[lang];
	return base.replace(/\{(\w+)\}/g, (_, k: string) => {
		if (k === 'label') return FIELDS[vars.label]?.[lang] ?? vars.label;
		return vars[k] ?? '';
	});
}

export function friendlyMessage(status: number | null, lang: Lang = 'en', detail?: string): string {
	if (status === null) return MESSAGES.network[lang];
	if (status >= 300 && status < 400) return MESSAGES.redirect[lang];
	if (detail && status !== 401 && status !== 402 && status !== 429) {
		if (/desconect|disconnect|not connected|n[aã]o conectad|qr ?code/i.test(detail)) return MESSAGES.disconnected[lang];
		if (
			/not on whatsapp|n[aã]o tem whatsapp|invalid (phone|number|jid)|n[uú]mero inv[aá]lido|jid inv[aá]lido|invalid.*\bjid\b/i.test(detail) &&
			(status === 400 || status === 404 || status === 422)
		) {
			return MESSAGES.badNumber[lang];
		}
	}
	if (MESSAGES[String(status)]) return MESSAGES[String(status)][lang];
	if (status >= 500) return MESSAGES['5xx'][lang];
	return MESSAGES['400'][lang];
}

export function parseRetryAfter(value: unknown, now = Date.now()): number | null {
	if (value === undefined || value === null || value === '') return null;
	const s = String(Array.isArray(value) ? value[0] : value).trim();
	if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 1000);
	const t = Date.parse(s);
	if (!Number.isNaN(t)) return Math.max(0, t - now);
	return null;
}

export interface ZapZapRequest {
	method: IHttpRequestMethods;
	/** Path starting with "/", relative to the Base URL. */
	path: string;
	body?: IDataObject;
	qs?: IDataObject;
}

function isTimeout(e: unknown): boolean {
	const code = (e as { code?: string })?.code;
	return code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'ESOCKETTIMEDOUT';
}

function apiMessage(body: unknown): string | undefined {
	if (body && typeof body === 'object') {
		const b = body as IDataObject;
		const m = b.message ?? b.error;
		if (typeof m === 'string') return m;
	}
	if (typeof body === 'string' && body.length < 300) return body;
	return undefined;
}

/** HTTPS only. Plain http is accepted just for localhost (local development of self-hosted installs). */
export function validateBaseUrl(raw: string): string {
	const value = String(raw || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
	let u: URL;
	try {
		u = new URL(value);
	} catch {
		throw new Error('Base URL is not a valid URL');
	}
	const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
	if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
		throw new Error('Base URL must use https');
	}
	if (u.username || u.password) throw new Error('Base URL must not contain credentials');
	return value;
}

export async function getBaseUrl(ctx: Ctx): Promise<string> {
	const credentials = await ctx.getCredentials('zapZapApi');
	try {
		return validateBaseUrl(String(credentials.baseUrl || ''));
	} catch (e) {
		const lang = toLang(credentials.language);
		throw new NodeOperationError(
			ctx.getNode(),
			msg(lang, 'baseUrl', { why: (e as Error).message, def: DEFAULT_BASE_URL }),
		);
	}
}

export async function getLang(ctx: Ctx): Promise<Lang> {
	const credentials = await ctx.getCredentials('zapZapApi');
	return toLang(credentials.language);
}

/** Keeps secrets out of error text: masks anything that looks like one of the headers or a long token. */
export function safeText(t: unknown): string | undefined {
	if (t === undefined || t === null) return undefined;
	return String(t)
		.replace(/(x-api-(?:key|secret)["':=\s]+)[^\s"',}]+/gi, '$1***')
		.slice(0, 500);
}

function backoff(attempt: number): number {
	return 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
}

/**
 * Single entry point for every call to ZapZap (actions, loadOptions and trigger hooks).
 * Adds the client identification headers, retries 429 honoring Retry-After and turns
 * failures into NodeApiError with a clear message.
 */
export async function zapZapRequest<T = unknown>(ctx: Ctx, req: ZapZapRequest): Promise<T> {
	const baseUrl = await getBaseUrl(ctx);
	const lang = await getLang(ctx);
	if (!req.path.startsWith('/') || req.path.includes('://') || req.path.includes('..')) {
		throw new NodeOperationError(ctx.getNode(), msg(lang, 'pathInvalid'));
	}
	const url = `${baseUrl}${req.path}`;
	const idempotent = req.method === 'GET' || req.method === 'PUT' || req.method === 'DELETE';
	// A POST that failed on the network or with 5xx may have been processed anyway.
	const uncertain = !idempotent;
	let attempt = 0;

	for (;;) {
		let res: { statusCode: number; body: unknown; headers: Record<string, unknown> };
		try {
			res = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'zapZapApi', {
				method: req.method,
				url,
				body: req.body,
				qs: req.qs,
				json: true,
				headers: { ...clientHeaders(), Accept: 'application/json' },
				timeout: runtime.timeoutMs,
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
				// Never follow redirects: the keys must not travel to another host.
				disableFollowRedirect: true,
			})) as typeof res;
		} catch (error) {
			// Network failure. Retrying a POST could duplicate a message, so only idempotent calls retry.
			if (idempotent && attempt < runtime.maxRetries && !isTimeout(error)) {
				attempt++;
				await runtime.sleep(backoff(attempt));
				continue;
			}
			// Never hand the raw library error to NodeApiError: it can carry the request config,
			// including the x-api-key and x-api-secret headers. Only a sanitized message and the code go in.
			const code = (error as { code?: unknown })?.code;
			const safe = {
				message: safeText((error as Error)?.message) ?? '',
				...(typeof code === 'string' ? { code } : {}),
			} as JsonObject;
			const text = friendlyMessage(null, lang) + (uncertain ? ' ' + msg(lang, 'maybeSent') : '');
			const apiError = new NodeApiError(ctx.getNode(), safe, {
				message: text,
				description: safeText((error as Error)?.message),
			});
			// n8n replaces the message for timeouts; keep ours, it says what to do.
			apiError.message = text;
			throw apiError;
		}

		const status = res.statusCode;
		if (status >= 200 && status < 300) return res.body as T;

		const retryable429 = status === 429;
		const retryable5xx = idempotent && (status === 502 || status === 503 || status === 504);
		if ((retryable429 || retryable5xx) && attempt < runtime.maxRetries) {
			attempt++;
			const ra = parseRetryAfter(res.headers?.['retry-after']);
			const wait = Math.min(ra ?? backoff(attempt), runtime.maxWaitMs);
			await runtime.sleep(wait);
			continue;
		}

		const detail = apiMessage(res.body);
		throw new NodeApiError(
			ctx.getNode(),
			(res.body && typeof res.body === 'object' ? res.body : { message: String(res.body ?? '') }) as JsonObject,
			{
				httpCode: String(status),
				message: friendlyMessage(status, lang, detail) + (uncertain && status >= 500 ? ' ' + msg(lang, 'maybeSent') : ''),
				description: detail ? `ZapZap: ${safeText(detail)}` : undefined,
			},
		);
	}
}

export function requireValue(ctx: Ctx, value: string, label: string, itemIndex?: number, lang: Lang = 'en'): string {
	const v = (value ?? '').toString().trim();
	if (!v) {
		throw new NodeOperationError(
			ctx.getNode(),
			label === 'Instance' ? msg(lang, 'instanceRequired') : msg(lang, 'required', { label }),
			{ itemIndex },
		);
	}
	return v;
}

/** Digits only for phone numbers; JIDs (contain "@") and group IDs are kept as they are. */
export function normalizeNumber(raw: string, defaultCountryCode = ''): string {
	const v = (raw ?? '').toString().trim();
	if (v.includes('@')) return v;
	const hasPlus = v.startsWith('+');
	let d = v.replace(/\D/g, '');
	if (!d) return '';
	if (d.startsWith('00')) d = d.slice(2);
	else if (!hasPlus && defaultCountryCode) {
		const cc = defaultCountryCode.replace(/\D/g, '');
		// Local format (no country code): prepend the default one. Brazil also drops a leading trunk 0.
		if (cc && !(d.startsWith(cc) && d.length > cc.length + 7)) d = cc + d.replace(/^0+/, '');
	}
	// Brazil only: mobile numbers with the 9th digit missing (55 + DDD + 8 digits starting with 6-9).
	if (d.startsWith('55') && d.length === 12 && /[6-9]/.test(d[4])) d = d.slice(0, 4) + '9' + d.slice(4);
	return d;
}

export function validateHttpUrl(raw: string): string {
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		throw new Error('not a valid URL');
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('only http and https URLs are allowed');
	return raw;
}

/** Accepts a JSON string (what the UI sends) or an already parsed value (from expressions). */
export function parseJsonParam(ctx: Ctx, value: unknown, label: string, itemIndex: number, lang: Lang = 'en'): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		throw new NodeOperationError(ctx.getNode(), msg(lang, 'jsonInvalid', { label }), { itemIndex });
	}
}

export interface InstanceOption {
	name: string;
	value: string;
}

export async function loadInstanceOptions(ctx: ILoadOptionsFunctions): Promise<InstanceOption[]> {
	const list = await zapZapRequest<IDataObject[] | { instances?: IDataObject[] }>(ctx, {
		method: 'GET',
		path: '/instances',
	});
	const arr = Array.isArray(list) ? list : (list?.instances ?? []);
	const options = arr
		.filter((i) => i && i.id)
		.map((i) => {
			const bits = [i.status, i.phone_number].filter(Boolean).join(', ');
			return {
				name: bits ? `${i.name ?? i.id} (${bits})` : String(i.name ?? i.id),
				value: String(i.id),
			};
		});
	if (!options.length) return [{ name: msg(await getLang(ctx), 'noInstances'), value: '' }];
	return options;
}
