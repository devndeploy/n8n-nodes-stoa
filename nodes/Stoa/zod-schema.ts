type JsonSchema = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function definition(schema: unknown): Record<string, unknown> {
	if (!isRecord(schema) || !isRecord(schema._def)) return {};
	return schema._def;
}

function typeName(schema: unknown): string | undefined {
	const value = definition(schema).typeName;
	return typeof value === 'string' ? value : undefined;
}

function schemaDescription(schema: unknown): string | undefined {
	if (!isRecord(schema)) return undefined;
	return typeof schema.description === 'string' ? schema.description : undefined;
}

function withDescription(schema: unknown, jsonSchema: JsonSchema): JsonSchema {
	const description = schemaDescription(schema);
	return description ? { ...jsonSchema, description } : jsonSchema;
}

function literalType(value: unknown): string | undefined {
	if (value === null) return 'null';
	if (typeof value === 'string') return 'string';
	if (typeof value === 'number') return 'number';
	if (typeof value === 'boolean') return 'boolean';
	return undefined;
}

function parseString(def: Record<string, unknown>): JsonSchema {
	const result: JsonSchema = { type: 'string' };
	for (const value of Array.isArray(def.checks) ? def.checks : []) {
		if (!isRecord(value) || typeof value.kind !== 'string') continue;
		if (value.kind === 'min' && typeof value.value === 'number') result.minLength = value.value;
		if (value.kind === 'max' && typeof value.value === 'number') result.maxLength = value.value;
		if (value.kind === 'length' && typeof value.value === 'number') {
			result.minLength = value.value;
			result.maxLength = value.value;
		}
		if (value.kind === 'email') result.format = 'email';
		if (value.kind === 'url') result.format = 'uri';
		if (value.kind === 'uuid') result.format = 'uuid';
		if (value.kind === 'datetime') result.format = 'date-time';
		if (value.kind === 'date') result.format = 'date';
		if (value.kind === 'time') result.format = 'time';
		if (value.kind === 'duration') result.format = 'duration';
		if (value.kind === 'regex' && value.regex instanceof RegExp)
			result.pattern = value.regex.source;
		if (value.kind === 'startsWith' && typeof value.value === 'string') {
			result.pattern = `^${value.value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`;
		}
	}
	return result;
}

function parseNumber(def: Record<string, unknown>): JsonSchema {
	const result: JsonSchema = { type: 'number' };
	for (const value of Array.isArray(def.checks) ? def.checks : []) {
		if (!isRecord(value) || typeof value.kind !== 'string') continue;
		if (value.kind === 'int') result.type = 'integer';
		if (value.kind === 'min' && typeof value.value === 'number') {
			result[value.inclusive === false ? 'exclusiveMinimum' : 'minimum'] = value.value;
		}
		if (value.kind === 'max' && typeof value.value === 'number') {
			result[value.inclusive === false ? 'exclusiveMaximum' : 'maximum'] = value.value;
		}
		if (value.kind === 'multipleOf' && typeof value.value === 'number') {
			result.multipleOf = value.value;
		}
	}
	return result;
}

function isOptional(schema: unknown): boolean {
	const name = typeName(schema);
	if (name === 'ZodOptional' || name === 'ZodDefault' || name === 'ZodCatch') return true;
	if (name === 'ZodEffects') return isOptional(definition(schema).schema);
	return false;
}

function objectShape(def: Record<string, unknown>): Record<string, unknown> {
	const shape = def.shape;
	if (typeof shape === 'function') {
		const resolved = shape();
		return isRecord(resolved) ? resolved : {};
	}
	return isRecord(shape) ? shape : {};
}

function parseObject(def: Record<string, unknown>, seen: WeakSet<object>): JsonSchema {
	const properties: Record<string, JsonSchema> = {};
	const required: string[] = [];
	for (const [name, schema] of Object.entries(objectShape(def))) {
		properties[name] = parseSchema(schema, seen);
		if (!isOptional(schema)) required.push(name);
	}
	const result: JsonSchema = { type: 'object', properties };
	if (required.length > 0) result.required = required;
	const catchall = def.catchall;
	if (catchall && typeName(catchall) !== 'ZodNever') {
		result.additionalProperties = parseSchema(catchall, seen);
	} else {
		result.additionalProperties = def.unknownKeys === 'passthrough';
	}
	return result;
}

function enumValues(value: unknown): Array<string | number> {
	if (Array.isArray(value)) {
		return value.filter(
			(item): item is string | number => typeof item === 'string' || typeof item === 'number',
		);
	}
	if (!isRecord(value)) return [];
	return [
		...new Set(
			Object.values(value).filter(
				(item): item is string | number => typeof item === 'string' || typeof item === 'number',
			),
		),
	];
}

