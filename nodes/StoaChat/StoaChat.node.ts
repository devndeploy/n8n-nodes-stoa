import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class StoaChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Stoa Chat',
		name: 'stoaChat',
		icon: 'file:../../icons/stoa.svg',
		group: ['transform'],
		version: [1],
		defaultVersion: 1,
		description: 'Send a message to Stoa and get a reply with content and source references',
		defaults: {
			name: 'Stoa Chat',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'StoaApi',
				required: true,
			},
		],
		requestDefaults: {
			headers: {
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'User message to send to Stoa',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const baseUrl = 'https://app.stoa.legal';

		for (let i = 0; i < items.length; i++) {
			try {
				const message = this.getNodeParameter('message', i) as string;
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'StoaApi', {
					method: 'POST',
					url: `${baseUrl}/api/plugins/simplified-chat`,
					headers: {
						'Content-Type': 'application/json',
					},
					body: { message },
					json: true,
				});

				returnData.push({
					json: response as IDataObject,
					pairedItem: { item: i },
				});
			} catch (error: unknown) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : String(error) } as IDataObject,
						pairedItem: { item: i },
						error: error instanceof Error ? error : new Error(String(error)),
					} as INodeExecutionData);
				} else {
					throw new NodeOperationError(this.getNode(), error instanceof Error ? error : new Error(String(error)), { itemIndex: i });
				}
			}
		}

		return [returnData];
	}
}
