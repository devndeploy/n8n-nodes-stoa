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
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
		{
			displayName: 'Allowed HTTP Request Domains',
			name: 'allowedHttpRequestDomains',
			type: 'hidden',
			default: 'app.stoa.legal',
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
			baseURL: 'https://app.stoa.legal',
			url: '/api/plugins/health',
			method: 'GET',
		},
	};
}
