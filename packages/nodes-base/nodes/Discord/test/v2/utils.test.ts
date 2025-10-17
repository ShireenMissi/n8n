import type { IExecuteFunctions, INode, INodeExecutionData, IBinaryKeyData } from 'n8n-workflow';

import * as transport from '../../v2//transport/discord.api';
import {
	createSimplifyFunction,
	prepareOptions,
	prepareEmbeds,
	checkAccessToGuild,
	setupChannelGetter,
	prepareMultiPartForm,
} from '../../v2/helpers/utils';

const node: INode = {
	id: '1',
	name: 'Discord node',
	typeVersion: 2,
	type: 'n8n-nodes-base.discord',
	position: [60, 760],
	parameters: {
		resource: 'channel',
		operation: 'get',
	},
};

describe('Test Discord > createSimplifyFunction', () => {
	it('should create function', () => {
		const result = createSimplifyFunction(['message_reference']);
		expect(result).toBeDefined();
		expect(typeof result).toBe('function');
	});

	it('should return object containing only specified fields', () => {
		const simplify = createSimplifyFunction(['id', 'name']);
		const data = {
			id: '123',
			name: 'test',
			type: 'test',
			randomField: 'test',
		};
		const result = simplify(data);
		expect(result).toEqual({
			id: '123',
			name: 'test',
		});
	});
});

describe('Test Discord > prepareOptions', () => {
	it('should return correct flag value', () => {
		const result = prepareOptions({
			flags: ['SUPPRESS_EMBEDS', 'SUPPRESS_NOTIFICATIONS'],
		});
		expect(result.flags).toBe((1 << 2) + (1 << 12));
	});

	it('should convert message_reference', () => {
		const result = prepareOptions(
			{
				message_reference: '123456',
			},
			'789000',
		);
		expect(result.message_reference).toEqual({
			message_id: '123456',
			guild_id: '789000',
		});
	});
});

describe('Test Discord > prepareEmbeds', () => {
	it('should return return empty object removing empty strings', () => {
		const embeds = [
			{
				test1: 'test',
				test2: 'test',
				description: 'test',
			},
		];

		const executeFunction = {};

		const result = prepareEmbeds.call(executeFunction as unknown as IExecuteFunctions, embeds);

		expect(result).toEqual(embeds);
	});
});

describe('Test Discord > checkAccessToGuild', () => {
	it('should throw error', () => {
		const guildId = '123456';
		const guilds = [
			{
				id: '789000',
			},
		];

		expect(() => {
			checkAccessToGuild(node, guildId, guilds);
		}).toThrow('You do not have access to the guild with the id 123456');
	});

	it('should pass', () => {
		const guildId = '123456';
		const guilds = [
			{
				id: '123456',
			},
			{
				id: '789000',
			},
		];

		expect(() => {
			checkAccessToGuild(node, guildId, guilds);
		}).not.toThrow();
	});
});

describe('Test Discord > setupChannelGetter & checkAccessToChannel', () => {
	const discordApiRequestSpy = jest.spyOn(transport, 'discordApiRequest');
	discordApiRequestSpy.mockImplementation(async (method: string) => {
		if (method === 'GET') {
			return {
				guild_id: '123456',
			};
		}
	});

	it('should setup channel getter and get channel id', async () => {
		const fakeExecuteFunction = (auth: string) => {
			return {
				getNodeParameter: (parameter: string) => {
					if (parameter === 'authentication') return auth;
					if (parameter === 'channelId') return '42';
				},
				getNode: () => node,
			} as unknown as IExecuteFunctions;
		};

		const userGuilds = [
			{
				id: '789000',
			},
		];

		try {
			const getChannel = await setupChannelGetter.call(fakeExecuteFunction('oAuth2'), userGuilds);
			await getChannel(0);
		} catch (error) {
			expect(error.message).toBe('You do not have access to the guild with the id 123456');
		}

		const getChannel = await setupChannelGetter.call(fakeExecuteFunction('botToken'), userGuilds);
		const channelId = await getChannel(0);
		expect(channelId).toBe('42');
	});
});

