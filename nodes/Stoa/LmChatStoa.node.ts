import { supplyModel } from '@n8n/ai-node-sdk';
import type {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	StoaChatModel,
	type StoaChatRequest,
	type StoaChatResponse,
	type StoaChatSource,
} from './StoaChatModel';

const sourceOptions = [
	{ name: 'Belgian Law', value: 'BE' },
	{ name: 'German Law', value: 'DE' },
	{ name: 'Spanish Law', value: 'ES' },
	{ name: 'European Union Law', value: 'EU' },
	{ name: 'French Law', value: 'FR' },
	{ name: 'Luxembourg Law', value: 'LU' },
	{ name: 'Moroccan Law', value: 'MA' },
	{ name: 'Portuguese Law', value: 'PT' },
	{ name: 'Tunisian Law', value: 'TN' },
	{ name: 'United Arab Emirates Law', value: 'UAE' },
	{ name: 'Internet', value: 'internet' },
];

export class LmChatStoa implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Stoa Chat Model',
		name: 'lmChatStoa',
		icon: {
			light: 'file:../../icons/stoa.svg',
			dark: 'file:../../icons/stoa-dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["sources"].join(", ") }}',
		description:
			'Use Stoa as an n8n AI language model with legal categories, tools, and agent memory',
		defaults: { name: 'Stoa Chat Model' },
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		credentials: [{ name: 'stoaApi', required: true }],
		properties: [
			{
				displayName: 'Sources',
				name: 'sources',
				type: 'multiOptions',
				options: sourceOptions,
				default: ['FR', 'internet'],
				description:
					'Each legal category activates every Stoa source available in that jurisdiction. Clear all sources to make Stoa refuse the request.',
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('stoaApi');
		const baseUrl = String(credentials.baseUrl || 'https://app.stoa.legal').replace(/\/+$/u, '');
		const sources = this.getNodeParameter('sources', itemIndex, []) as StoaChatSource[];
		const request = async (
			body: StoaChatRequest,
			config?: { timeout?: number; abortSignal?: AbortSignal },
		): Promise<StoaChatResponse> => {
			if (config?.abortSignal?.aborted) {
				throw new NodeOperationError(this.getNode(), 'Stoa chat request was cancelled');
			}
			const response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
				method: 'POST',
				url: `${baseUrl}/api/plugins/chat`,
				headers: { 'Content-Type': 'application/json' },
				body,
				json: true,
				...(config?.timeout ? { timeout: config.timeout } : {}),
			});
			if (config?.abortSignal?.aborted) {
				throw new NodeOperationError(this.getNode(), 'Stoa chat request was cancelled');
			}
			return response as StoaChatResponse;
		};

		return supplyModel(this, new StoaChatModel({ sources, request }));
	}
}
