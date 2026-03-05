import { config } from '@n8n/node-cli/eslint';

export default [
	{ ignores: ['**/._*', '._*'] },
	...(Array.isArray(config) ? config : [config]),
];