function parseNullable(inner: JsonSchema): JsonSchema {
	if (typeof inner.type === 'string') return { ...inner, type: [inner.type, 'null'] };
	return { anyOf: [inner, { type: 'null' }] };
}

function parseSchema(schema: unknown, seen: WeakSet<object>): JsonSchema {
	if (!isRecord(schema)) return {};
	if (seen.has(schema)) return {};
	seen.add(schema);
	const def = definition(schema);
	const name = typeName(schema);
	let result: JsonSchema;

	switch (name) {
		case 'ZodString':
			result = parseString(def);
			break;
		case 'ZodNumber':
			result = parseNumber(def);
			break;
		case 'ZodBigInt':
			result = { type: 'integer' };
			break;
		case 'ZodBoolean':
			result = { type: 'boolean' };
			break;
		case 'ZodDate':
			result = { type: 'string', format: 'date-time' };
			break;
		case 'ZodNull':
			result = { type: 'null' };
			break;
		case 'ZodNever':
			result = { not: {} };
			break;
		case 'ZodLiteral': {
			const type = literalType(def.value);
			result = { ...(type ? { type } : {}), const: def.value };
			break;
		}
		case 'ZodEnum':
		case 'ZodNativeEnum': {
			const values = enumValues(def.values);
			const types = [...new Set(values.map(literalType).filter(Boolean))];
			result = { ...(types.length === 1 ? { type: types[0] } : {}), enum: values };
			break;
		}
		case 'ZodObject':
			result = parseObject(def, seen);
			break;
		case 'ZodArray': {
			result = { type: 'array', items: parseSchema(def.type, seen) };
			for (const [key, target] of [
				['minLength', 'minItems'],
				['maxLength', 'maxItems'],
				['exactLength', 'minItems'],
			] as const) {
				const constraint = def[key];
				if (isRecord(constraint) && typeof constraint.value === 'number')
					result[target] = constraint.value;
			}
			if (isRecord(def.exactLength) && typeof def.exactLength.value === 'number') {
				result.maxItems = def.exactLength.value;
			}
			break;
		}
		case 'ZodTuple':
			result = {
				type: 'array',
				prefixItems: (Array.isArray(def.items) ? def.items : []).map((item) =>
					parseSchema(item, seen),
				),
				minItems: Array.isArray(def.items) ? def.items.length : 0,
				...(def.rest ? { items: parseSchema(def.rest, seen) } : { items: false }),
			};
			break;
		case 'ZodUnion':
			result = {
				anyOf: (Array.isArray(def.options) ? def.options : []).map((item) =>
					parseSchema(item, seen),
				),
			};
			break;
		case 'ZodDiscriminatedUnion': {
			const options = def.options instanceof Map ? [...def.options.values()] : def.options;
			result = {
				oneOf: (Array.isArray(options) ? options : []).map((item) => parseSchema(item, seen)),
			};
			break;
		}
		case 'ZodIntersection':
			result = { allOf: [parseSchema(def.left, seen), parseSchema(def.right, seen)] };
			break;
		case 'ZodRecord':
			result = { type: 'object', additionalProperties: parseSchema(def.valueType, seen) };
			break;
		case 'ZodMap':
			result = {
				type: 'array',
				items: {
					type: 'array',
					prefixItems: [parseSchema(def.keyType, seen), parseSchema(def.valueType, seen)],
					minItems: 2,
					maxItems: 2,
				},
			};
			break;
		case 'ZodSet':
			result = { type: 'array', uniqueItems: true, items: parseSchema(def.valueType, seen) };
			break;
		case 'ZodNullable':
			result = parseNullable(parseSchema(def.innerType, seen));
			break;
		case 'ZodOptional':
		case 'ZodDefault':
		case 'ZodCatch':
		case 'ZodReadonly':
			result = parseSchema(def.innerType, seen);
			break;
		case 'ZodEffects':
			result = parseSchema(def.schema, seen);
			break;
		case 'ZodPipeline':
			result = parseSchema(def.out, seen);
			break;
		case 'ZodBranded':
		case 'ZodPromise':
			result = parseSchema(def.type, seen);
			break;
		case 'ZodLazy':
			result = typeof def.getter === 'function' ? parseSchema(def.getter(), seen) : {};
			break;
		case 'ZodAny':
		case 'ZodUnknown':
		default:
			result = {};
	}

	seen.delete(schema);
	return withDescription(schema, result);
}

/**
 * Converts a Zod 3 schema by structure instead of `instanceof`. n8n community
 * nodes and built-in tools can load separate copies of Zod, so identity-based
 * conversion otherwise silently returns the schema object rather than JSON.
 */
export function zodSchemaToJsonSchema(schema: unknown): JsonSchema {
	if (isRecord(schema) && typeof schema.toJSONSchema === 'function') {
		const converted = schema.toJSONSchema();
		if (isRecord(converted)) return converted;
	}
	return parseSchema(schema, new WeakSet<object>());
}
