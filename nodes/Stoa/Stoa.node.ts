import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Stoa implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Stoa',
		name: 'stoa',
		icon: 'file:../../icons/stoa.svg',
		group: ['transform'],
		version: [1],
		defaultVersion: 1,
		usableAsTool: true,
		subtitle: '={{ $parameter["resource"] }}',
		description: 'Stoa: ask legal questions, manage files and folders, run workflows (doc review, summarize, legal refs)',
		defaults: {
			name: 'Stoa',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'stoaApi',
				required: true,
			},
		],
		requestDefaults: {
			headers: {
				'Content-Type': 'application/json',
			},
		},
		properties: [
			// --- Resource selector
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Chat', value: 'chat', description: 'Ask a legal question' },
					{ name: 'File', value: 'file', description: 'Manage files' },
					{ name: 'Folder', value: 'folder', description: 'Manage folders' },
					{ name: 'Modèle', value: 'modeles', description: 'Validation templates and other resources' },
					{ name: 'Workflow', value: 'workflow', description: 'Doc review, summarize, legal refs' },
				],
				default: 'chat',
			},
			// --- Chat
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'User message to send to Stoa',
				displayOptions: { show: { resource: ['chat'] } },
			},
			// --- File operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Create', value: 'create', description: 'Folders only', action: 'Create a file' },
					{ name: 'Delete', value: 'delete', action: 'Delete a file' },
					{ name: 'Get', value: 'get', action: 'Get a file' },
					{ name: 'List', value: 'list', action: 'List a file' },
					{ name: 'Update', value: 'update', action: 'Update a file' },
					{ name: 'Upload', value: 'upload', description: 'Files only', action: 'Upload a file' },
				],
				default: 'list',
				displayOptions: { show: { resource: ['file'] } },
			},
			// --- Folder operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Create', value: 'create', action: 'Create a folder' },
					{ name: 'Delete', value: 'delete', action: 'Delete a folder' },
					{ name: 'Get', value: 'get', action: 'Get a folder' },
					{ name: 'List', value: 'list', action: 'List a folder' },
					{ name: 'Update', value: 'update', action: 'Update a folder' },
				],
				default: 'list',
				displayOptions: { show: { resource: ['folder'] } },
			},
			// --- Workflow Run operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Doc Review', value: 'docReview', action: 'Doc review a run' },
					{ name: 'Summarize', value: 'summarize', action: 'Summarize a run' },
					{ name: 'Legal Refs', value: 'legalRefs', action: 'Legal refs a run' },
				],
				default: 'docReview',
				displayOptions: { show: { resource: ['workflow'] } },
			},
			// --- Modèles operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Get Validation Templates', value: 'validationTemplates', action: 'Get validation templates' },
				],
				default: 'validationTemplates',
				displayOptions: { show: { resource: ['modeles'] } },
			},
			// --- Workflow: Doc Review
			{
				displayName: 'Template ID',
				name: 'validation_template_id',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['workflow'], operation: ['docReview'] } },
				description: 'Validation template UUID',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['workflow'], operation: ['docReview', 'summarize', 'legalRefs'] } },
				description: 'Document text (with sentence IDs like [0], [1] for doc review)',
			},
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
				displayOptions: { show: { resource: ['workflow'], operation: ['summarize'] } },
			},
			// --- File list
			{
				displayName: 'Folder ID',
				name: 'folder_id',
				type: 'string',
				default: '',
				description: 'List only files in this folder (leave empty for root)',
				displayOptions: { show: { resource: ['file'], operation: ['list'] } },
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Filter by file name',
				displayOptions: { show: { resource: ['file'], operation: ['list'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				description: 'Max number of results to return',
				default: 50,
				typeOptions: { min: 1, max: 100 },
				displayOptions: { show: { resource: ['file'], operation: ['list'] } },
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				default: 0,
				typeOptions: { min: 0 },
				displayOptions: { show: { resource: ['file'], operation: ['list'] } },
			},
			// --- File upload
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				description: 'Name of the binary property containing the file',
				displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
			},
			{
				displayName: 'Folder ID',
				name: 'folder_id',
				type: 'string',
				default: '',
				description: 'Upload into this folder (leave empty for root)',
				displayOptions: { show: { resource: ['file'], operation: ['upload'] } },
			},
			// --- File get / update / delete
			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['file'], operation: ['get', 'update', 'delete'] } },
			},
			// --- File update
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'New file name (rename)',
				displayOptions: { show: { resource: ['file'], operation: ['update'] } },
			},
			{
				displayName: 'Folder ID',
				name: 'folder_id',
				type: 'string',
				default: '',
				description: 'Move file to this folder (empty = root)',
				displayOptions: { show: { resource: ['file'], operation: ['update'] } },
			},
			{
				displayName: 'Tag IDs',
				name: 'tag_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated tag IDs to set on the file',
				displayOptions: { show: { resource: ['file'], operation: ['update'] } },
			},
			// --- Folder list
			{
				displayName: 'Parent Folder ID',
				name: 'parent_id',
				type: 'string',
				default: '',
				description: 'List only folders in this parent (leave empty for root)',
				displayOptions: { show: { resource: ['folder'], operation: ['list'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				description: 'Max number of results to return',
				default: 50,
				typeOptions: { min: 1, max: 100 },
				displayOptions: { show: { resource: ['folder'], operation: ['list'] } },
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				default: 0,
				typeOptions: { min: 0 },
				displayOptions: { show: { resource: ['folder'], operation: ['list'] } },
			},
			// --- Folder create
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['folder'], operation: ['create'] } },
			},
			{
				displayName: 'Parent Folder ID',
				name: 'parent_id',
				type: 'string',
				default: '',
				description: 'Create under this folder (leave empty for root)',
				displayOptions: { show: { resource: ['folder'], operation: ['create'] } },
			},
			// --- Folder get / update / delete
			{
				displayName: 'Folder ID',
				name: 'folderId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['folder'], operation: ['get', 'update', 'delete'] } },
			},
			// --- Folder update
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'New folder name',
				displayOptions: { show: { resource: ['folder'], operation: ['update'] } },
			},
			{
				displayName: 'Parent Folder ID',
				name: 'parent_id',
				type: 'string',
				default: '',
				description: 'Move folder under this parent (empty = root)',
				displayOptions: { show: { resource: ['folder'], operation: ['update'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = resource !== 'chat' ? (this.getNodeParameter('operation', 0) as string) : '';
		const baseUrl = 'https://app.stoa.legal';

		for (let i = 0; i < items.length; i++) {
			try {
				let response: unknown;

				if (resource === 'chat') {
					const message = this.getNodeParameter('message', i) as string;
					response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
						method: 'POST',
						url: `${baseUrl}/api/plugins/simplified-chat`,
						headers: { 'Content-Type': 'application/json' },
						body: { message },
						json: true,
					});
				} else if (resource === 'workflow') {
					if (operation === 'docReview') {
						const validation_template_id = this.getNodeParameter('validation_template_id', i) as string;
						const text = this.getNodeParameter('text', i) as string;
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'POST',
							url: `${baseUrl}/api/plugins/workflows/doc-review`,
							body: { validation_template_id, text },
							json: true,
						});
					} else if (operation === 'summarize') {
						const text = this.getNodeParameter('text', i) as string;
						const type = this.getNodeParameter('type', i) as string;
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'POST',
							url: `${baseUrl}/api/plugins/workflows/summarize`,
							body: { text, type },
							json: true,
						});
					} else if (operation === 'legalRefs') {
						const text = this.getNodeParameter('text', i) as string;
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'POST',
							url: `${baseUrl}/api/plugins/workflows/legal-refs`,
							body: { text },
							json: true,
						});
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown workflow operation: ${operation}`);
					}
				} else if (resource === 'modeles') {
					response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
						method: 'GET',
						url: `${baseUrl}/api/plugins/workflows/validation-templates`,
						json: true,
					});
				} else if (resource === 'file') {
					if (operation === 'list') {
						const folder_id = this.getNodeParameter('folder_id', i) as string;
						const search = this.getNodeParameter('search', i) as string;
						const limit = this.getNodeParameter('limit', i) as number;
						const offset = this.getNodeParameter('offset', i) as number;
						const params: IDataObject = { limit, offset };
						if (folder_id !== '') params.folder_id = folder_id;
						if (search !== '') params.search = search;
						const qs = new URLSearchParams(params as Record<string, string>).toString();
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'GET',
							url: `${baseUrl}/api/plugins/files?${qs}`,
							json: true,
						});
					} else if (operation === 'upload') {
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						const folder_id = this.getNodeParameter('folder_id', i) as string;
						const item = items[i];
						const binary = item.binary?.[binaryPropertyName];
						if (!binary?.data) {
							throw new NodeOperationError(this.getNode(), `No binary data for property "${binaryPropertyName}"`, { itemIndex: i });
						}
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						const formData = new FormData();
						const fileName = (binary as IDataObject).fileName as string || 'file';
						formData.append('file', new Blob([buffer]), fileName);
						if (folder_id !== '') formData.append('folder_id', folder_id);
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'POST',
							url: `${baseUrl}/api/plugins/files`,
							body: formData,
							headers: {},
						});
					} else if (operation === 'get') {
						const fileId = this.getNodeParameter('fileId', i) as string;
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'GET',
							url: `${baseUrl}/api/plugins/files/${fileId}`,
							json: true,
						});
					} else if (operation === 'update') {
						const fileId = this.getNodeParameter('fileId', i) as string;
						const name = this.getNodeParameter('name', i) as string;
						const folder_id = this.getNodeParameter('folder_id', i) as string;
						const tag_ids_raw = this.getNodeParameter('tag_ids', i) as string;
						const body: IDataObject = {};
						if (name !== '') body.name = name;
						if (folder_id !== undefined) body.folder_id = folder_id === '' ? null : folder_id;
						if (tag_ids_raw !== '') {
							body.tag_ids = tag_ids_raw.split(',').map((s) => s.trim()).filter(Boolean);
						}
						if (Object.keys(body).length === 0) {
							throw new NodeOperationError(this.getNode(), 'Provide at least one of Name, Folder ID, or Tag IDs', { itemIndex: i });
						}
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'PATCH',
							url: `${baseUrl}/api/plugins/files/${fileId}`,
							body,
							json: true,
						});
					} else if (operation === 'delete') {
						const fileId = this.getNodeParameter('fileId', i) as string;
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'DELETE',
							url: `${baseUrl}/api/plugins/files/${fileId}`,
							json: true,
						});
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown file operation: ${operation}`, { itemIndex: i });
					}
				} else if (resource === 'folder') {
					if (operation === 'list') {
						const parent_id = this.getNodeParameter('parent_id', i) as string;
						const limit = this.getNodeParameter('limit', i) as number;
						const offset = this.getNodeParameter('offset', i) as number;
						const params: IDataObject = { limit, offset };
						if (parent_id !== '') params.parent_id = parent_id;
						const qs = new URLSearchParams(params as Record<string, string>).toString();
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'GET',
							url: `${baseUrl}/api/plugins/files/folders?${qs}`,
							json: true,
						});
					} else if (operation === 'create') {
						const name = this.getNodeParameter('name', i) as string;
						const parent_id = this.getNodeParameter('parent_id', i) as string;
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'POST',
							url: `${baseUrl}/api/plugins/files/folders`,
							body: { name, parent_id: parent_id === '' ? null : parent_id },
							json: true,
						});
					} else if (operation === 'get') {
						const folderId = this.getNodeParameter('folderId', i) as string;
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'GET',
							url: `${baseUrl}/api/plugins/files/folders/${folderId}`,
							json: true,
						});
					} else if (operation === 'update') {
						const folderId = this.getNodeParameter('folderId', i) as string;
						const name = this.getNodeParameter('name', i) as string;
						const parent_id = this.getNodeParameter('parent_id', i) as string;
						const body: IDataObject = {};
						if (name !== '') body.name = name;
						if (parent_id !== undefined) body.parent_id = parent_id === '' ? null : parent_id;
						if (Object.keys(body).length === 0) {
							throw new NodeOperationError(this.getNode(), 'Provide at least one of Name or Parent Folder ID', { itemIndex: i });
						}
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'PATCH',
							url: `${baseUrl}/api/plugins/files/folders/${folderId}`,
							body,
							json: true,
						});
					} else if (operation === 'delete') {
						const folderId = this.getNodeParameter('folderId', i) as string;
						response = await this.helpers.httpRequestWithAuthentication.call(this, 'stoaApi', {
							method: 'DELETE',
							url: `${baseUrl}/api/plugins/files/folders/${folderId}`,
							json: true,
						});
					} else {
						throw new NodeOperationError(this.getNode(), `Unknown folder operation: ${operation}`, { itemIndex: i });
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, { itemIndex: i });
				}

				returnData.push({
					json: (response ?? {}) as IDataObject,
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
