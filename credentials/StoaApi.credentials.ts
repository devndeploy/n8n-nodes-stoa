import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class StoaApi implements ICredentialType {
	name = 'stoaApi';

	displayName = 'Stoa API';

	icon: Icon = { light: 'file:../icons/stoa.svg', dark: 'file:../icons/stoa-dark.svg' };

	documentationUrl = 'https://stoa.legal/docs/getting-started/how-to-create-api-key';

	properties: INodeProperties[] = [
		{
			displayName: 'API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://app.stoa.legal',
			description: 'Use the local Stoa server URL only for local development',
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
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/plugins/health',
			method: 'GET',
		},
	};
}
