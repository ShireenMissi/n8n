import type {
	INodeExecutionData,
	IExecuteFunctions,
	INodeProperties,
	IDataObject,
	INode,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { SetNodeOptions } from './helpers/interfaces';
import { parseJsonParameter, composeReturnItem, resolveRawData } from './helpers/utils';
import { updateDisplayOptions } from '../../../utils/utilities';

const properties: INodeProperties[] = [
	{
		displayName: 'JSON',
		name: 'jsonOutput',
		type: 'json',
		typeOptions: { rows: 5 },
		default: '{\n  "my_field_1": "value",\n  "my_field_2": 1\n}\n',
		validateType: 'object',
		ignoreValidationDuringExecution: true,
	},
];

const displayOptions = { show: { mode: ['raw'] } };

export const description = updateDisplayOptions(displayOptions, properties);

/**
 * Parses the JSON output from raw data or node parameter.
 */
function getParsedJsonOutput(
	this: IExecuteFunctions,
	rawData: IDataObject,
	node: INode,
	index: number,
): IDataObject {
	const json = rawData.jsonOutput ?? (this.getNodeParameter('jsonOutput', index) as string);
	const resolvedJson = typeof json === 'string' ? resolveRawData.call(this, json, index) : json;
	return parseJsonParameter(resolvedJson, node, index);
}

export async function execute(
	this: IExecuteFunctions,
	item: INodeExecutionData,
	index: number,
	options: SetNodeOptions,
	rawData: IDataObject,
	node: INode,
) {
	try {
		const newData = getParsedJsonOutput.call(this, rawData, node, index);
		return composeReturnItem.call(this, index, item, newData, options, node.typeVersion);
	} catch (error) {
		const errorMessage = (error as Error).message;
		if (this.continueOnFail()) {
			return { json: { error: errorMessage }, pairedItem: { item: index } };
		}
		throw new NodeOperationError(node, error as Error, { itemIndex: index });
	}
}
