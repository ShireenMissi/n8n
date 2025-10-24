import type {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	IHttpRequestMethods,
	INode,
	IDataObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { affinityApiRequest, affinityApiRequestAllItems, eventsExist, mapResource } from '../GenericFunctions';

export const node: INode = {
	id: 'c4a5ca75-18c7-4cc8-bf7d-5d57bb7d84da',
	name: 'Affinity',
	type: 'n8n-nodes-base.affinity',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

describe('Affinity > GenericFunctions', () => {
	const mockExecuteFunctions: any = {
		helpers: {
			request: jest.fn(),
		},
		getCredentials: jest.fn().mockResolvedValue({
			apiKey: 'test-api-key',
		}),
		getNode: jest.fn().mockReturnValue(node),
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('affinityApiRequest', () => {
		it('should make a successful API request', async () => {
			const mockResponse = { success: true, data: 'test' };
			mockExecuteFunctions.helpers.request.mockResolvedValue(mockResponse);

			const result = await affinityApiRequest.call(
				mockExecuteFunctions,
				'GET',
				'/test-endpoint',
			);

			expect(result).toEqual(mockResponse);
			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith({
				headers: {
					'Content-Type': 'application/json',
					Authorization: expect.stringContaining('Basic'),
				},
				method: 'GET',
				uri: 'https://api.affinity.co/test-endpoint',
				json: true,
			});
		});

		it('should throw NodeApiError on API failure', async () => {
			const mockError = { error: 'API Error', statusCode: 400 };
			mockExecuteFunctions.helpers.request.mockRejectedValue(mockError);

			await expect(
				affinityApiRequest.call(mockExecuteFunctions, 'GET', '/test-endpoint'),
			).rejects.toThrow(NodeApiError);
		});

		it('should handle query parameters and body', async () => {
			const mockResponse = { success: true };
			mockExecuteFunctions.helpers.request.mockResolvedValue(mockResponse);

			const body = { field: 'value' };
			const query = { param: 'test' };

			await affinityApiRequest.call(
				mockExecuteFunctions,
				'POST',
				'/test-endpoint',
				body,
				query,
			);

			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledWith({
				headers: {
					'Content-Type': 'application/json',
					Authorization: expect.stringContaining('Basic'),
				},
				method: 'POST',
				body,
				qs: query,
				uri: 'https://api.affinity.co/test-endpoint',
				json: true,
			});
		});
	});

	describe('affinityApiRequestAllItems', () => {
		it('should fetch all items across multiple pages', async () => {
			const mockResponse1 = {
				page_token: 'token123',
				items: [{ id: 1 }, { id: 2 }],
			};
			const mockResponse2 = {
				page_token: null,
				items: [{ id: 3 }, { id: 4 }],
			};

			mockExecuteFunctions.helpers.request
				.mockResolvedValueOnce(mockResponse1)
				.mockResolvedValueOnce(mockResponse2);

			const result = await affinityApiRequestAllItems.call(
				mockExecuteFunctions,
				'items',
				'GET',
				'/test-endpoint',
			);

			expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledTimes(2);
		});

		it('should handle single page response', async () => {
			const mockResponse = {
				page_token: null,
				items: [{ id: 1 }],
			};

			mockExecuteFunctions.helpers.request.mockResolvedValue(mockResponse);

			const result = await affinityApiRequestAllItems.call(
				mockExecuteFunctions,
				'items',
				'GET',
				'/test-endpoint',
			);

			expect(result).toEqual([{ id: 1 }]);
			expect(mockExecuteFunctions.helpers.request).toHaveBeenCalledTimes(1);
		});
	});

	describe('eventsExist', () => {
		it('should return true when all current subscriptions exist in subscriptions', () => {
			const subscriptions = ['event1', 'event2', 'event3'];
			const currentSubscriptions = ['event1', 'event2'];

			const result = eventsExist(subscriptions, currentSubscriptions);

			expect(result).toBe(true);
		});

		it('should return false when a current subscription does not exist in subscriptions', () => {
			const subscriptions = ['event1', 'event2'];
			const currentSubscriptions = ['event1', 'event3'];

			const result = eventsExist(subscriptions, currentSubscriptions);

			expect(result).toBe(false);
		});

		it('should return true for empty current subscriptions', () => {
			const subscriptions = ['event1', 'event2'];
			const currentSubscriptions: string[] = [];

			const result = eventsExist(subscriptions, currentSubscriptions);

			expect(result).toBe(true);
		});
	});

	describe('mapResource', () => {
		it('should map person to persons', () => {
			expect(mapResource('person')).toBe('persons');
		});

		it('should map list to lists', () => {
			expect(mapResource('list')).toBe('lists');
		});

		it('should map note to notes', () => {
			expect(mapResource('note')).toBe('notes');
		});

		it('should map organization to organizatitons', () => {
			expect(mapResource('organization')).toBe('organizatitons');
		});

		it('should map list_entry to list-entries', () => {
			expect(mapResource('list_entry')).toBe('list-entries');
		});

		it('should map field to fields', () => {
			expect(mapResource('field')).toBe('fields');
		});

		it('should map file to files', () => {
			expect(mapResource('file')).toBe('files');
		});

		it('should map field_value to field-values', () => {
			expect(mapResource('field_value')).toBe('field-values');
		});

		it('should return undefined for unknown resource', () => {
			expect(mapResource('unknown')).toBeUndefined();
		});

		it('should handle all supported resource types', () => {
			const supportedResources = [
				{ key: 'person', expected: 'persons' },
				{ key: 'list', expected: 'lists' },
				{ key: 'note', expected: 'notes' },
				{ key: 'organization', expected: 'organizatitons' },
				{ key: 'list_entry', expected: 'list-entries' },
				{ key: 'field', expected: 'fields' },
				{ key: 'file', expected: 'files' },
				{ key: 'field_value', expected: 'field-values' },
			];

			supportedResources.forEach(({ key, expected }) => {
				expect(mapResource(key)).toBe(expected);
			});
		});
	});
});