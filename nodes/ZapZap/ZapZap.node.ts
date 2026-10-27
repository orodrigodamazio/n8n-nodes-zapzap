import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	getLang,
	loadInstanceOptions,
	msg,
	validateHttpUrl,
	normalizeNumber,
	parseJsonParam,
	requireValue,
	zapZapRequest,
} from '../shared/client';

/** Largest file sent as base64 in the body. The public API accepts about 2 MB of JSON. */
export const MAX_BINARY_BYTES = 1_400_000;

const MESSAGE_RESOURCES = ['message', 'group', 'chat'];

export class ZapZap implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ZapZap',
		name: 'zapZap',
		icon: 'file:zapzap.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send WhatsApp messages, media, polls and buttons, and manage instances through the ZapZap API',
		defaults: {
			name: 'ZapZap',
		},
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'zapZapApi',
				required: true,
			},
		],
		properties: [
			// ========================= RESOURCE =========================
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Chat', value: 'chat' },
					{ name: 'Custom API Call', value: 'custom' },
					{ name: 'Group', value: 'group' },
					{ name: 'Instance', value: 'instance' },
					{ name: 'Message', value: 'message' },
				],
				default: 'message',
			},

			// ========================= MESSAGE: OPERATIONS =========================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['message'] } },
				options: [
					{
						name: 'React',
						value: 'react',
						action: 'React to a message',
						description: 'React with an emoji to an existing message',
					},
					{
						name: 'Send Contact',
						value: 'sendContact',
						action: 'Send a contact card',
						description: 'Send a contact card (vCard)',
					},
					{
						name: 'Send Interactive',
						value: 'sendInteractive',
						action: 'Send a poll buttons or list',
						description: 'Send a poll, buttons or an option list',
					},
					{
						name: 'Send Location',
						value: 'sendLocation',
						action: 'Send a location',
						description: 'Send a map location',
					},
					{
						name: 'Send Media',
						value: 'sendMedia',
						action: 'Send an image video audio or document',
						description: 'Send an image, video, audio, document or sticker from a URL or from binary data',
					},
					{
						name: 'Send Text',
						value: 'sendText',
						action: 'Send a text message',
						description: 'Send a plain text message to a WhatsApp number or group',
					},
				],
				default: 'sendText',
			},

			// ========================= INSTANCE: OPERATIONS =========================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['instance'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create an instance',
						description: 'Create a new WhatsApp instance (charged from your balance)',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get an instance',
						description: 'Get the details of one instance',
					},
					{
						name: 'Get Many',
						value: 'list',
						action: 'List instances',
						description: 'List every instance in your account',
					},
					{
						name: 'Get QR Code',
						value: 'getQrCode',
						action: 'Get the QR code',
						description: 'Get the QR code to connect WhatsApp to the instance',
					},
					{
						name: 'Get Status',
						value: 'getStatus',
						action: 'Get connection status',
						description: 'Get the WhatsApp connection status of the instance',
					},
				],
				default: 'list',
			},

			// ========================= GROUP / CHAT / ACCOUNT: OPERATIONS =========================
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['group'] } },
				options: [
					{
						name: 'Create',
						value: 'groupCreate',
						action: 'Create a group',
						description: 'Create a WhatsApp group with participants',
					},
					{
						name: 'Get',
						value: 'groupInfo',
						action: 'Get group info',
						description: 'Get the details of a group',
					},
					{
						name: 'Get Many',
						value: 'groupList',
						action: 'List groups',
						description: 'List the groups of the instance',
					},
				],
				default: 'groupList',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['chat'] } },
				options: [
					{
						name: 'Mark as Read',
						value: 'markRead',
						action: 'Mark a chat as read',
						description: 'Mark the conversation as read',
					},
				],
				default: 'markRead',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['account'] } },
				options: [
					{
						name: 'Get',
						value: 'accountGet',
						action: 'Get account details',
						description: 'Get your account details and balance',
					},
				],
				default: 'accountGet',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['custom'] } },
				options: [
					{
						name: 'Make a Request',
						value: 'customRequest',
						action: 'Make a custom API request',
						description: 'Call any ZapZap API endpoint that has no dedicated operation, already authenticated',
					},
				],
				default: 'customRequest',
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'options',
				default: 'GET',
				options: [
					{ name: 'DELETE', value: 'DELETE' },
					{ name: 'GET', value: 'GET' },
					{ name: 'POST', value: 'POST' },
					{ name: 'PUT', value: 'PUT' },
				],
				displayOptions: { show: { resource: ['custom'] } },
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				required: true,
				default: '',
				placeholder: '/account',
				description:
					'Endpoint path after the base URL, starting with "/". Use the instance ID in the path when needed. See the API reference at zapzapapi.com/docs.',
				displayOptions: { show: { resource: ['custom'] } },
			},
			{
				displayName: 'Body (JSON)',
				name: 'customBody',
				type: 'json',
				default: '{}',
				description: 'JSON body for POST and PUT. Example: {"number":"5511999990001","text":"Hi"}.',
				displayOptions: { show: { resource: ['custom'], method: ['POST', 'PUT'] } },
			},
			{
				displayName: 'Query (JSON)',
				name: 'customQuery',
				type: 'json',
				default: '{}',
				description: 'Query string parameters as JSON. Example: {"limit":10}.',
				displayOptions: { show: { resource: ['custom'] } },
			},

			// ========================= INSTANCE ID =========================
			{
				displayName: 'Instance Name or ID',
				name: 'instanceId',
				type: 'options',
				required: true,
				default: '',
				typeOptions: { loadOptionsMethod: 'getInstances' },
				description:
					'The connected WhatsApp number to use (called an instance). If the list is empty, create and connect one in app.zapzapapi.com first. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: { show: { resource: MESSAGE_RESOURCES } },
			},
			{
				displayName: 'Instance Name or ID',
				name: 'instanceId',
				type: 'options',
				required: true,
				default: '',
				typeOptions: { loadOptionsMethod: 'getInstances' },
				description:
					'The connected WhatsApp number to use (called an instance). If the list is empty, create and connect one in app.zapzapapi.com first. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: {
					show: { resource: ['instance'], operation: ['get', 'getStatus', 'getQrCode'] },
				},
			},

			// ========================= NUMBER =========================
			{
				displayName: 'Number',
				name: 'number',
				type: 'string',
				required: true,
				default: '',
				placeholder: '5511999990001',
				description:
					'Recipient in international format: country code + area code + number (e.g. 5511999990001). Spaces, plus and dashes are removed for you. For groups, use the group ID (ending in @g.us).',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendText', 'sendMedia', 'sendInteractive', 'react', 'sendLocation', 'sendContact'],
					},
				},
			},
			{
				displayName: 'Number',
				name: 'number',
				type: 'string',
				required: true,
				default: '',
				placeholder: '5511999990001',
				description: 'Chat number (international format) or chat ID',
				displayOptions: { show: { resource: ['chat'], operation: ['markRead'] } },
			},

			// ========================= SEND TEXT =========================
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 3 },
				required: true,
				default: '',
				placeholder: 'Hi! How are you?',
				description: 'Content of the text message',
				displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
			},
			{
				displayName: 'Options',
				name: 'textOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
				options: [
					{
						displayName: 'Delay (Milliseconds)',
						name: 'delay',
						type: 'number',
						default: 0,
						description: 'Wait this long before sending. 1000 means 1 second.',
					},
					{
						displayName: 'Mentions',
						name: 'mentions',
						type: 'string',
						default: '',
						placeholder: 'all',
						description:
							'Groups only. Use "all" to mention every member, or a comma-separated list of numbers.',
					},
					{
						displayName: 'Reply to Message ID',
						name: 'replyid',
						type: 'string',
						default: '',
						description: 'ID of the message to reply to (quote)',
					},
					{
						displayName: 'Show Typing Indicator',
						name: 'typing',
						type: 'boolean',
						default: true,
						description:
							'Whether to show "typing..." before sending, proportional to the text length. On by default in ZapZap; turn off to send faster.',
					},
				],
			},

			// ========================= SEND MEDIA =========================
			{
				displayName: 'Media Type',
				name: 'type',
				type: 'options',
				default: 'image',
				description: 'Type of media to send',
				displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
				options: [
					{ name: 'Audio File', value: 'audio', description: 'Music or a recording sent as a file (MP3, OGG, WAV)' },
					{ name: 'Document', value: 'document', description: 'Document (PDF, DOCX, XLSX and similar)' },
					{ name: 'Image', value: 'image', description: 'Image (JPG, PNG, GIF, WebP)' },
					{
						name: 'Round Video',
						value: 'ptv',
						description: 'A short video shown inside a circle. Ignores the caption.',
					},
					{ name: 'Sticker', value: 'sticker', description: 'Sticker (WebP)' },
					{ name: 'Video', value: 'video', description: 'Video (MP4, AVI, MOV)' },
					{
						name: 'Voice Message',
						value: 'ptt',
						description: 'Appears as a recorded voice message, with the microphone icon. Best for talking to a person.',
					},
					{
						name: 'Voice Message (OGG/Opus File)',
						value: 'myaudio',
						description: 'Advanced. A voice message made from an OGG/Opus file. Most people should use Voice Message',
					},
				],
			},
			{
				displayName: 'Source',
				name: 'mediaSource',
				type: 'options',
				default: 'url',
				description: 'Where the file comes from',
				displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
				options: [
					{ name: 'URL', value: 'url', description: 'Public URL of the file (up to about 190 MB)' },
					{
						name: 'Binary Data',
						value: 'binary',
						description: 'File from a previous node, such as HTTP Request or Read Binary File (up to about 1 MB)',
					},
				],
			},
			{
				displayName: 'File URL',
				name: 'file',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/file.jpg',
				description:
					'Public URL of the file. Size limit per URL: around 190 MB for image, video and audio, and around 500 MB for documents.',
				displayOptions: { show: { resource: ['message'], operation: ['sendMedia'], mediaSource: ['url'] } },
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				default: 'data',
				description: 'Name of the binary field that holds the file. For files larger than 1 MB use a URL instead.',
				displayOptions: { show: { resource: ['message'], operation: ['sendMedia'], mediaSource: ['binary'] } },
			},
			{
				displayName: 'Options',
				name: 'mediaOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['message'], operation: ['sendMedia'] } },
				options: [
					{
						displayName: 'Caption',
						name: 'text',
						type: 'string',
						typeOptions: { rows: 2 },
						default: '',
						description: 'Caption (image and video only). Ignored for video notes.',
					},
					{
						displayName: 'Delay (Milliseconds)',
						name: 'delay',
						type: 'number',
						default: 0,
						description: 'Wait this long before sending. 1000 means 1 second.',
					},
					{
						displayName: 'Document Name',
						name: 'docName',
						type: 'string',
						default: '',
						placeholder: 'file.pdf',
						description:
							'File name shown in the chat. Needed for documents; filled from the binary file name when empty.',
					},
					{
						displayName: 'Mentions',
						name: 'mentions',
						type: 'string',
						default: '',
						placeholder: 'all',
						description: 'Groups only. Use "all" or a comma-separated list of numbers.',
					},
					{
						displayName: 'Show Typing Indicator',
						name: 'typing',
						type: 'boolean',
						default: true,
						description: 'Whether to show "typing..." before sending. Turn off to send faster.',
					},
				],
			},

			// ========================= SEND INTERACTIVE =========================
			{
				displayName: 'Interactive Type',
				name: 'interactiveType',
				type: 'options',
				default: 'poll',
				description: 'Type of interactive message',
				displayOptions: { show: { resource: ['message'], operation: ['sendInteractive'] } },
				options: [
					{ name: 'Buttons', value: 'buttons', description: 'Up to 3 clickable buttons' },
					{ name: 'List', value: 'list', description: 'Menu list with sections and items' },
					{ name: 'Poll', value: 'poll', description: 'Native WhatsApp poll' },
				],
			},
			{
				displayName: 'Text',
				name: 'interactiveText',
				type: 'string',
				typeOptions: { rows: 2 },
				required: true,
				default: '',
				placeholder: 'Choose an option:',
				description: 'Main text (the poll question, or the body of the buttons or list)',
				displayOptions: { show: { resource: ['message'], operation: ['sendInteractive'] } },
			},
			{
				displayName: 'Choices (JSON Array)',
				name: 'pollChoices',
				type: 'json',
				required: true,
				default: '["Option 1", "Option 2"]',
				description: 'One option per item, at least 2. Example: ["Great", "Good", "Bad"].',
				displayOptions: {
					show: { resource: ['message'], operation: ['sendInteractive'], interactiveType: ['poll'] },
				},
			},
			{
				displayName: 'Selectable Count',
				name: 'selectableCount',
				type: 'number',
				default: 1,
				description: 'How many options each person can pick (0 means unlimited)',
				displayOptions: {
					show: { resource: ['message'], operation: ['sendInteractive'], interactiveType: ['poll'] },
				},
			},
			{
				displayName: 'Buttons (JSON Array)',
				name: 'buttonsJson',
				type: 'json',
				required: true,
				default: '[{"text":"Yes","id":"yes"},{"text":"Our site","url":"https://example.com"}]',
				// JSON examples below must keep lowercase keys.
				// eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-id, n8n-nodes-base/node-param-description-miscased-url
				description: 'Up to 3 buttons. Quick reply: {"text":"Yes","id":"yes"}. Link: {"text":"Our site","url":"https://example.com"}. Keep the example shape and change the values.',
				displayOptions: {
					show: { resource: ['message'], operation: ['sendInteractive'], interactiveType: ['buttons'] },
				},
			},
			{
				displayName: 'Options',
				name: 'buttonsOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: { resource: ['message'], operation: ['sendInteractive'], interactiveType: ['buttons'] },
				},
				options: [
					{ displayName: 'Footer', name: 'footer', type: 'string', default: '', description: 'Footer text' },
					{
						displayName: 'Image URL',
						name: 'image',
						type: 'string',
						default: '',
						placeholder: 'https://example.com/banner.jpg',
						description: 'Image shown above the buttons',
					},
				],
			},
			{
				displayName: 'Choices (JSON Array)',
				name: 'listChoices',
				type: 'json',
				required: true,
				default: '["[Products]", "T-shirt|p1|$ 50", "Pants|p2|$ 120"]',
				description:
						'Example: ["[Products]", "T-shirt|p1|$ 50"]. A name in [brackets] starts a section. Each item is Name|code|description.',
				displayOptions: {
					show: { resource: ['message'], operation: ['sendInteractive'], interactiveType: ['list'] },
				},
			},
			{
				displayName: 'Options',
				name: 'listOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: { resource: ['message'], operation: ['sendInteractive'], interactiveType: ['list'] },
				},
				options: [
					{
						displayName: 'Footer Text',
						name: 'footerText',
						type: 'string',
						default: '',
						description: 'Small text shown below the list',
					},
					{
						displayName: 'List Button Text',
						name: 'listButton',
						type: 'string',
						default: '',
						placeholder: 'View options',
						description: 'Text of the button that opens the list',
					},
				],
			},

			// ========================= SEND LOCATION / CONTACT =========================
			{
				displayName: 'Latitude',
				name: 'latitude',
				type: 'number',
				typeOptions: { numberPrecision: 6 },
				required: true,
				default: 0,
				description: 'Latitude of the location',
				displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
			},
			{
				displayName: 'Longitude',
				name: 'longitude',
				type: 'number',
				typeOptions: { numberPrecision: 6 },
				required: true,
				default: 0,
				description: 'Longitude of the location',
				displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
			},
			{
				displayName: 'Options',
				name: 'locationOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
				options: [
					{ displayName: 'Address', name: 'address', type: 'string', default: '', description: 'Street address' },
					{ displayName: 'Place Name', name: 'name', type: 'string', default: '', description: 'Name of the place' },
				],
			},
			{
				displayName: 'Full Name',
				name: 'fullName',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Maria Silva',
				description: 'Name on the contact card',
				displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
			},
			{
				displayName: 'Phone Numbers',
				name: 'phoneNumber',
				type: 'string',
				required: true,
				default: '',
				placeholder: '5511999990002',
				description: 'One or more phone numbers, separated by commas',
				displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
			},
			{
				displayName: 'Options',
				name: 'contactOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
				options: [
					{ displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '' },
					{ displayName: 'Organization', name: 'organization', type: 'string', default: '' },
				],
			},

			// ========================= REACT =========================
			{
				displayName: 'Message ID',
				name: 'id',
				type: 'string',
				required: true,
				default: '',
				placeholder: '5511999990003:2A6E2F02CE4125FDBA1B',
				description: 'Message ID as OWNER:MESSAGE (e.g. 5511999990003:2A6E2F02CE4125FDBA1B). Use the messageId from the ZapZap Trigger.',
				displayOptions: { show: { resource: ['message'], operation: ['react'] } },
			},
			{
				displayName: 'Emoji',
				name: 'emoji',
				type: 'string',
				default: '👍',
				description: 'Reaction emoji. Leave empty to remove the reaction.',
				displayOptions: { show: { resource: ['message'], operation: ['react'] } },
			},

			// ========================= INSTANCE CREATE =========================
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'MY-INSTANCE',
				description: 'Instance name: letters, numbers, _ and - only. It is converted to uppercase.',
				displayOptions: { show: { resource: ['instance'], operation: ['create'] } },
			},
			{
				displayName: 'Options',
				name: 'createOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['instance'], operation: ['create'] } },
				options: [
					{
						displayName: 'Metadata (JSON)',
						name: 'metadata',
						type: 'json',
						default: '{}',
						description:
							'Free-form data to link the instance to your system. Example: {"clientId":"123"}. It is returned on webhook events.',
					},
					{
						displayName: 'System Name',
						name: 'systemName',
						type: 'string',
						default: '',
						placeholder: 'My App',
						description: 'System name shown on WhatsApp',
					},
				],
			},

			// ========================= GROUP =========================
			{
				displayName: 'Include Participants',
				name: 'getParticipants',
				type: 'boolean',
				default: false,
				description: 'Whether to include the participants of each group',
				displayOptions: { show: { resource: ['group'], operation: ['groupList'] } },
			},
			{
				displayName: 'Group ID',
				name: 'groupjid',
				type: 'string',
				required: true,
				default: '',
				placeholder: '120363000000000000@g.us',
				description: 'Group ID, ending in @g.us. Run Group > Get Many to see the group IDs.',
				displayOptions: { show: { resource: ['group'], operation: ['groupInfo'] } },
			},
			{
				displayName: 'Include Invite Link',
				name: 'getInviteLink',
				type: 'boolean',
				default: false,
				description: 'Whether to include the invite link',
				displayOptions: { show: { resource: ['group'], operation: ['groupInfo'] } },
			},
			{
				displayName: 'Group Name',
				name: 'groupName',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'My Team',
				displayOptions: { show: { resource: ['group'], operation: ['groupCreate'] } },
			},
			{
				displayName: 'Participants',
				name: 'participants',
				type: 'string',
				required: true,
				default: '',
				placeholder: '5511999990001, 5511999990002',
				description: 'Numbers with country code, separated by commas',
				displayOptions: { show: { resource: ['group'], operation: ['groupCreate'] } },
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const response = await runOperation(this, resource, operation, i);
				const binary = await extractQrBinary(this, response, resource, operation);
				for (const json of toItems(response)) {
					const entry: INodeExecutionData = { json, pairedItem: { item: i } };
					if (binary) entry.binary = binary;
					out.push(entry);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({
						json: { error: (error as Error).message, ...describe(error) },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeOperationError || (error as { context?: unknown }).context) {
					(error as { context: IDataObject }).context = {
						...((error as { context?: IDataObject }).context ?? {}),
						itemIndex: i,
					};
				}
				throw error;
			}
		}
		return [out];
	}
}

