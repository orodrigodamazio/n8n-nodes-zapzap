'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { startServer, makeContext, fastRetries, client } = require('./harness');
const { ZapZapTrigger } = require('../dist/nodes/ZapZapTrigger/ZapZapTrigger.node.js');
const { ZapZap } = require('../dist/nodes/ZapZap/ZapZap.node.js');
const rootPkg = require('../package.json');

const trigger = new ZapZapTrigger();
const HOOK = trigger.webhookMethods.default;
const run = (ctx) => new ZapZap().execute.call(ctx);
const sendText = { resource: 'message', operation: 'sendText', instanceId: 'inst-1', number: '5511999990001', text: 'hi' };

function webhookCtx({ body, headers, rawBody, staticData = {}, params = {} }) {
	const out = { status: null, json: null };
	const ctx = makeContext({ baseUrl: 'https://x.invalid', staticData, params: { events: [], options: {}, ...params } });
	ctx.getRequestObject = () => ({ headers, rawBody });
	ctx.getResponseObject = () => ({ status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } });
	ctx.getBodyData = () => body;
	return { ctx, out };
}

test('version header constant matches package.json', () => {
	assert.equal(client.CLIENT_VERSION, rootPkg.version);
	assert.equal(client.CLIENT_ID, `n8n-nodes-zapzap/${rootPkg.version}`);
});

test('package: templates published, node-cli >= 0.23 in devDependencies', () => {
	assert.ok(rootPkg.files.includes('templates'));
	const range = rootPkg.devDependencies['@n8n/node-cli'];
	assert.ok(range, 'node-cli present');
	const [maj, min] = range.replace(/^[^\d]*/, '').split('.').map(Number);
	assert.ok(maj > 0 || min >= 23);
	assert.equal(rootPkg.repository.url, 'git+https://github.com/zapzapapi/n8n-nodes-zapzap.git'.replace('git+', ''));
});

test('trigger: secret set but no rawBody is rejected with 401 (fail closed)', async () => {
	const body = { event: 'messages', delivery_id: 'd1', data: {} };
	const t = Math.floor(Date.now() / 1000);
	const sig = `t=${t},v1=${createHmac('sha256', 's3cret').update(`${t}.${JSON.stringify(body)}`).digest('hex')}`;
	const { ctx, out } = webhookCtx({ body, headers: { 'x-zapzap-signature': sig }, rawBody: undefined, staticData: { webhookSecret: 's3cret' } });
	const r = await trigger.webhook.call(ctx);
	assert.equal(out.status, 401);
	assert.equal(out.json.error, 'missing raw body');
	assert.equal(r.noWebhookResponse, true);
	assert.equal(r.workflowData, undefined);
});

test('network error: the raw library error (with auth headers) never reaches NodeApiError', async () => {
	const ctx = makeContext({ baseUrl: 'https://api.example.com/api/v1', params: sendText });
	ctx.helpers.httpRequestWithAuthentication = async () => {
		const err = new Error('connect ECONNRESET x-api-key: KEY-123');
		err.code = 'ECONNRESET';
		err.config = { headers: { 'x-api-key': 'KEY-123', 'x-api-secret': 'SECRET-456' } };
		err.request = { _header: 'x-api-key: KEY-123\r\nx-api-secret: SECRET-456' };
		throw err;
	};
	await assert.rejects(run(ctx), (e) => {
		const dump = JSON.stringify(e, Object.getOwnPropertyNames(e)) + String(e.stack) + JSON.stringify(e.cause ?? null);
		assert.ok(!dump.includes('KEY-123'), 'api key leaked');
		assert.ok(!dump.includes('SECRET-456'), 'api secret leaked');
		assert.ok(!dump.includes('"config"'), 'raw error object leaked');
		return true;
	});
});

test('trigger create: no secret from ZapZap fails closed and undoes the registration', async () => {
	let current = null;
	const srv = await startServer((hit) => {
		if (hit.method === 'PUT') current = hit.body.webhook_url || null;
		return { body: { webhook_url: current } };
	});
	try {
		const mk = (options) => makeContext({ baseUrl: srv.url, staticData: {}, params: { instanceId: 'i1', events: ['messages'], manualSetup: false, options } });
		await assert.rejects(HOOK.create.call(mk({})), /did not return a webhook secret/);
		assert.equal(current, null, 'registration undone');
		// A secret pasted by the user is enough.
		assert.equal(await HOOK.create.call(mk({ webhookSecret: 'whsec_mine' })), true);
		// Already registered but no secret anywhere: not "existing", so create() runs and complains.
		assert.equal(await HOOK.checkExists.call(mk({})), false);
		assert.equal(await HOOK.checkExists.call(mk({ webhookSecret: 'whsec_mine' })), true);
	} finally { await srv.close(); }
});