describe('Test Discord > prepareMultiPartForm', () => {
	const mockBinaryData = Buffer.from('test file content');
	
	const mockExecuteFunctions = {
		getNode: () => node,
		helpers: {
			getBinaryDataBuffer: jest.fn().mockResolvedValue(mockBinaryData),
		},
	} as unknown as IExecuteFunctions;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should correctly map contentType and filename in multipart form', async () => {
		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: <IBinaryKeyData>{
					file1: {
						fileName: 'test-document.pdf',
						mimeType: 'application/pdf',
						fileExtension: 'pdf',
						data: 'base64data',
					},
				},
			},
		];

		const files = [{ inputFieldName: 'file1' }];
		const jsonPayload = { content: 'Test message' };

		const result = await prepareMultiPartForm.call(mockExecuteFunctions, items, files, jsonPayload, 0);

		expect(result).toBeDefined();
		expect(mockExecuteFunctions.helpers.getBinaryDataBuffer).toHaveBeenCalledWith(0, 'file1');
		
		// Verify the form data contains correct payload
		const payloadJson = result.getBuffer('payload_json');
		expect(payloadJson).toBeDefined();
		
		const payload = JSON.parse(payloadJson.toString());
		expect(payload.content).toBe('Test message');
		expect(payload.attachments).toEqual([
			{
				id: 0,
				filename: 'test-document.pdf',
			},
		]);
	});

	it('should handle files without extension by adding it from mimeType', async () => {
		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: <IBinaryKeyData>{
					file1: {
						fileName: 'document',
						mimeType: 'image/png',
						data: 'base64data',
					},
				},
			},
		];

		const files = [{ inputFieldName: 'file1' }];
		const jsonPayload = { content: 'Test message' };

		const result = await prepareMultiPartForm.call(mockExecuteFunctions, items, files, jsonPayload, 0);

		const payloadJson = result.getBuffer('payload_json');
		const payload = JSON.parse(payloadJson.toString());
		
		expect(payload.attachments[0].filename).toBe('document.png');
	});

	it('should handle files with fileExtension property', async () => {
		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: <IBinaryKeyData>{
					file1: {
						fileName: 'document',
						mimeType: 'application/pdf',
						fileExtension: 'pdf',
						data: 'base64data',
					},
				},
			},
		];

		const files = [{ inputFieldName: 'file1' }];
		const jsonPayload = { content: 'Test message' };

		const result = await prepareMultiPartForm.call(mockExecuteFunctions, items, files, jsonPayload, 0);

		const payloadJson = result.getBuffer('payload_json');
		const payload = JSON.parse(payloadJson.toString());
		
		expect(payload.attachments[0].filename).toBe('document.pdf');
	});

	it('should throw error when binary data is missing', async () => {
		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: <IBinaryKeyData>{},
			},
		];

		const files = [{ inputFieldName: 'file1' }];
		const jsonPayload = { content: 'Test message' };

		await expect(
			prepareMultiPartForm.call(mockExecuteFunctions, items, files, jsonPayload, 0)
		).rejects.toThrow('Input item [0] does not contain binary data on property file1');
	});

	it('should handle multiple files with correct contentType and filename mapping', async () => {
		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: <IBinaryKeyData>{
					file1: {
						fileName: 'document.pdf',
						mimeType: 'application/pdf',
						data: 'base64data1',
					},
					file2: {
						fileName: 'image.jpg',
						mimeType: 'image/jpeg',
						data: 'base64data2',
					},
				},
			},
		];

		const files = [
			{ inputFieldName: 'file1' },
			{ inputFieldName: 'file2' },
		];
		const jsonPayload = { content: 'Test message with multiple files' };

		const result = await prepareMultiPartForm.call(mockExecuteFunctions, items, files, jsonPayload, 0);

		const payloadJson = result.getBuffer('payload_json');
		const payload = JSON.parse(payloadJson.toString());
		
		expect(payload.attachments).toHaveLength(2);
		expect(payload.attachments[0]).toEqual({
			id: 0,
			filename: 'document.pdf',
		});
		expect(payload.attachments[1]).toEqual({
			id: 1,
			filename: 'image.jpg',
		});
		
		expect(mockExecuteFunctions.helpers.getBinaryDataBuffer).toHaveBeenCalledTimes(2);
		expect(mockExecuteFunctions.helpers.getBinaryDataBuffer).toHaveBeenCalledWith(0, 'file1');
		expect(mockExecuteFunctions.helpers.getBinaryDataBuffer).toHaveBeenCalledWith(0, 'file2');
	});
});
