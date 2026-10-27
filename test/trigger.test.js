'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { startServer, makeContext, fastRetries, client } = require('./harness');
const { ZapZapTrigger, verifySignature, quickFields } = require('../dist/nodes/ZapZapTrigger/ZapZapTrigger.node.js');
const { ZapZap } = require('../dist/nodes/ZapZap/ZapZap.node.js');
const rootPkg = require('../package.json');

const trigger = new ZapZapTrigger();
const HOOK = trigger.webhookMethods.default;
const WH = 'https://n8n.example.com/webhook/abc/webhook';
const ID = `n8n-nodes-zapzap/${rootPkg.version}`;

function sign(secret, raw, t = Math.floor(Date.now() / 1000)) {
	return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;
}

function webhookCtx({ body, raw, headers = {}, params = {}, staticData = {} }) {
	const rawBody = Buffer.from(raw ?? JSON.stringify(body));
	const out = { status: null, json: null };
	const ctx = makeContext({ baseUrl: 'https://x.invalid', staticData, params: { events: [], options: {}, ...params } });
	ctx.getRequestObject = () => ({ headers, rawBody });
	ctx.getResponseObject = () => ({ status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } });
	ctx.getBodyData = () => body;
	return { ctx, out };
}

const message = (over = {}) => ({
	delivery_id: 'd1', event: 'messages', instance_id: 'i1', instance_name: 'SHOP',
	data: { message: { id: '5511999990003:ABC', chatid: '5511999990001@s.whatsapp.net', sender: '5511999990001@s.whatsapp.net', fromMe: false, text: 'Olá 😀', messageType: 'Conversation', messageTimestamp: 1760000000000, ...over } },
});

test('hooks: checkExists, create and delete send the client header and manage the webhook', async () => {
	let current = null;
	const srv = await startServer((hit) => {
		if (hit.method === 'GET') return { body: { webhook_url: current, webhook_secret: 'whsec_abc' } };
		current = hit.body.webhook_url || null;
		return { body: { webhook_url: current, webhook_secret: 'whsec_abc' } };
	});
	try {
		const sd = {};
		const mk = () => makeContext({ baseUrl: srv.url, staticData: sd, params: { instanceId: 'i1', events: ['messages'], manualSetup: false } });
		assert.equal(await HOOK.checkExists.call(mk()), false);
		assert.equal(await HOOK.create.call(mk()), true);
		assert.deepEqual(srv.hits.at(-1).body, { webhook_url: WH, enabled: true, events: ['messages'] });
		assert.equal(sd.webhookSecret, 'whsec_abc');
		assert.equal(await HOOK.checkExists.call(mk()), true);
		assert.equal(await HOOK.delete.call(mk()), true);
		assert.equal(current, null, 'webhook removed on deactivate');
		assert.equal(sd.webhookSecret, undefined);
		for (const h of srv.hits) {
			assert.equal(h.headers['x-zapzap-client'], ID);
			assert.equal(h.headers['user-agent'], ID);
			assert.ok(h.url.startsWith('/instances/i1/webhook'));
		}
	} finally { await srv.close(); }
});

test('delete leaves a webhook that points somewhere else', async () => {
	const srv = await startServer((hit) => ({ body: { webhook_url: 'https://other.example.com/hook' } }));
	try {
		await HOOK.delete.call(makeContext({ baseUrl: srv.url, params: { instanceId: 'i1', manualSetup: false } }));
		assert.ok(srv.hits.every((h) => h.method === 'GET'));
	} finally { await srv.close(); }
});

test('create explains a non-HTTPS n8n URL and a missing instance; manual mode does nothing', async () => {
	const srv = await startServer(() => ({ body: {} }));
	try {
		await assert.rejects(HOOK.create.call(makeContext({ baseUrl: srv.url, params: { instanceId: 'i1', events: [], manualSetup: false, __webhookUrl: 'http://localhost:5678/webhook/x/webhook' } })), /HTTPS/);
		await assert.rejects(HOOK.create.call(makeContext({ baseUrl: srv.url, params: { instanceId: '', events: [], manualSetup: false } })), /Pick an instance/);
		assert.equal(await HOOK.create.call(makeContext({ baseUrl: srv.url, params: { manualSetup: true } })), true);
		assert.equal(srv.hits.length, 0);
	} finally { await srv.close(); }
});

