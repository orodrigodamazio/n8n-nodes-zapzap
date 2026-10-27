'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, makeContext, fastRetries, client } = require('./harness');
const { ZapZap } = require('../dist/nodes/ZapZap/ZapZap.node.js');
const rootPkg = require('../package.json');

const node = new ZapZap();
const run = (ctx) => node.execute.call(ctx);
const INST = 'inst-1';

test('version header matches package.json and is sent on every action call', async () => {
	assert.equal(client.CLIENT_VERSION, rootPkg.version);
	const srv = await startServer(() => ({ status: 200, body: { ok: true } }));
	try {
		await run(makeContext({ baseUrl: srv.url, params: { resource: 'message', operation: 'sendText', instanceId: INST, number: '5511999990001', text: 'hi' } }));
		const h = srv.hits[0].headers;
		assert.equal(h['x-zapzap-client'], `n8n-nodes-zapzap/${rootPkg.version}`);
		assert.equal(h['user-agent'], `n8n-nodes-zapzap/${rootPkg.version}`);
		assert.equal(h['x-api-key'], 'KEY-123');
		assert.equal(h['x-api-secret'], 'SECRET-456');
	} finally { await srv.close(); }
});

test('sendText: path, body, number normalization, typing off', async () => {
	const srv = await startServer(() => ({ body: { id: 'm1' } }));
	try {
		const out = await run(makeContext({ baseUrl: srv.url, params: {
			resource: 'message', operation: 'sendText', instanceId: INST, number: '+55 (11) 99999-0001', text: 'Olá 😀 مرحبا 你好',
			textOptions: { typing: false, delay: 500, mentions: '' },
		} }));
		const hit = srv.hits[0];
		assert.equal(hit.method, 'POST');
		assert.equal(hit.url, `/${INST}/send/text`);
		assert.deepEqual(hit.body, { number: '5511999990001', text: 'Olá 😀 مرحبا 你好', delay: 500, digitando: false });
		assert.equal(out[0][0].json.id, 'm1');
	} finally { await srv.close(); }
});

test('sendMedia by URL, by binary, too large binary, bad URL scheme', async () => {
	const srv = await startServer(() => ({ body: { ok: 1 } }));
	try {
		await run(makeContext({ baseUrl: srv.url, params: { resource: 'message', operation: 'sendMedia', instanceId: INST, number: '5511999990001', type: 'document', mediaSource: 'url', file: 'https://example.com/a/report.pdf?x=1' } }));
		assert.equal(srv.hits[0].body.file, 'https://example.com/a/report.pdf?x=1');
		assert.equal(srv.hits[0].body.docName, 'report.pdf');

		const binary = { data: { meta: { mimeType: 'image/png', fileName: 'p.png' }, buffer: Buffer.from('abc') } };
		await run(makeContext({ baseUrl: srv.url, binary, params: { resource: 'message', operation: 'sendMedia', instanceId: INST, number: '5511999990001', type: 'image', mediaSource: 'binary', binaryPropertyName: 'data' } }));
		assert.equal(srv.hits[1].body.file, `data:image/png;base64,${Buffer.from('abc').toString('base64')}`);

		const big = { data: { meta: { mimeType: 'video/mp4' }, buffer: Buffer.alloc(2_000_000) } };
		await assert.rejects(run(makeContext({ baseUrl: srv.url, binary: big, params: { resource: 'message', operation: 'sendMedia', instanceId: INST, number: '5511999990001', type: 'video', mediaSource: 'binary', binaryPropertyName: 'data' } })), /too large/);
		await assert.rejects(run(makeContext({ baseUrl: srv.url, params: { resource: 'message', operation: 'sendMedia', instanceId: INST, number: '5511999990001', type: 'image', mediaSource: 'url', file: 'file:///etc/passwd' } })), /http:\/\/ or https/);
		assert.equal(srv.hits.length, 2);
	} finally { await srv.close(); }
});

