import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';
import pkg from '../../package.json';

// The version comes from package.json at build time (the compiler copies it to dist/package.json),
// so the header can never drift from the published version.

export const CLIENT_NAME = 'n8n-nodes-zapzap';
export const CLIENT_VERSION: string = pkg.version;
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

export function friendlyMessage(status: number | null, lang: Lang = 'en', detail?: string): string {
	if (status === null) return MESSAGES.network[lang];
	if (status >= 300 && status < 400) return MESSAGES.redirect[lang];
	if (detail && status !== 401 && status !== 402 && status !== 429) {
		if (/desconect|disconnect|not connected|n[aã]o conectad|qr ?code/i.test(detail)) return MESSAGES.disconnected[lang];
		if (/n[uú]mero|number|not on whatsapp|n[aã]o tem whatsapp|invalid phone|jid/i.test(detail) && status < 500) {
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
		throw new NodeOperationError(ctx.getNode(), (e as Error).message, {
			description: 'Fix the Base URL in the ZapZap API credential. The default is ' + DEFAULT_BASE_URL,
		});
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
		throw new NodeOperationError(ctx.getNode(), 'Path must start with "/" and stay inside the ZapZap API');
	}
	const url = `${baseUrl}${req.path}`;
	const idempotent = req.method === 'GET' || req.method === 'PUT' || req.method === 'DELETE';
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
			const apiError = new NodeApiError(ctx.getNode(), error as JsonObject, {
				message: friendlyMessage(null, lang),
				description: safeText((error as Error)?.message),
			});
			// n8n replaces the message for timeouts; keep ours, it says what to do.
			apiError.message = friendlyMessage(null, lang);
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
				message: friendlyMessage(status, lang, detail),
				description: detail ? `ZapZap: ${safeText(detail)}` : undefined,
			},
		);
	}
}

export function requireValue(ctx: Ctx, value: string, label: string, itemIndex?: number): string {
	const v = (value ?? '').toString().trim();
	if (!v) {
		throw new NodeOperationError(ctx.getNode(), `${label} is required`, { itemIndex });
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
export function parseJsonParam(ctx: Ctx, value: unknown, label: string, itemIndex: number): unknown {
	if (typeof value !== 'string') return value;
	try {
		return JSON.parse(value);
	} catch {
		throw new NodeOperationError(ctx.getNode(), `${label} is not valid JSON`, {
			itemIndex,
			description: 'Check commas and double quotes. Example: ["Option 1", "Option 2"]',
		});
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
	return arr
		.filter((i) => i && i.id)
		.map((i) => {
			const bits = [i.status, i.phone_number].filter(Boolean).join(', ');
			return {
				name: bits ? `${i.name ?? i.id} (${bits})` : String(i.name ?? i.id),
				value: String(i.id),
			};
		});
}