function describe(error: unknown): IDataObject {
	const e = error as { description?: string; httpCode?: string };
	const d: IDataObject = {};
	if (e.description) d.description = e.description;
	if (e.httpCode) d.statusCode = Number(e.httpCode);
	return d;
}

/** Arrays become one item per element; the account API key never leaks into the output. */
function toItems(response: unknown): IDataObject[] {
	const clean = (o: unknown): IDataObject => {
		if (o && typeof o === 'object' && !Array.isArray(o)) {
			const copy = { ...(o as IDataObject) };
			delete copy.api_key;
			delete copy.api_secret;
			return copy;
		}
		return { data: o as never };
	};
	if (Array.isArray(response)) return response.map(clean);
	if (response === undefined || response === null || response === '') return [{ success: true }];
	return [clean(response)];
}

function findQrDataUri(value: unknown, depth = 0): string | undefined {
	if (depth > 4 || value === null || value === undefined) return undefined;
	if (typeof value === 'string') return /^data:image\/[a-z]+;base64,/i.test(value) ? value : undefined;
	if (typeof value === 'object') {
		for (const v of Object.values(value as IDataObject)) {
			const found = findQrDataUri(v, depth + 1);
			if (found) return found;
		}
	}
	return undefined;
}

async function extractQrBinary(
	ctx: IExecuteFunctions,
	response: unknown,
	resource: string,
	operation: string,
): Promise<INodeExecutionData['binary'] | undefined> {
	if (resource !== 'instance' || operation !== 'getQrCode') return undefined;
	const uri = findQrDataUri(response);
	if (!uri) return undefined;
	const [, mime, b64] = /^data:(image\/[a-z]+);base64,(.*)$/is.exec(uri) ?? [];
	if (!b64) return undefined;
	const ext = mime.split('/')[1];
	return { qrcode: await ctx.helpers.prepareBinaryData(Buffer.from(b64, 'base64'), `qrcode.${ext}`, mime) };
}