test('interactive: poll, buttons, list and validation', async () => {
	const srv = await startServer(() => ({ body: {} }));
	try {
		const base = { resource: 'message', operation: 'sendInteractive', instanceId: INST, number: '5511999990001', interactiveText: 'Pick' };
		await run(makeContext({ baseUrl: srv.url, params: { ...base, interactiveType: 'poll', pollChoices: '["A","B"]', selectableCount: 1 } }));
		assert.equal(srv.hits[0].url, `/${INST}/send/poll`);
		assert.deepEqual(srv.hits[0].body.choices, ['A', 'B']);
		await run(makeContext({ baseUrl: srv.url, params: { ...base, interactiveType: 'buttons', buttonsJson: '[{"text":"Yes","id":"y"}]', buttonsOptions: { footer: 'f' } } }));
		assert.equal(srv.hits[1].body.footer, 'f');
		await run(makeContext({ baseUrl: srv.url, params: { ...base, interactiveType: 'list', listChoices: ['[S]', 'a|1|d'] } }));
		assert.deepEqual(srv.hits[2].body.choices, ['[S]', 'a|1|d']);
		await assert.rejects(run(makeContext({ baseUrl: srv.url, params: { ...base, interactiveType: 'poll', pollChoices: '["A"]' } })), /at least 2/);
		await assert.rejects(run(makeContext({ baseUrl: srv.url, params: { ...base, interactiveType: 'buttons', buttonsJson: '[1,2,3,4]' } })), /1 to 3/);
		await assert.rejects(run(makeContext({ baseUrl: srv.url, params: { ...base, interactiveType: 'poll', pollChoices: '[oops' } })), /not valid JSON/);
	} finally { await srv.close(); }
});

test('react, location, contact, groups, chat, account, custom call', async () => {
	const srv = await startServer(() => ({ body: [{ id: 1 }, { id: 2 }] }));
	try {
		const c = (params) => run(makeContext({ baseUrl: srv.url, params: { instanceId: INST, ...params } }));
		await c({ resource: 'message', operation: 'react', number: '5511999990001', id: '5511999990003:ABC', emoji: '' });
		assert.deepEqual(srv.hits.at(-1).body, { number: '5511999990001', id: '5511999990003:ABC', emoji: '' });
		await c({ resource: 'message', operation: 'sendLocation', number: '5511999990001', latitude: -23.5, longitude: -46.6, locationOptions: { name: 'HQ' } });
		assert.equal(srv.hits.at(-1).body.name, 'HQ');
		await c({ resource: 'message', operation: 'sendContact', number: '5511999990001', fullName: 'Ana', phoneNumber: '5511999990002' });
		assert.equal(srv.hits.at(-1).url, `/${INST}/send/contact`);
		const groups = await c({ resource: 'group', operation: 'groupList', getParticipants: false });
		assert.equal(groups[0].length, 2, 'array response becomes one item per element');
		await c({ resource: 'group', operation: 'groupCreate', groupName: 'Team', participants: '+55 11 99999-0001, 5511999990002' });
		assert.deepEqual(srv.hits.at(-1).body, { name: 'Team', participants: ['5511999990001', '5511999990002'] });
		await c({ resource: 'chat', operation: 'markRead', number: '5511999990001' });
		assert.equal(srv.hits.at(-1).url, `/${INST}/chat/read`);
		await c({ resource: 'account', operation: 'accountGet' });
		assert.equal(srv.hits.at(-1).url, '/account');
		await c({ resource: 'custom', operation: 'customRequest', method: 'POST', path: `/${INST}/chat/find`, customBody: '{"limit":5}', customQuery: '{}' });
		assert.deepEqual(srv.hits.at(-1).body, { limit: 5 });
		assert.equal(srv.hits.at(-1).headers['x-zapzap-client'], `n8n-nodes-zapzap/${rootPkg.version}`);
		await assert.rejects(c({ resource: 'custom', operation: 'customRequest', method: 'GET', path: 'https://evil.example/x', customQuery: '{}' }), /Path must start/);
	} finally { await srv.close(); }
});

test('instance: create uppercases name, list strips api_key, QR becomes binary', async () => {
	const png = Buffer.from('PNGDATA').toString('base64');
	const srv = await startServer((hit) => {
		if (hit.url === '/instances' && hit.method === 'GET') return { body: [{ id: 'a', name: 'X', api_key: 'LEAK', status: 'CONNECTED' }] };
		if (hit.url.endsWith('/qrcode')) return { body: { instance: { qrcode: `data:image/png;base64,${png}` } } };
		return { status: 201, body: { instance: { id: 'new' } } };
	});
	try {
		const c = (params) => run(makeContext({ baseUrl: srv.url, params }));
		await c({ resource: 'instance', operation: 'create', name: 'my-shop_1', createOptions: { metadata: '{"clientId":"1"}' } });
		assert.deepEqual(srv.hits[0].body, { name: 'MY-SHOP_1', metadata: { clientId: '1' } });
		await assert.rejects(c({ resource: 'instance', operation: 'create', name: 'bad name!' }), /letters, numbers/);
		const list = await c({ resource: 'instance', operation: 'list' });
		assert.equal(list[0][0].json.api_key, undefined);
		const qr = await c({ resource: 'instance', operation: 'getQrCode', instanceId: 'a' });
		assert.equal(qr[0][0].binary.qrcode.mimeType, 'image/png');
	} finally { await srv.close(); }
});