test('create surfaces the server rejection in plain words', async () => {
	fastRetries();
	const srv = await startServer(() => ({ status: 400, body: { message: 'URL inacessível' } }));
	try {
		await assert.rejects(HOOK.create.call(makeContext({ baseUrl: srv.url, lang: 'pt', params: { instanceId: 'i1', events: [], manualSetup: false } })), /recusou a requisição/);
	} finally { await srv.close(); }
});

test('loadOptions lists instance names with status and sends the client header', async () => {
	const srv = await startServer(() => ({ body: [{ id: 'a', name: 'SHOP', status: 'CONNECTED', phone_number: '5511999990001' }, { id: 'b', name: 'TEST', status: 'DISCONNECTED' }] }));
	try {
		const ctx = makeContext({ baseUrl: srv.url });
		const opts = await trigger.methods.loadOptions.getInstances.call(ctx);
		assert.deepEqual(opts, [{ name: 'SHOP (CONNECTED, 5511999990001)', value: 'a' }, { name: 'TEST (DISCONNECTED)', value: 'b' }]);
		const opts2 = await new ZapZap().methods.loadOptions.getInstances.call(ctx);
		assert.equal(opts2.length, 2);
		assert.ok(srv.hits.every((h) => h.headers['x-zapzap-client'] === ID));
	} finally { await srv.close(); }
});

test('credentialTest: friendly success and failure, header sent', async () => {
	const srv = await startServer((hit) => (hit.headers['x-api-key'] === 'good' ? { body: hit.url === '/account' ? { name: 'Ana' } : [1, 2, 3] } : { status: 401, body: {} }));
	try {
		const t = new ZapZap().methods.credentialTest.zapZapApiTest;
		const ctx = makeContext({ baseUrl: srv.url });
		const ok = await t.call(ctx, { data: { apiKey: 'good', apiSecret: 's', baseUrl: srv.url, language: 'pt' } });
		assert.deepEqual(ok, { status: 'OK', message: 'Conectado como Ana, 3 instância(s)' });
		const bad = await t.call(ctx, { data: { apiKey: 'nope', apiSecret: 's', baseUrl: srv.url, language: 'en' } });
		assert.equal(bad.status, 'Error');
		assert.match(bad.message, /Invalid API Key/);
		const noHttps = await t.call(ctx, { data: { apiKey: 'a', apiSecret: 's', baseUrl: 'http://api.example.com' } });
		assert.match(noHttps.message, /https/);
		assert.ok(srv.hits.every((h) => h.headers['x-zapzap-client'] === ID));
	} finally { await srv.close(); }
});

test('webhook: valid signature passes and adds quick fields', async () => {
	const body = message();
	const raw = JSON.stringify(body);
	const { ctx, out } = webhookCtx({ body, raw, headers: { 'x-zapzap-signature': sign('whsec_abc', raw) }, staticData: { webhookSecret: 'whsec_abc' }, params: { events: ['messages'], options: {} } });
	const r = await trigger.webhook.call(ctx);
	const j = r.workflowData[0][0].json;
	assert.equal(out.status, null);
	assert.equal(j.from, '5511999990001');
	assert.equal(j.text, 'Olá 😀');
	assert.equal(j.type, 'Conversation');
	assert.equal(j.isGroup, false);
	assert.equal(j.fromMe, false);
	assert.equal(j.instanceName, 'SHOP');
	assert.equal(j.time, new Date(1760000000000).toISOString());
	assert.equal(j.data.message.text, 'Olá 😀', 'full payload kept');
});

test('webhook: wrong, missing, stale signature are rejected with 401 and no execution', async () => {
	const body = message();
	const raw = JSON.stringify(body);
	for (const [headers, re] of [
		[{ 'x-zapzap-signature': sign('other-secret', raw) }, /invalid signature/],
		[{}, /missing signature/],
		[{ 'x-zapzap-signature': sign('whsec_abc', raw, Math.floor(Date.now() / 1000) - 3600) }, /too old/],
		[{ 'x-zapzap-signature': 'garbage' }, /invalid signature/],
	]) {
		const { ctx, out } = webhookCtx({ body, raw, headers, staticData: { webhookSecret: 'whsec_abc' } });
		const r = await trigger.webhook.call(ctx);
		assert.equal(out.status, 401);
		assert.match(out.json.error, re);
		assert.equal(r.workflowData, undefined);
		assert.equal(r.noWebhookResponse, true);
	}
});

test('verifySignature tampered body and unit behavior', () => {
	const raw = '{"a":1}';
	assert.equal(verifySignature('s', raw, sign('s', raw)), 'ok');
	assert.equal(verifySignature('s', '{"a":2}', sign('s', raw)), 'bad');
});