test('send failures (5xx, timeout) warn that the message may have been sent', async () => {
	fastRetries();
	const srv = await startServer(() => ({ status: 500, body: {} }));
	try {
		for (const [lang, re] of [['en', /may have been sent already/], ['pt', /pode já ter sido enviada/], ['es', /ya se haya enviado/]]) {
			await assert.rejects(run(makeContext({ baseUrl: srv.url, lang, params: sendText })), (e) => { assert.match(e.message, re); return true; });
		}
		// Reads are safe to repeat: no warning.
		await assert.rejects(run(makeContext({ baseUrl: srv.url, params: { resource: 'account', operation: 'accountGet' } })), (e) => { assert.doesNotMatch(e.message, /sent already/); return true; });
	} finally { await srv.close(); }
	client.runtime.timeoutMs = 150;
	const slow = await startServer(() => new Promise(() => {}));
	try {
		await assert.rejects(run(makeContext({ baseUrl: slow.url, params: sendText })), (e) => { assert.match(e.message, /may have been sent already/); return true; });
	} finally { client.runtime.timeoutMs = 60_000; await slow.close(); }
});

test('validation messages follow the credential language and say what to do', async () => {
	const base = { resource: 'message', operation: 'sendText', instanceId: 'inst-1', text: 'x' };
	await assert.rejects(run(makeContext({ baseUrl: 'https://x.invalid', lang: 'pt', params: { ...base, number: '' } })), /número é obrigatório.*5511999990001/);
	await assert.rejects(run(makeContext({ baseUrl: 'https://x.invalid', lang: 'es', params: { ...base, number: '' } })), /número es obligatorio/);
	await assert.rejects(run(makeContext({ baseUrl: 'https://x.invalid', lang: 'en', params: { ...base, number: '' } })), /Number is required\. Type/);
	await assert.rejects(run(makeContext({ baseUrl: 'https://x.invalid', lang: 'pt', params: { ...base, instanceId: '', number: '55119' } })), /Escolha uma instância/);
	await assert.rejects(run(makeContext({ baseUrl: 'https://x.invalid', lang: 'pt', params: { ...base, number: '5511999990001', text: '' } })), /Texto é obrigatório/);
	await assert.rejects(run(makeContext({ baseUrl: 'https://x.invalid', lang: 'es', params: { resource: 'instance', operation: 'create', name: 'bad name!' } })), /solo puede tener letras/);
	await assert.rejects(run(makeContext({ baseUrl: 'http://api.example.com', lang: 'pt', params: { ...base, number: '5511999990001' } })), /Base URL é inválida/);
});

test('empty instance list tells the user what to do, in the credential language', async () => {
	const srv = await startServer(() => ({ body: [] }));
	try {
		const en = await trigger.methods.loadOptions.getInstances.call(makeContext({ baseUrl: srv.url }));
		assert.match(en[0].name, /No instances yet.*app\.zapzapapi\.com/);
		const pt = await trigger.methods.loadOptions.getInstances.call(makeContext({ baseUrl: srv.url, lang: 'pt' }));
		assert.match(pt[0].name, /Nenhuma instância/);
	} finally { await srv.close(); }
});

test('audio types have plain names and no jargon', () => {
	const type = new ZapZap().description.properties.find((p) => p.name === 'type');
	const names = type.options.map((o) => o.name).join(' | ');
	assert.doesNotMatch(names, /PTT|PTV|Myaudio/);
	assert.ok(type.options.some((o) => o.value === 'ptt' && o.name === 'Voice Message'));
});

test('templates: no invalid placeholder, easy Trigger fields, no raw webhook paths for text and sender', () => {
	const fs = require('node:fs');
	const path = require('node:path');
	const dir = path.join(__dirname, '..', 'templates');
	for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
		const raw = fs.readFileSync(path.join(dir, f), 'utf8');
		JSON.parse(raw);
		assert.doesNotMatch(raw, /YOUR_[A-Z_]*INSTANCE_ID/, f);
		assert.doesNotMatch(raw, /data\.message\.(text|chatid|fromMe)/, f);
	}
});
