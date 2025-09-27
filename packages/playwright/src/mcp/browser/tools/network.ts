/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { isJsonMimeType, isTextualMimeType } from 'playwright-core/lib/utils';
import { z } from '../../sdk/bundle';
import { defineTabTool } from './tool';


import type * as playwright from 'playwright-core';

const requests = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page as a JSONL stream.',
    inputSchema: z.object({
      methods: z.array(z.string()).optional().default([]).describe('Filter by HTTP method (e.g., GET, POST)'),
      resourceTypes: z.array(z.string()).optional().default(['xhr', 'fetch', 'document']).describe('Filter by resource type (e.g., document, script, image)')
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const allRequests = [...tab.requests().entries()];
    let filteredRequests = allRequests;

    if (params.methods.length > 0 || params.resourceTypes.length > 0) {
      filteredRequests = filteredRequests.filter(([req]) => {
        if (params.methods.length > 0 && params.methods.includes(req.method()))
          return true;

        if (params.resourceTypes.length > 0 && params.resourceTypes.includes(req.resourceType()))
          return true;

        return false;
      });
    }

    const results = await Promise.all(filteredRequests.map(([req, res]) => renderRequest(req, res)));
    for (const result of results)
      response.addResult(JSON.stringify(result));
  },
});

async function renderRequest(request: playwright.Request, response: playwright.Response | null) {
  const postData = request.postData();
  return {
    id: (request as any)._guid,
    method: request.method(),
    url: request.url(),
    status: response ? response.status() : undefined,
    resourceType: request.resourceType(),
    request_body_snippet: postData ? postData.substring(0, 300) : null,
    response_headers: response ? await response.allHeaders() : {},
  };
}

function truncateText(body: Buffer): string {
  const maxBodySize = 2048;
  if (body.length > maxBodySize)
    return body.slice(0, maxBodySize).toString('utf-8') + `\n\n... (response body truncated, size: ${body.length} bytes)`;
  return body.toString('utf-8');
}

function truncateJson(value: any, options: { maxArrayLength: number, maxStringLength: number }): any {
  if (value === null || typeof value !== 'object')
    return value;

  if (Array.isArray(value)) {
    if (value.length > options.maxArrayLength) {
      const truncated = value.slice(0, options.maxArrayLength).map(item => truncateJson(item, options));
      truncated.push(`... (truncated, original length: ${value.length})`);
      return truncated;
    }
    return value.map(item => truncateJson(item, options));
  }

  const newObj: { [key: string]: any } = {};
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const propValue = value[key];
      if (typeof propValue === 'string' && propValue.length > options.maxStringLength)
        newObj[key] = propValue.substring(0, options.maxStringLength) + `... (string truncated, original length: ${propValue.length})`;
      else
        newObj[key] = truncateJson(propValue, options);
    }
  }
  return newObj;
}

const getResponse = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_get_network_response',
    title: 'Get network response body',
    description: 'Returns the full response body for a given network request ID. It automatically handles different content types, returning images directly and formatting JSON.',
    inputSchema: z.object({
      request_id: z.string().describe('The ID of the request from browser_network_requests (this is the internal _guid of the request).'),
    }),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    const { request_id } = params;
    let requestEntry: [playwright.Request, playwright.Response | null] | undefined;
    for (const entry of tab.requests().entries()) {
      if ((entry[0] as any)._guid === request_id) {
        requestEntry = entry;
        break;
      }
    }

    if (!requestEntry) {
      response.addError(`Request with id ${request_id} not found.`);
      return;
    }

    const [, res] = requestEntry;
    if (!res) {
      response.addError(`Request with id ${request_id} does not have a response.`);
      return;
    }

    try {
      const headers = await res.allHeaders();
      const contentType = (headers['content-type'] || '').toLowerCase();

      if (isJsonMimeType(contentType)) {
        try {
          const json = await res.json();
          const truncated = truncateJson(json, { maxArrayLength: 5, maxStringLength: 300 });
          let resultString = JSON.stringify(truncated);
          const maxJsonSize = 8192; // 8KB for JSON
          if (resultString.length > maxJsonSize)
            resultString = resultString.substring(0, maxJsonSize) + `\n\n... (JSON response truncated, total size: ${resultString.length} bytes)`;
          response.addResult(resultString);
        } catch (e) {
          response.addResult(truncateText(await res.body()));
        }
      } else if (isTextualMimeType(contentType)) {
        response.addResult(truncateText(await res.body()));
      } else if (contentType.startsWith('image/')) {
        const buffer = await res.body();
        response.addImage({ contentType, data: buffer });
      } else {
        response.addResult(`Response body is binary content of type "${contentType}" and cannot be displayed as text.`);
      }
    } catch (e: any) {
      response.addError(`Could not retrieve body for request ${request_id}: ${e.message}`);
    }
  },
});

export default [
  requests,
  getResponse,
];
