import { createHmac, timingSafeEqual } from 'crypto';
import type {
	IDataObject,
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getBaseUrl, getLang, loadInstanceOptions, msg, zapZapRequest } from '../shared/client';

export const SIGNATURE_TOLERANCE_SEC = 300;
const MAX_SEEN = 500;

/** Checks `X-ZapZap-Signature: t=<unix>,v1=<hmac>` over `${t}.${rawBody}`. Constant time. */
export function verifySignature(
	secret: string,
	rawBody: string | Buffer,
	header: string,
	nowSec = Math.floor(Date.now() / 1000),
): 'ok' | 'bad' | 'stale' {
	const parts: Record<string, string> = {};
	for (const kv of String(header || '').split(',')) {
		const idx = kv.indexOf('=');
		if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
	}
	const t = Number(parts.t);
	const v1 = parts.v1;
	if (!Number.isFinite(t) || !v1) return 'bad';
	const expected = createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex');
	const a = Buffer.from(expected);
	const b = Buffer.from(v1);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return 'bad';
	if (Math.abs(nowSec - t) > SIGNATURE_TOLERANCE_SEC) return 'stale';
	return 'ok';
}

/** Adds easy-to-use top-level fields (from, text, type, time...) without removing the original payload. */
export function quickFields(body: IDataObject): IDataObject {
	const data = (body.data && typeof body.data === 'object' ? body.data : {}) as IDataObject;
	const msg = (data.message && typeof data.message === 'object' ? data.message : {}) as IDataObject;
	const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));
	const chatId = str(msg.chatid || msg.chatId);
	const sender = str(msg.sender) || chatId;
	const digits = (j: string): string => j.split('@')[0].split(':')[0];
	let time: string | undefined;
	const ts = Number(msg.messageTimestamp);
	if (Number.isFinite(ts) && ts > 0) {
		const d = new Date(ts < 1e12 ? ts * 1000 : ts);
		if (!Number.isNaN(d.getTime())) time = d.toISOString();
	}
	const out: IDataObject = {
		event: str(body.event),
		instanceId: str(body.instance_id),
		instanceName: str(body.instance_name),
	};
	if (Object.keys(msg).length) {
		Object.assign(out, {
			from: digits(sender || chatId),
			chatId,
			isGroup: chatId.endsWith('@g.us') || msg.isGroup === true,
			fromMe: msg.fromMe === true,
			text: str(msg.text ?? msg.body ?? (msg.content as IDataObject | undefined)?.text),
			type: str(msg.messageType ?? msg.type),
			messageId: str(msg.id ?? msg.messageid),
			time,
		});
	}
	return out;
}

