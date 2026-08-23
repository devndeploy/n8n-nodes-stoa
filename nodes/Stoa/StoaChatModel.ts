import {
	BaseChatModel,
	getParametersJsonSchema,
	type ChatModelConfig,
	type FinishReason,
	type GenerateResult,
	type Message,
	type StreamChunk,
} from '@n8n/ai-node-sdk';
import { zodSchemaToJsonSchema } from './zod-schema';

export const STOA_CHAT_SOURCE_VALUES = [
	'BE',
	'DE',
	'ES',
	'EU',
	'FR',
	'LU',
	'MA',
	'PT',
	'TN',
	'UAE',
	'internet',
] as const;

export type StoaChatSource = (typeof STOA_CHAT_SOURCE_VALUES)[number];

type StoaClientToolCall = {
	id: string;
	name: string;
	input: unknown;
};

type StoaChatMessage =
	| {
			role: 'system' | 'user' | 'assistant';
			content: string;
			toolCalls?: StoaClientToolCall[];
	  }
	| {
			role: 'tool';
			toolCallId: string;
			toolName: string;
			output: unknown;
			isError?: boolean;
	  };

export type StoaChatRequest = {
	messages: StoaChatMessage[];
	sources: StoaChatSource[];
	tools: Array<{
		name: string;
		description: string;
		inputSchema: Record<string, unknown>;
	}>;
	stream: false;
};

export type StoaChatResponse = {
	content?: string;
	finishReason?: string;
	toolCalls?: StoaClientToolCall[];
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
	activeSources?: string[];
	refusal?: { code?: string };
};

export type StoaChatRequester = (
	request: StoaChatRequest,
	config?: ChatModelConfig,
) => Promise<StoaChatResponse>;

type StoaChatModelOptions = {
	sources: StoaChatSource[];
	request: StoaChatRequester;
};

type JsonSchema = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * n8n can load a community model and a built-in tool from separate dependency
 * trees. In that case the SDK's `instanceof ZodSchema` check does not recognize
 * the tool's otherwise-valid Zod schema. Convert Zod schemas structurally so
 * built-in tools such as Calculator keep their real object parameters.
 */
function toJsonSchema(inputSchema: unknown): JsonSchema {
	if (isRecord(inputSchema) && '_def' in inputSchema) {
		const converted = zodSchemaToJsonSchema(inputSchema);
		if (isRecord(converted)) return converted;
	}

	const converted = getParametersJsonSchema({
		type: 'function',
		name: 'tool',
		inputSchema: inputSchema as never,
	});
	return isRecord(converted) ? converted : {};
}

export function toStoaToolInputSchema(inputSchema: unknown): JsonSchema {
	const schema = toJsonSchema(inputSchema);
	if (schema.type === 'object') return schema;

	// OpenAI-compatible function calling requires a top-level object. LangChain
	// string tools conventionally receive their value through an `input` field.
	if (typeof schema.type === 'string' || Array.isArray(schema.type)) {
		return {
			type: 'object',
			properties: { input: schema },
			required: ['input'],
			additionalProperties: false,
		};
	}

	throw new Error('n8n supplied a tool without a convertible input schema');
}

function parseToolInput(input: string): unknown {
	try {
		return JSON.parse(input);
	} catch {
		return input;
	}
}

function messageText(message: Message): string {
	return message.content
		.filter((part) => part.type === 'text')
		.map((part) => part.text)
		.join('\n');
}

export function toStoaMessages(messages: Message[]): StoaChatMessage[] {
	const toolNamesByCallId = new Map<string, string>();
	const result: StoaChatMessage[] = [];

	for (const message of messages) {
		if (message.role === 'tool') {
			for (const part of message.content) {
				if (part.type !== 'tool-result') continue;
				const toolName = message.name || toolNamesByCallId.get(part.toolCallId);
				if (!toolName) {
					throw new Error(`Stoa could not match n8n tool result ${part.toolCallId} to a tool call`);
				}
				result.push({
					role: 'tool',
					toolCallId: part.toolCallId,
					toolName,
					output: part.result === undefined ? null : part.result,
					...(part.isError ? { isError: true } : {}),
				});
			}
			continue;
		}

		const toolCalls = message.content.flatMap((part, index): StoaClientToolCall[] => {
			if (part.type !== 'tool-call') return [];
			const id = part.toolCallId || `stoa-${result.length}-${index}`;
			toolNamesByCallId.set(id, part.toolName);
			return [{ id, name: part.toolName, input: parseToolInput(part.input) }];
		});
		result.push({
			role: message.role,
			content: messageText(message),
			...(toolCalls.length > 0 ? { toolCalls } : {}),
		});
	}

	return result;
}

function finishReason(value: string | undefined, hasToolCalls: boolean): FinishReason {
	if (hasToolCalls) return 'tool-calls';
	if (
		value === 'stop' ||
		value === 'length' ||
		value === 'content-filter' ||
		value === 'tool-calls' ||
		value === 'error' ||
		value === 'other'
	) {
		return value;
	}
	return 'other';
}

export class StoaChatModel extends BaseChatModel {
	private readonly sources: StoaChatSource[];

	private readonly requester: StoaChatRequester;

	constructor(options: StoaChatModelOptions) {
		super('stoa', 'stoa-integration-chat');
		this.sources = [...options.sources];
		this.requester = options.request;
	}

	async generate(messages: Message[], config?: ChatModelConfig): Promise<GenerateResult> {
		const toolsByName = new Map(
			this.tools
				.filter((tool) => tool.type === 'function')
				.map((tool) => [
					tool.name,
					{
						name: tool.name,
						description: tool.description || `Tool supplied by the n8n workflow: ${tool.name}`,
						inputSchema: toStoaToolInputSchema(tool.inputSchema),
					},
				]),
		);
		const response = await this.requester(
			{
				messages: toStoaMessages(messages),
				sources: [...this.sources],
				tools: [...toolsByName.values()],
				stream: false,
			},
			this.mergeConfig(config),
		);
		const toolCalls = response.toolCalls ?? [];
		const content = [
			...(response.content ? [{ type: 'text' as const, text: response.content }] : []),
			...toolCalls.map((call) => ({
				type: 'tool-call' as const,
				toolCallId: call.id,
				toolName: call.name,
				input: JSON.stringify(call.input),
			})),
		];

		return {
			finishReason: finishReason(response.finishReason, toolCalls.length > 0),
			message: { role: 'assistant', content },
			usage: response.usage
				? {
						promptTokens: response.usage.inputTokens ?? 0,
						completionTokens: response.usage.outputTokens ?? 0,
						totalTokens:
							response.usage.totalTokens ??
							(response.usage.inputTokens ?? 0) + (response.usage.outputTokens ?? 0),
					}
				: undefined,
			providerMetadata: {
				activeSources: response.activeSources ?? [],
				...(response.refusal ? { refusal: response.refusal } : {}),
			},
			rawResponse: response,
		};
	}

	async *stream(messages: Message[], config?: ChatModelConfig): AsyncIterable<StreamChunk> {
		const result = await this.generate(messages, config);
		for (const part of result.message.content) {
			if (part.type === 'text') {
				yield { type: 'text-delta', delta: part.text };
			} else if (part.type === 'tool-call') {
				yield {
					type: 'tool-call-delta',
					id: part.toolCallId,
					name: part.toolName,
					argumentsDelta: part.input,
				};
			}
		}
		yield {
			type: 'finish',
			finishReason: result.finishReason ?? 'other',
			usage: result.usage,
		};
	}
}
