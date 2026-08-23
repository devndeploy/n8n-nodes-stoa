const assert = require('node:assert/strict');
const test = require('node:test');
const { NodeConnectionTypes } = require('n8n-workflow');
const { LmChatStoa } = require('../dist/nodes/Stoa/LmChatStoa.node.js');
const { Stoa } = require('../dist/nodes/Stoa/Stoa.node.js');
const {
	StoaChatModel,
	toStoaMessages,
	toStoaToolInputSchema,
} = require('../dist/nodes/Stoa/StoaChatModel.js');

test('native model exposes only category-level legal sources plus Internet', () => {
	const description = new LmChatStoa().description;
	assert.deepEqual(description.inputs, []);
	assert.deepEqual(description.outputs, [NodeConnectionTypes.AiLanguageModel]);
	const sources = description.properties.find((property) => property.name === 'sources');
	assert.ok(sources);
	assert.deepEqual(
		sources.options.map((option) => option.value),
		['BE', 'DE', 'ES', 'EU', 'FR', 'LU', 'MA', 'PT', 'TN', 'UAE', 'internet'],
	);
	assert.deepEqual(sources.default, ['FR', 'internet']);
	assert.equal(
		sources.options.some((option) => /workspace/i.test(option.name)),
		false,
	);
});

test('ordinary Stoa node no longer exposes Chat as an action resource', () => {
	const description = new Stoa().description;
	const resource = description.properties.find((property) => property.name === 'resource');
	assert.ok(resource);
	assert.equal(
		resource.options.some((option) => option.value === 'chat'),
		false,
	);
	assert.equal(
		resource.options.some((option) => option.value === 'playbooks'),
		true,
	);
});

test('maps n8n memory and tool results to the Stoa client-tool contract', () => {
	assert.deepEqual(
		toStoaMessages([
			{ role: 'system', content: [{ type: 'text', text: 'Be concise.' }] },
			{
				role: 'assistant',
				content: [
					{
						type: 'tool-call',
						toolCallId: 'call-1',
						toolName: 'lookup_contract',
						input: '{"id":"42"}',
					},
				],
			},
			{
				role: 'tool',
				name: 'lookup_contract',
				content: [
					{
						type: 'tool-result',
						toolCallId: 'call-1',
						result: { title: 'Contract' },
					},
				],
			},
			{ role: 'user', content: [{ type: 'text', text: 'Continue.' }] },
		]),
		[
			{ role: 'system', content: 'Be concise.' },
			{
				role: 'assistant',
				content: '',
				toolCalls: [{ id: 'call-1', name: 'lookup_contract', input: { id: '42' } }],
			},
			{
				role: 'tool',
				toolCallId: 'call-1',
				toolName: 'lookup_contract',
				output: { title: 'Contract' },
			},
			{ role: 'user', content: 'Continue.' },
		],
	);
});

test('passes sources and n8n-bound tools and returns deferred tool calls', async () => {
	let capturedRequest;
	const model = new StoaChatModel({
		sources: ['FR', 'internet'],
		request: async (request) => {
			capturedRequest = request;
			return {
				content: '',
				finishReason: 'tool-calls',
				toolCalls: [{ id: 'call-2', name: 'edit_record', input: { id: 7 } }],
				usage: { inputTokens: 11, outputTokens: 3, totalTokens: 14 },
				activeSources: ['FR', 'internet'],
			};
		},
	}).withTools([
		{
			type: 'function',
			name: 'edit_record',
			description: 'Edit an n8n record',
			inputSchema: {
				type: 'object',
				properties: { id: { type: 'number' } },
				required: ['id'],
			},
		},
	]);

	const result = await model.generate([
		{ role: 'user', content: [{ type: 'text', text: 'Edit record 7.' }] },
	]);

	assert.deepEqual(capturedRequest.sources, ['FR', 'internet']);
	assert.deepEqual(capturedRequest.tools, [
		{
			name: 'edit_record',
			description: 'Edit an n8n record',
			inputSchema: {
				type: 'object',
				properties: { id: { type: 'number' } },
				required: ['id'],
			},
		},
	]);
	assert.equal(capturedRequest.stream, false);
	assert.equal(result.finishReason, 'tool-calls');
	assert.deepEqual(result.message.content, [
		{
			type: 'tool-call',
			toolCallId: 'call-2',
			toolName: 'edit_record',
			input: '{"id":7}',
		},
	]);
	assert.deepEqual(result.usage, {
		promptTokens: 11,
		completionTokens: 3,
		totalTokens: 14,
	});
});

test('normalizes n8n tool schemas to OpenAI-compatible object schemas', () => {
	assert.deepEqual(toStoaToolInputSchema({ type: 'string', description: 'Expression' }), {
		type: 'object',
		properties: { input: { type: 'string', description: 'Expression' } },
		required: ['input'],
		additionalProperties: false,
	});
	assert.deepEqual(
		toStoaToolInputSchema({
			type: 'object',
			properties: { value: { type: 'number' } },
			required: ['value'],
		}),
		{
			type: 'object',
			properties: { value: { type: 'number' } },
			required: ['value'],
		},
	);
	const stringSchema = { _def: { typeName: 'ZodString', checks: [] } };
	const externalZodEffectsSchema = {
		_def: {
			typeName: 'ZodEffects',
			schema: {
				_def: {
					typeName: 'ZodObject',
					shape: () => ({ input: stringSchema }),
					unknownKeys: 'strip',
					catchall: { _def: { typeName: 'ZodNever' } },
				},
			},
		},
	};
	assert.deepEqual(toStoaToolInputSchema(externalZodEffectsSchema), {
		type: 'object',
		properties: { input: { type: 'string' } },
		required: ['input'],
		additionalProperties: false,
	});
});

test('preserves deterministic no-source refusal and streams it to an n8n agent', async () => {
	const model = new StoaChatModel({
		sources: [],
		request: async (request) => {
			assert.deepEqual(request.sources, []);
			return {
				content: 'No source is active for this integration.',
				finishReason: 'stop',
				refusal: { code: 'NO_ACTIVE_SOURCES' },
			};
		},
	});
	const chunks = [];
	for await (const chunk of model.stream([
		{ role: 'user', content: [{ type: 'text', text: 'Answer me.' }] },
	])) {
		chunks.push(chunk);
	}
	assert.deepEqual(chunks, [
		{ type: 'text-delta', delta: 'No source is active for this integration.' },
		{ type: 'finish', finishReason: 'stop', usage: undefined },
	]);
});