test('webhook: dedupes retries, ignores own messages, filters events, survives malformed payloads', async () => {
	const sd = { webhookSecret: '' };
	const run = (body, params = {}) => trigger.webhook.call(webhookCtx({ body, staticData: sd, params: { events: [], options: {}, ...params } }).ctx);
	assert.ok((await run(message())).workflowData);
	assert.equal((await run(message())).workflowData, undefined, 'same delivery_id skipped');
	assert.ok((await run({ ...message(), delivery_id: 'd2' })).workflowData);
	assert.equal((await run({ ...message({ fromMe: true }), delivery_id: 'd3' }, { options: { ignoreOwn: true } })).workflowData, undefined);
	assert.equal((await run({ ...message(), delivery_id: 'd4', event: 'presence' }, { events: ['messages'] })).workflowData, undefined);
	for (const bad of [null, 'text', [1, 2], 42]) {
		const { ctx, out } = webhookCtx({ body: bad, raw: 'x' });
		const r = await trigger.webhook.call(ctx);
		assert.equal(out.status, 400);
		assert.equal(r.workflowData, undefined);
	}
	const weird = await run({ event: 'messages', data: { message: 'not an object' }, delivery_id: 'd9' });
	assert.ok(weird.workflowData, 'odd shape still delivered without TypeError');
	assert.doesNotThrow(() => quickFields({ data: null }));
	assert.doesNotThrow(() => quickFields({ data: { message: { messageTimestamp: 'abc', content: null } } }));
});

test('manual secret option is honored', async () => {
	const body = message();
	const raw = JSON.stringify(body);
	const { ctx, out } = webhookCtx({ body, raw, headers: { 'x-zapzap-signature': sign('wrong', raw) }, params: { options: { webhookSecret: 'whsec_manual' } } });
	await trigger.webhook.call(ctx);
	assert.equal(out.status, 401);
});

test('beginner flow end to end: credential, pick instance, send text, receive in trigger', async () => {
	let hook = null;
	const srv = await startServer((hit) => {
		if (hit.url === '/account') return { body: { name: 'Ana', email: 'a@example.com' } };
		if (hit.url === '/instances') return { body: [{ id: 'inst-1', name: 'SHOP', status: 'CONNECTED' }] };
		if (hit.url.endsWith('/send/text')) return { body: { id: 'sent-1' } };
		if (hit.url.endsWith('/webhook')) { if (hit.method === 'PUT') hook = hit.body.webhook_url; return { body: { webhook_url: hook, webhook_secret: 'whsec_x' } }; }
		return { status: 404, body: {} };
	});
	try {
		const cred = await new ZapZap().methods.credentialTest.zapZapApiTest.call(makeContext({ baseUrl: srv.url }), { data: { apiKey: 'k', apiSecret: 's', baseUrl: srv.url } });
		assert.equal(cred.status, 'OK');
		const sd = {};
		const ctxT = makeContext({ baseUrl: srv.url, staticData: sd, params: { instanceId: 'inst-1', events: ['messages'], manualSetup: false } });
		const names = await trigger.methods.loadOptions.getInstances.call(ctxT);
		assert.equal(names[0].name, 'SHOP (CONNECTED)');
		await HOOK.create.call(ctxT);
		assert.equal(hook, WH);
		const body = message();
		const raw = JSON.stringify(body);
		const got = await trigger.webhook.call(webhookCtx({ body, raw, headers: { 'x-zapzap-signature': sign('whsec_x', raw) }, staticData: sd, params: { events: ['messages'] } }).ctx);
		const from = got.workflowData[0][0].json.from;
		const sent = await new ZapZap().execute.call(makeContext({ baseUrl: srv.url, params: { resource: 'message', operation: 'sendText', instanceId: 'inst-1', number: from, text: 'Recebido!' } }));
		assert.equal(sent[0][0].json.id, 'sent-1');
		assert.ok(srv.hits.every((h) => h.headers['x-zapzap-client'] === ID), 'header on every call');
	} finally { await srv.close(); }
});

test('package metadata for verification', () => {
	assert.equal(rootPkg.license, 'MIT');
	assert.ok(rootPkg.keywords.includes('n8n-community-node-package'));
	assert.equal(Object.keys(rootPkg.dependencies || {}).length, 0, 'zero runtime dependencies');
	assert.equal(client.CLIENT_NAME, 'n8n-nodes-zapzap');
});
