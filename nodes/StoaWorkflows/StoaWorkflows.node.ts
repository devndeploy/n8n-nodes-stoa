import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class StoaWorkflows implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Stoa Workflows',
		name: 'stoaWorkflows',
		icon: 'file:../../icons/stoa.svg',
		group: ['transform'],
		version: [1],
		defaultVersion: 1,
		subtitle: '={{ $parameter["resource"] }} / {{ $parameter["operation"] }}',
		description: 'Call Stoa workflow API: run workflows (doc review, summarize, legal refs) or get resources (validation templates)',
		defaults: {
			name: 'Stoa Workflows',
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
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Run Workflow', value: 'run', description: 'Doc review, summarize, legal refs' },
					{ name: 'Dependencies', value: 'resources', description: 'Validation templates and other resources' },
				],
				default: 'run',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Doc Review', value: 'docReview' },
					{ name: 'Summarize', value: 'summarize' },
					{ name: 'Legal Refs', value: 'legalRefs' },
				],
				default: 'docReview',
				displayOptions: {
					show: { resource: ['run'] },
				},
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Get Validation Templates', value: 'validationTemplates' },
				],
				default: 'validationTemplates',
				displayOptions: {
					show: { resource: ['resources'] },
				},
			},
			// Run: Doc Review
			{
				displayName: 'Template ID',
				name: 'validation_template_id',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['run'], operation: ['docReview'] } },
				description: 'Validation template UUID',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['run'], operation: ['docReview', 'summarize', 'legalRefs'] } },
				description: 'Document text (with sentence IDs like [0], [1] for doc review)',
			},
			// Run: Summarize
			{
				displayName: 'Summary Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Concise', value: 'concise' },
					{ name: 'Normal', value: 'normal' },
					{ name: 'Developed', value: 'developed' },
				],
				default: 'normal',
				displayOptions: { show: { resource: ['run'], operation: ['summarize'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;
		const baseUrl = 'https://app.stoa.legal';

		for (let i = 0; i < items.length; i++) {
			try {
				let response: unknown;

				if (operation === 'validationTemplates') {
					response = await this.helpers.httpRequestWithAuthentication.call(this, 'StoaApi', {
						method: 'GET',
						url: `${baseUrl}/api/plugins/workflows/validation-templates`,
						json: true,
					});
				} else if (operation === 'docReview') {
					const validation_template_id = this.getNodeParameter('validation_template_id', i) as string;
					const text = this.getNodeParameter('text', i) as string;
					response = await this.helpers.httpRequestWithAuthentication.call(this, 'StoaApi', {
						method: 'POST',
						url: `${baseUrl}/api/plugins/workflows/doc-review`,
						body: { validation_template_id, text },
						json: true,
					});
				} else if (operation === 'summarize') {
					const text = this.getNodeParameter('text', i) as string;
					const type = this.getNodeParameter('type', i) as string;
					response = await this.helpers.httpRequestWithAuthentication.call(this, 'StoaApi', {
						method: 'POST',
						url: `${baseUrl}/api/plugins/workflows/summarize`,
						body: { text, type },
						json: true,
					});
				} else if (operation === 'legalRefs') {
					const text = this.getNodeParameter('text', i) as string;
					response = await this.helpers.httpRequestWithAuthentication.call(this, 'StoaApi', {
						method: 'POST',
						url: `${baseUrl}/api/plugins/workflows/legal-refs`,
						body: { text },
						json: true,
					});
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push({
					json: response as IDataObject,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : String(error) } as IDataObject,
						pairedItem: { item: i },
						error,
					});
				} else {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}
			}
		}

		return [returnData];
	}
}