function withTyping(body: IDataObject, opts: IDataObject): void {
	if (opts.typing === false) body.digitando = false;
}

function copyOptions(body: IDataObject, opts: IDataObject, keys: string[]): void {
	for (const k of keys) {
		const v = opts[k];
		if (v !== undefined && v !== '' && !(k === 'delay' && !v)) body[k] = v as never;
	}
}

async function runOperation(ctx: IExecuteFunctions, resource: string, operation: string, i: number): Promise<unknown> {
	const lang = await getLang(ctx);
	const getId = (): string => requireValue(ctx, ctx.getNodeParameter('instanceId', i, '') as string, 'Instance', i, lang);
	const getNumber = async (): Promise<string> => {
		const cc = String((await ctx.getCredentials('zapZapApi')).defaultCountryCode ?? '');
		const n = normalizeNumber(ctx.getNodeParameter('number', i, '') as string, cc);
		if (!n) throw new NodeOperationError(ctx.getNode(), msg(lang, 'numberRequired'), { itemIndex: i });
		return n;
	};
	const get = (name: string): string => ctx.getNodeParameter(name, i, '') as string;
	const opts = (name: string): IDataObject => ctx.getNodeParameter(name, i, {}) as IDataObject;

	// ---------- Custom ----------
	if (resource === 'custom') {
		const method = get('method') as 'GET' | 'POST' | 'PUT' | 'DELETE';
		const path = requireValue(ctx, get('path'), 'Path', i, lang);
		const bodyRaw = method === 'POST' || method === 'PUT' ? parseJsonParam(ctx, ctx.getNodeParameter('customBody', i, '{}'), 'Body', i, lang) : undefined;
		const qsRaw = parseJsonParam(ctx, ctx.getNodeParameter('customQuery', i, '{}'), 'Query', i, lang);
		return zapZapRequest(ctx, {
			method,
			path,
			body: bodyRaw && typeof bodyRaw === 'object' && Object.keys(bodyRaw as object).length ? (bodyRaw as IDataObject) : undefined,
			qs: qsRaw && typeof qsRaw === 'object' && Object.keys(qsRaw as object).length ? (qsRaw as IDataObject) : undefined,
		});
	}

	// ---------- Account ----------
	if (resource === 'account') {
		return zapZapRequest(ctx, { method: 'GET', path: '/account' });
	}

	// ---------- Instance ----------
	if (resource === 'instance') {
		switch (operation) {
			case 'list':
				return zapZapRequest(ctx, { method: 'GET', path: '/instances' });
			case 'create': {
				const name = requireValue(ctx, get('name'), 'Name', i, lang).toUpperCase();
				if (!/^[A-Z0-9_-]+$/.test(name)) {
					throw new NodeOperationError(ctx.getNode(), msg(lang, 'nameInvalid'), { itemIndex: i });
				}
				const o = opts('createOptions');
				const body: IDataObject = { name };
				if (o.systemName) body.systemName = o.systemName;
				if (o.metadata && o.metadata !== '{}') {
					const meta = parseJsonParam(ctx, o.metadata, 'Metadata', i, lang);
					if (meta && typeof meta === 'object' && !Array.isArray(meta) && Object.keys(meta).length) {
						body.metadata = meta as IDataObject;
					}
				}
				return zapZapRequest(ctx, { method: 'POST', path: '/instances', body });
			}
			case 'get':
				return zapZapRequest(ctx, { method: 'GET', path: `/instances/${enc(getId())}` });
			case 'getStatus':
				return zapZapRequest(ctx, { method: 'GET', path: `/${enc(getId())}/instance/status` });
			case 'getQrCode':
				return zapZapRequest(ctx, { method: 'GET', path: `/instances/${enc(getId())}/qrcode` });
		}
	}

	// ---------- Group ----------
	if (resource === 'group') {
		const id = getId();
		switch (operation) {
			case 'groupList': {
				const withParticipants = ctx.getNodeParameter('getParticipants', i, false) as boolean;
				return withParticipants
					? zapZapRequest(ctx, { method: 'POST', path: `/${enc(id)}/group/list`, body: { getParticipants: true } })
					: zapZapRequest(ctx, { method: 'GET', path: `/${enc(id)}/group/list` });
			}
			case 'groupInfo':
				return zapZapRequest(ctx, {
					method: 'POST',
					path: `/${enc(id)}/group/info`,
					body: {
						groupjid: requireValue(ctx, get('groupjid'), 'Group ID', i, lang),
						getInviteLink: ctx.getNodeParameter('getInviteLink', i, false) as boolean,
					},
				});
			case 'groupCreate': {
				const participants = get('participants')
					.split(',')
					.map((p) => normalizeNumber(p))
					.filter(Boolean);
				if (!participants.length) {
					throw new NodeOperationError(ctx.getNode(), msg(lang, 'participantsRequired'), { itemIndex: i });
				}
				return zapZapRequest(ctx, {
					method: 'POST',
					path: `/${enc(id)}/group/create`,
					body: { name: requireValue(ctx, get('groupName'), 'Group Name', i, lang), participants },
				});
			}
		}
	}

	// ---------- Chat ----------
	if (resource === 'chat' && operation === 'markRead') {
		return zapZapRequest(ctx, {
			method: 'POST',
			path: `/${enc(getId())}/chat/read`,
			body: { number: await getNumber() },
		});
	}

	// ---------- Message ----------
	if (resource === 'message') {
		const id = getId();
		const base = `/${enc(id)}`;
		switch (operation) {
			case 'sendText': {
				const o = opts('textOptions');
				const body: IDataObject = {
					number: await getNumber(),
					text: requireValue(ctx, get('text'), 'Text', i, lang),
				};
				copyOptions(body, o, ['mentions', 'replyid', 'delay']);
				withTyping(body, o);
				return zapZapRequest(ctx, { method: 'POST', path: `${base}/send/text`, body });
			}
			case 'sendMedia': {
				const o = opts('mediaOptions');
				const type = get('type') || 'image';
				const body: IDataObject = { number: await getNumber(), type };
				if ((ctx.getNodeParameter('mediaSource', i, 'url') as string) === 'binary') {
					const prop = requireValue(ctx, get('binaryPropertyName') || 'data', 'Input Binary Field', i, lang);
					const meta = ctx.helpers.assertBinaryData(i, prop);
					const buffer = await ctx.helpers.getBinaryDataBuffer(i, prop);
					if (buffer.length > MAX_BINARY_BYTES) {
						throw new NodeOperationError(ctx.getNode(), msg(lang, 'tooLarge'), { itemIndex: i });
					}
					body.file = `data:${meta.mimeType || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
					if (type === 'document' && !o.docName && meta.fileName) o.docName = meta.fileName;
				} else {
					const url = requireValue(ctx, get('file'), 'File URL', i, lang);
					try {
						validateHttpUrl(url);
					} catch {
						throw new NodeOperationError(ctx.getNode(), msg(lang, 'fileUrl'), { itemIndex: i });
					}
					body.file = url;
				}
				if (type === 'document' && !o.docName) {
					const fromUrl = String(body.file).split('?')[0].split('/').pop();
					if (fromUrl && !String(body.file).startsWith('data:')) o.docName = fromUrl;
				}
				copyOptions(body, o, ['text', 'docName', 'mentions', 'delay']);
				withTyping(body, o);
				return zapZapRequest(ctx, { method: 'POST', path: `${base}/send/media`, body });
			}
			case 'sendInteractive': {
				const kind = get('interactiveType') || 'poll';
				const body: IDataObject = {
					number: await getNumber(),
					text: requireValue(ctx, get('interactiveText'), 'Text', i, lang),
				};
				if (kind === 'poll') {
					const choices = parseJsonParam(ctx, ctx.getNodeParameter('pollChoices', i, '[]'), 'Choices', i, lang);
					if (!Array.isArray(choices) || choices.length < 2) {
						throw new NodeOperationError(ctx.getNode(), msg(lang, 'pollChoices'), { itemIndex: i });
					}
					body.choices = choices.map(String);
					body.selectableCount = ctx.getNodeParameter('selectableCount', i, 1) as number;
				} else if (kind === 'buttons') {
					const buttons = parseJsonParam(ctx, ctx.getNodeParameter('buttonsJson', i, '[]'), 'Buttons', i, lang);
					if (!Array.isArray(buttons) || buttons.length < 1 || buttons.length > 3) {
						throw new NodeOperationError(ctx.getNode(), msg(lang, 'buttons'), { itemIndex: i });
					}
					body.buttons = buttons as IDataObject[];
					copyOptions(body, opts('buttonsOptions'), ['image', 'footer']);
				} else {
					const choices = parseJsonParam(ctx, ctx.getNodeParameter('listChoices', i, '[]'), 'Choices', i, lang);
					if (!Array.isArray(choices) || !choices.length) {
						throw new NodeOperationError(ctx.getNode(), msg(lang, 'listChoices'), { itemIndex: i });
					}
					body.choices = choices.map(String);
					copyOptions(body, opts('listOptions'), ['listButton', 'footerText']);
				}
				return zapZapRequest(ctx, { method: 'POST', path: `${base}/send/${kind}`, body });
			}
			case 'sendLocation': {
				const body: IDataObject = {
					number: await getNumber(),
					latitude: ctx.getNodeParameter('latitude', i) as number,
					longitude: ctx.getNodeParameter('longitude', i) as number,
				};
				copyOptions(body, opts('locationOptions'), ['name', 'address']);
				return zapZapRequest(ctx, { method: 'POST', path: `${base}/send/location`, body });
			}
			case 'sendContact': {
				const body: IDataObject = {
					number: await getNumber(),
					fullName: requireValue(ctx, get('fullName'), 'Full Name', i, lang),
					phoneNumber: requireValue(ctx, get('phoneNumber'), 'Phone Numbers', i, lang),
				};
				copyOptions(body, opts('contactOptions'), ['organization', 'email']);
				return zapZapRequest(ctx, { method: 'POST', path: `${base}/send/contact`, body });
			}
			case 'react':
				return zapZapRequest(ctx, {
					method: 'POST',
					path: `${base}/message/react`,
					body: {
						number: await getNumber(),
						id: requireValue(ctx, get('id'), 'Message ID', i, lang),
						emoji: get('emoji'),
					},
				});
		}
	}

	throw new NodeOperationError(ctx.getNode(), msg(lang, 'unknownOp', { op: `${resource}/${operation}` }), { itemIndex: i });
}

function enc(v: string): string {
	return encodeURIComponent(v);
}