export class ZapZapTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ZapZap Trigger',
		name: 'zapZapTrigger',
		icon: 'file:zapzap.svg',
		group: ['trigger'],
		usableAsTool: true,
		version: 1,
		subtitle: '=Events: {{$parameter["events"].length ? $parameter["events"].join(", ") : "main"}}',
		description: 'Start a workflow when a WhatsApp message or event arrives on a ZapZap instance',
		defaults: {
			name: 'ZapZap Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'zapZapApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'1. Pick the instance. 2. Activate the workflow: the webhook is registered on that instance automatically and removed when you deactivate it. 3. Send a test message to that number. n8n needs a public HTTPS address. While you test with "Listen for test event", the instance webhook points to the test URL and is restored when you stop.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Instance Name or ID',
				name: 'instanceId',
				type: 'options',
				required: true,
				default: '',
				typeOptions: { loadOptionsMethod: 'getInstances' },
				description:
					'The connected WhatsApp number to listen to (called an instance). If the list is empty, create and connect one in app.zapzapapi.com first. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { manualSetup: [false] } },
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				default: ['messages'],
				description: 'Which events start the workflow. Leave empty for the main ones (messages, connection and status).',
				options: [
					{ name: 'Calls', value: 'call', description: 'Incoming audio or video calls' },
					{ name: 'Chats', value: 'chats', description: 'Chat created, updated or removed' },
					{ name: 'Connection', value: 'connection', description: 'Connection state changed' },
					{ name: 'Contacts', value: 'contacts', description: 'Contact created or updated' },
					{ name: 'Groups', value: 'groups', description: 'Group and participant changes' },
					{ name: 'Messages', value: 'messages', description: 'Incoming and outgoing messages' },
					{ name: 'Messages Update', value: 'messages_update', description: 'Delivery status (sent, delivered, read)' },
					{ name: 'Presence', value: 'presence', description: 'Online, offline and typing. High volume.' },
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Add Quick Fields',
						name: 'quickFields',
						type: 'boolean',
						default: true,
						description:
							'Whether to add easy fields at the top of the output: from, text, type, time, chatId, isGroup, fromMe, messageId. The full payload is kept.',
					},
					{
						displayName: 'Ignore My Own Messages',
						name: 'ignoreOwn',
						type: 'boolean',
						default: false,
						description:
							'Whether to skip messages sent by your own number. Turn on for auto replies so the workflow does not answer itself.',
					},
					{
						displayName: 'Skip Repeated Deliveries',
						name: 'dedupe',
						type: 'boolean',
						default: true,
						description: 'Whether to ignore an event that ZapZap re-sends after a retry (same delivery ID)',
					},
					{
						displayName: 'Webhook Secret',
						name: 'webhookSecret',
						type: 'string',
						typeOptions: { password: true },
						default: '',
						description:
							'Only for "Set Webhook Manually". Paste the secret shown in the ZapZap webhook settings so signatures are checked. Without it, fake events are accepted. With automatic setup this is handled for you.',
					},
				],
			},
			{
				displayName: 'Set Webhook Manually',
				name: 'manualSetup',
				type: 'boolean',
				default: false,
				description:
					'Whether to skip auto-registration and point the instance webhook yourself, in the ZapZap panel. Paste the secret in Options > Webhook Secret. Without it, anyone who knows the webhook URL can send fake events.',
			},
		],
	};

	methods = {
		loadOptions: {
			async getInstances(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadInstanceOptions(this);
			},
		},
	};

	webhookMethods = {
		default: {
			// True when the instance webhook already points to this n8n URL.
			async checkExists(this: IHookFunctions): Promise<boolean> {
				if (this.getNodeParameter('manualSetup', false) as boolean) return true;
				const instanceId = ((this.getNodeParameter('instanceId', '') as string) || '').trim();
				if (!instanceId) return false;
				const webhookUrl = this.getNodeWebhookUrl('default');
				try {
					const current = await zapZapRequest<IDataObject>(this, {
						method: 'GET',
						path: `/instances/${encodeURIComponent(instanceId)}/webhook`,
					});
					if (current?.webhook_url === webhookUrl) {
						const data = this.getWorkflowStaticData('node');
						if (typeof current.webhook_secret === 'string' && current.webhook_secret) {
							data.webhookSecret = current.webhook_secret;
							return true;
						}
						// Registered but no secret to verify with: let create() decide (it fails closed).
						const own = (this.getNodeParameter('options', {}) as IDataObject).webhookSecret;
						return Boolean(data.webhookSecret || own);
					}
				} catch {
					// Lookup failed: let create() try, it raises a clear error if it still fails.
				}
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				if (this.getNodeParameter('manualSetup', false) as boolean) return true;
				const instanceId = ((this.getNodeParameter('instanceId', '') as string) || '').trim();
				if (!instanceId) {
					throw new NodeOperationError(
						this.getNode(),
						'Pick an instance to register the webhook automatically, or turn on "Set Webhook Manually".',
					);
				}
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) throw new NodeOperationError(this.getNode(), 'Could not obtain the n8n webhook URL.');
				if (!webhookUrl.startsWith('https://')) {
					throw new NodeOperationError(this.getNode(), 'ZapZap needs a public HTTPS webhook URL.', {
						description:
							'n8n is using ' +
							webhookUrl.split('/webhook')[0] +
							'. Set WEBHOOK_URL to your public HTTPS address, use a tunnel, or turn on "Set Webhook Manually".',
					});
				}
				const events = this.getNodeParameter('events', []) as string[];
				const res = await zapZapRequest<IDataObject>(this, {
					method: 'PUT',
					path: `/instances/${encodeURIComponent(instanceId)}/webhook`,
					body: { webhook_url: webhookUrl, enabled: true, events },
				});
				const data = this.getWorkflowStaticData('node');
				if (res && typeof res.webhook_secret === 'string' && res.webhook_secret) {
					data.webhookSecret = res.webhook_secret;
					return true;
				}
				// No secret came back. Unless the user pasted one, events could not be verified: fail closed
				// and undo the registration so the instance does not keep posting to an open URL.
				const own = (this.getNodeParameter('options', {}) as IDataObject).webhookSecret;
				if (!own) {
					try {
						await zapZapRequest(this, {
							method: 'PUT',
							path: `/instances/${encodeURIComponent(instanceId)}/webhook`,
							body: { webhook_url: '' },
						});
					} catch {
						// Best effort.
					}
					throw new NodeOperationError(this.getNode(), msg(await getLang(this), 'noSecret'));
				}
				return true;
			},

			// Removes the registration only if it still points to this workflow.
			async delete(this: IHookFunctions): Promise<boolean> {
				if (this.getNodeParameter('manualSetup', false) as boolean) return true;
				const instanceId = ((this.getNodeParameter('instanceId', '') as string) || '').trim();
				if (!instanceId) return true;
				try {
					await getBaseUrl(this);
					const path = `/instances/${encodeURIComponent(instanceId)}/webhook`;
					const current = await zapZapRequest<IDataObject>(this, { method: 'GET', path });
					if (current?.webhook_url === this.getNodeWebhookUrl('default')) {
						await zapZapRequest(this, { method: 'PUT', path, body: { webhook_url: '' } });
					}
				} catch {
					// Best effort: the workflow is being deactivated anyway.
				}
				const data = this.getWorkflowStaticData('node');
				delete data.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const reject = (code: number, error: string): IWebhookResponseData => {
			res.status(code).json({ error });
			return { noWebhookResponse: true };
		};

		// Signature check (HMAC-SHA256 with timestamp, replay window of 5 minutes).
		const data = this.getWorkflowStaticData('node');
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const secret = String(options.webhookSecret || data.webhookSecret || '');
		if (secret) {
			const header = String(req.headers['x-zapzap-signature'] ?? '');
			const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
			if (!header) return reject(401, 'missing signature');
			// Fail closed: without the raw bytes the signature cannot be checked, so nothing is accepted.
			if (!raw) return reject(401, 'missing raw body');
			const verdict = verifySignature(secret, raw, header);
			if (verdict === 'bad') return reject(401, 'invalid signature');
			if (verdict === 'stale') return reject(401, 'signature too old');
		}

		const body = this.getBodyData() as IDataObject;
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return reject(400, 'invalid payload');
		}

		// Event filter (the server already filters; this protects manual setups).
		const selected = this.getNodeParameter('events', []) as string[];
		const event = typeof body.event === 'string' ? body.event : undefined;
		const ack = { webhookResponse: { ok: true } };
		if (selected.length > 0 && event && !selected.includes(event)) return ack;

		// Retries from ZapZap carry the same delivery_id.
		if (options.dedupe !== false && typeof body.delivery_id === 'string') {
			const seen = (data.seen as string[] | undefined) ?? [];
			if (seen.includes(body.delivery_id)) return ack;
			seen.push(body.delivery_id);
			data.seen = seen.slice(-MAX_SEEN);
		}

		const quick = quickFields(body);
		if (options.ignoreOwn === true && quick.fromMe === true) return ack;

		const json: IDataObject = options.quickFields === false ? body : { ...quick, ...body };
		return {
			webhookResponse: { ok: true },
			workflowData: [[{ json }]],
		};
	}
}
