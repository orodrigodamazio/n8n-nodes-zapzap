'use strict';
// Test harness: a fake ZapZap API (real local HTTP server) and a minimal n8n execution context.
const http = require('node:http');
const { ZapZapApi } = require('../dist/credentials/ZapZapApi.credentials.js');
const client = require('../dist/nodes/shared/client.js');

/** Starts a fake server. `handler(req, body, state)` returns {status, body, headers} or calls res itself via raw. */
async function startServer(handler) {
	const state = { hits: [], onRaw: null };
	const server = http.createServer((req, res) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', async () => {
			const raw = Buffer.concat(chunks).toString('utf8');
			let body;
			try {
				body = raw ? JSON.parse(raw) : undefined;
			} catch {
				body = raw;
			}
			const hit = { method: req.method, url: req.url, headers: req.headers, body, raw };
			state.hits.push(hit);
			const out = await handler(hit, state, res);
			if (out === 'raw') return;
			const o = out || { status: 200, body: {} };
			const payload = typeof o.body === 'string' ? o.body : JSON.stringify(o.body ?? {});
			res.writeHead(o.status ?? 200, { 'content-type': 'application/json', ...(o.headers || {}) });
			res.end(payload);
		});
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const port = server.address().port;
	return {
		url: `http://127.0.0.1:${port}`,
		state,
		hits: state.hits,
		close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }),
	};
}

function resolveCreds(template, creds) {
	return String(template).replace(/=?\{\{\$credentials\.(\w+)\}\}/g, (_, k) => creds[k]);
}

/**
 * Minimal execution context. Mimics httpRequestWithAuthentication: applies the headers the REAL
 * credential class declares in `authenticate`, honors timeout, returnFullResponse and
 * ignoreHttpStatusErrors, and never follows redirects when disableFollowRedirect is set.
 */
function makeContext({ baseUrl, params = {}, items = [{ json: {} }], creds = {}, continueOnFail = false, staticData = {}, binary = {}, lang }) {
	const credentials = { apiKey: 'KEY-123', apiSecret: 'SECRET-456', baseUrl, language: lang || 'en', defaultCountryCode: '', ...creds };
	const auth = new ZapZapApi().authenticate.properties.headers;
	const node = { name: 'ZapZap', type: 'n8n-nodes-zapzap.zapZap', typeVersion: 1, parameters: {}, id: 'x', position: [0, 0] };
	const ctx = {
		getNode: () => node,
		getCredentials: async () => credentials,
		getInputData: () => items,
		continueOnFail: () => continueOnFail,
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		getWorkflowStaticData: () => staticData,
		getNodeWebhookUrl: () => params.__webhookUrl || 'https://n8n.example.com/webhook/abc/webhook',
		helpers: {
			async httpRequestWithAuthentication(_cred, opts) {
				const headers = { ...(opts.headers || {}) };
				for (const [k, v] of Object.entries(auth)) headers[k] = resolveCreds(v, credentials);
				if (opts.body !== undefined) headers['content-type'] = 'application/json';
				let url = opts.url;
				if (opts.qs) url += '?' + new URLSearchParams(opts.qs).toString();
				let res;
				try {
					res = await fetch(url, {
						method: opts.method,
						headers,
						body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
						redirect: opts.disableFollowRedirect ? 'manual' : 'follow',
						signal: AbortSignal.timeout(opts.timeout || 60000),
					});
				} catch (e) {
					const err = new Error(e.name === 'TimeoutError' ? 'timeout of ms exceeded' : `request failed: ${e.cause?.code || e.message}`);
					err.code = e.name === 'TimeoutError' ? 'ETIMEDOUT' : e.cause?.code || 'ECONNRESET';
					throw err;
				}
				const text = await res.text();
				let body = text;
				try { body = JSON.parse(text); } catch { /* keep text */ }
				const full = { statusCode: res.status, body, headers: Object.fromEntries(res.headers.entries()) };
				if (!opts.ignoreHttpStatusErrors && res.status >= 400) { const e = new Error(String(res.status)); e.statusCode = res.status; throw e; }
				return opts.returnFullResponse ? full : body;
			},
			assertBinaryData: (_i, prop) => binary[prop].meta,
			getBinaryDataBuffer: async (_i, prop) => binary[prop].buffer,
			prepareBinaryData: async (buffer, fileName, mimeType) => ({ data: buffer.toString('base64'), fileName, mimeType }),
			async request(opts) {
				const headers = { ...(opts.headers || {}) };
				const res = await fetch(opts.uri, { method: opts.method, headers, redirect: 'manual' });
				const text = await res.text();
				let body = text;
				try { body = JSON.parse(text); } catch { /* keep */ }
				return { statusCode: res.status, body };
			},
		},
	};
	return ctx;
}

function fastRetries() {
	const sleeps = [];
	client.runtime.sleep = async (ms) => { sleeps.push(ms); };
	return sleeps;
}

module.exports = { startServer, makeContext, fastRetries, client };