test('429: retries honoring Retry-After, then gives up with a clear message', async () => {
	const sleeps = fastRetries();
	let n = 0;
	const srv = await startServer(() => (++n <= 2 ? { status: 429, headers: { 'retry-after': '2' }, body: { error: 'TOO_MANY_REQUESTS' } } : { body: { ok: 1 } }));
	try {
		await run(makeContext({ baseUrl: srv.url, params: { resource: 'message', operation: 'sendText', instanceId: INST, number: '5511999990001', text: 'x' } }));
		assert.equal(srv.hits.length, 3);
		assert.deepEqual(sleeps, [2000, 2000]);
		sleeps.length = 0; n = -100;
		await assert.rejects(run(makeContext({ baseUrl: srv.url, params: { resource: 'message', operation: 'sendText', instanceId: INST, number: '5511999990001', text: 'x' } })), /Rate limit reached/);
		assert.equal(sleeps.length, client.runtime.maxRetries);
	} finally { await srv.close(); }
});

test('Retry-After as HTTP date and capped wait', () => {
	assert.equal(client.parseRetryAfter('3'), 3000);
	assert.equal(client.parseRetryAfter(new Date(10_000).toUTCString(), 4000), 6000);
	assert.equal(client.parseRetryAfter('garbage'), null);
});

test('5xx on POST is never retried (no duplicate messages); GET is retried', async () => {
	const sleeps = fastRetries();
	let n = 0;
	const srv = await startServer((hit) => (hit.method === 'POST' ? { status: 503, body: { error: 'x' } } : ++n < 3 ? { status: 503, body: {} } : { body: [] }));
	try {
		await assert.rejects(run(makeContext({ baseUrl: srv.url, params: { resource: 'message', operation: 'sendText', instanceId: INST, number: '5511999990001', text: 'x' } })), /temporary error/);
		assert.equal(srv.hits.length, 1);
		await run(makeContext({ baseUrl: srv.url, params: { resource: 'instance', operation: 'list' } }));
		assert.equal(srv.hits.length, 4);
		assert.ok(sleeps.length >= 2);
	} finally { await srv.close(); }
});

test('timeout on POST is not retried and gives a network message', async () => {
	fastRetries();
	client.runtime.timeoutMs = 150;
	const srv = await startServer(async () => { await new Promise((r) => setTimeout(r, 600)); return { body: {} }; });
	try {
		await assert.rejects(run(makeContext({ baseUrl: srv.url, lang: 'es', params: { resource: 'message', operation: 'sendText', instanceId: INST, number: '5511999990001', text: 'x' } })), /No se pudo conectar con ZapZap/);
		assert.equal(srv.hits.length, 1);
	} finally { client.runtime.timeoutMs = 60000; await srv.close(); }
});

test('redirect to another host is never followed and keys never reach it', async () => {
	const other = await startServer(() => ({ body: { stolen: true } }));
	const srv = await startServer(() => ({ status: 302, headers: { location: `${other.url}/steal` }, body: {} }));
	try {
		await assert.rejects(run(makeContext({ baseUrl: srv.url, params: { resource: 'account', operation: 'accountGet' } })), /redirect/i);
		assert.equal(other.hits.length, 0);
	} finally { await srv.close(); await other.close(); }
});

test('invalid JSON, empty and huge unexpected bodies do not crash', async () => {
	const srv = await startServer((hit) => (hit.url === '/a' ? { body: 'not json at all' } : hit.url === '/b' ? { status: 200, body: '' } : { body: { data: 'x'.repeat(500000) } }));
	try {
		const c = (path) => run(makeContext({ baseUrl: srv.url, params: { resource: 'custom', operation: 'customRequest', method: 'GET', path, customQuery: '{}' } }));
		assert.equal((await c('/a'))[0][0].json.data, 'not json at all');
		assert.equal((await c('/b'))[0][0].json.success, true);
		assert.equal((await c('/c'))[0][0].json.data.length, 500000);
	} finally { await srv.close(); }
});

