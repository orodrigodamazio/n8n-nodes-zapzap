import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';
import { clientHeaders } from '../nodes/shared/client';

export class ZapZapApi implements ICredentialType {
	name = 'zapZapApi';

	displayName = 'ZapZap API';

	icon = 'file:zapzap.svg' as const;

	documentationUrl = 'https://zapzapapi.com/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Step 1 of 2. Open app.zapzapapi.com, go to Settings > API and copy the API Key.',
		},
		{
			displayName: 'API Secret',
			name: 'apiSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Step 2 of 2. On the same page, copy the API Secret.',
		},
		{
			displayName: 'Default Country Code',
			name: 'defaultCountryCode',
			type: 'string',
			default: '',
			placeholder: '55',
			description:
				'Optional. Added to numbers written without a country code (e.g. 11 99999-9999 becomes 5511999999999 when set to 55). Leave empty to always require the full number.',
		},
		{
			displayName: 'Language of Error Messages',
			name: 'language',
			type: 'options',
			default: 'en',
			options: [
				{ name: 'English', value: 'en' },
				{ name: 'Español', value: 'es' },
				{ name: 'Português', value: 'pt' },
			],
			description: 'Language used in the messages that explain what went wrong',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.zapzapapi.com/api/v1',
			description: 'Leave as is. Change it only if you run your own ZapZap installation (must start with https).',
		},
	];

	// Injects the authentication headers into every request made with this credential.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
				'x-api-secret': '={{$credentials.apiSecret}}',
				// Node name and version, for support and usage statistics. Nothing else is sent.
				...clientHeaders(),
			},
		},
	};

	// Runs when the credential is saved. The keys are added by `authenticate` above.
	// Redirects are never followed, so the keys cannot travel to another host.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/account',
			method: 'GET',
			disableFollowRedirect: true,
			timeout: 20000,
		},
	};
}
