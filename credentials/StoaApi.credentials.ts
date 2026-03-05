import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class StoaApi implements ICredentialType {
	name = 'StoaApi';

	displayName = 'Stoa API';

	icon: Icon = { light: 'file:../icons/stoa.svg', dark: 'file:../icons/stoa.svg' };

	documentationUrl =
		'https://stoa.legal/docs/getting-started/how-to-create-api-key';

	properties: INodeProperties[] = [
		{
			displayName: 'API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://app.monavocat.ai',
			placeholder: 'https://app.monavocat.ai',
			description: 'Base URL of the Stoa app (no trailing slash)',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://app.monavocat.ai',
			url: '/api/plugins/health',
			method: 'GET',
		},
	};
}
