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
		'http://localhost:3000/docs/getting-started/how-to-create-api-key';

	properties: INodeProperties[] = [
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
				Authorization: '=token {{$credentials?.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.github.com',
			url: '/user',
			method: 'GET',
		},
	};
}