test('continueOnFail returns an error item per failing input and keeps going', async () => {
	let n = 0;
	const srv = await startServer(() => (++n === 2 ? { status: 400, body: { message: 'invalid number' } } : { body: { ok: n } }));
	try {
		const items = [{ json: {} }, { json: {} }, { json: {} }];
		const out = await run(makeContext({ baseUrl: srv.url, items, continueOnFail: true, params: { resource: 'message', operation: 'sendText', instanceId: INST, number: '5511999990001', text: 'x' } }));
		assert.equal(out[0].length, 3);
		assert.match(out[0][1].json.error, /invalid|not on WhatsApp/);
		assert.deepEqual(out[0].map((o) => o.pairedItem.item), [0, 1, 2]);
		await assert.rejects(run(makeContext({ baseUrl: srv.url, items: [{ json: {} }], continueOnFail: false, params: { resource: 'message', operation: 'sendText', instanceId: '', number: '5511999990001', text: 'x' } })), /Pick an instance/);
	} finally { await srv.close(); }
});

test('human error messages in en, pt and es; the key never appears in errors', async () => {
	const cases = [
		[401, { error: 'UNAUTHORIZED' }, /Credenciais|inválidas/, 'pt'],
		[402, {}, /Saldo insuficiente/, 'pt'],
		[400, { message: 'Instância desconectada' }, /não está conectada/, 'pt'],
		[400, { message: 'Número inválido' }, /parece inválido/, 'pt'],
		[413, {}, /demasiado grande/, 'es'],
		[404, {}, /Not found/, 'en'],
		[500, {}, /temporary error/, 'en'],
	];
	for (const [status, body, re, lang] of cases) {
		const srv = await startServer(() => ({ status, body: { ...body, echo: 'x-api-key: KEY-123' } }));
		try {
			await assert.rejects(
				run(makeContext({ baseUrl: srv.url, lang, params: { resource: 'account', operation: 'accountGet' } })),
				(e) => {
					assert.match(e.message, re, `status ${status}`);
					assert.ok(!JSON.stringify([e.message, e.description]).includes('KEY-123'), 'key leaked');
					return true;
				},
			);
		} finally { await srv.close(); }
	}
});

test('base URL must be https (http allowed for localhost only)', async () => {
	await assert.rejects(run(makeContext({ baseUrl: 'http://api.example.com/api/v1', params: { resource: 'account', operation: 'accountGet' } })), /must use https/);
	await assert.rejects(run(makeContext({ baseUrl: 'https://user:pw@api.example.com', params: { resource: 'account', operation: 'accountGet' } })), /credentials/);
});

test('number normalization worldwide, Brazil 9th digit only for Brazil', () => {
	const n = client.normalizeNumber;
	assert.equal(n('+1 (415) 555-0100'), '14155550100');
	assert.equal(n('+44 7700 900123'), '447700900123');
	assert.equal(n('+52 55 1234 5678'), '525512345678');
	assert.equal(n('+34 612 345 678'), '34612345678');
	assert.equal(n('0034 612 345 678'), '34612345678');
	assert.equal(n('5511999990001'), '5511999990001');
	assert.equal(n('551188887777'), '5511988887777', 'BR mobile missing 9th digit');
	assert.equal(n('551133334444'), '551133334444', 'BR landline untouched');
	assert.equal(n('11 99999-0001', '55'), '5511999990001');
	assert.equal(n('(11) 8888-7777', '55'), '5511988887777');
	assert.equal(n('34 12 34 56 78 90', ''), '341234567890', 'no default code: unchanged digits');
	assert.equal(n('120363000000000000@g.us'), '120363000000000000@g.us');
});

test('a Unicode text round-trips unchanged', async () => {
	const srv = await startServer((hit) => ({ body: { echo: hit.body.text } }));
	try {
		for (const t of ['مرحبا بالعالم', '你好，世界', '👨‍👩‍👧‍👦 🏳️‍🌈', 'עברית ‏‎mixed‎ RTL']) {
			const out = await run(makeContext({ baseUrl: srv.url, params: { resource: 'message', operation: 'sendText', instanceId: INST, number: '5511999990001', text: t } }));
			assert.equal(out[0][0].json.echo, t);
		}
	} finally { await srv.close(); }
});
