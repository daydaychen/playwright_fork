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
import { z } from 'playwright-core/lib/mcpBundle';
import { defineTabTool } from './tool';

import type * as playwright from 'playwright-core';
import type { Request } from '../../../../../playwright-core/src/client/network';

const requests = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_network_requests',
    title: 'List network requests',
    description: 'Returns all network requests since loading the page as a JSONL stream.',
    inputSchema: z.object({
      includeStatic: z.boolean().default(false).describe('Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const requests = await tab.requests();
    for (const request of requests) {
      const rendered = await renderRequest(request, params.includeStatic);
      if (rendered)
        response.addResult(rendered);
    }
  },
});

async function renderRequest(request: playwright.Request, includeStatic: boolean): Promise<string | undefined> {
  const response = (request as Request)._hasResponse ? await request.response() : undefined;
  const isStaticRequest = ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'manifest'].includes(request.resourceType());
  const isSuccessfulRequest = !response || response.status() < 400;

  if (isStaticRequest && isSuccessfulRequest && !includeStatic)
    return undefined;

  const result: string[] = [];
  const postData = request.postData();
  const requestHeaders = request.headers();
  const responseHeaders = response ? await response.allHeaders() : {};

  const filterResponseHeaders = (headers: { [key: string]: any }) => {
    const filtered: { [key: string]: any } = {};
    for (const [name, value] of Object.entries(headers)) {
      const lname = name.toLowerCase();
      if (lname.startsWith('x-') || lname.startsWith('access-'))
        continue;
      filtered[name] = value;
    }
    return filtered;
  };

  const filterRequestHeaders = (headers: { [key: string]: any }) => {
    const filtered: { [key: string]: any } = {};
    for (const [name, value] of Object.entries(headers)) {
      const lname = name.toLowerCase();
      if (lname === 'user-agent' || lname.startsWith('sec-'))
        continue;
      filtered[name] = value;
    }
    return filtered;
  };

  result.push(`[${(request as any)._guid}] [${request.method().toUpperCase()}] ${request.url()}`);
  result.push(`request_headers: ${JSON.stringify(filterRequestHeaders(requestHeaders))}`);
  if (postData)
    result.push(`request_payload: ${postData.substring(0, 300)}`);
  if (response)
    result.push(`=> ${response.status()} ${response.statusText()}`);
  if (responseHeaders)
    result.push(`response_headers: ${JSON.stringify(filterResponseHeaders(responseHeaders))}`);
  return result.join(' ');
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
      request_id: z.string().describe('The ID of the request from browser_network_requests (example: request@xxxx).'),
    }),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    const { request_id } = params;
    let request: playwright.Request | undefined;
    for (const req of await tab.requests()) {
      if ((req as any)._guid === request_id) {
        request = req;
        break;
      }
    }

    if (!request) {
      response.addError(`Request with id ${request_id} not found.`);
      return;
    }

    const res = (request as Request)._hasResponse ? await request.response() : undefined;
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
