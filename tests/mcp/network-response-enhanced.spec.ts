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

import { test, expect, parseResponse } from './fixtures';

test('browser_network_requests includes request_id', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api/data')">Fetch</button>
  `, 'text/html');

  server.setContent('/api/data', JSON.stringify({ result: 'success' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));

  // Should include request_id in brackets
  expect(response.result).toMatch(/\[[\w-]+\] \[GET\]/);
});

test('browser_network_requests includes request headers', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api/data', { headers: { 'X-Custom': 'test' } })">Fetch</button>
  `, 'text/html');

  server.setContent('/api/data', 'OK', 'text/plain');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));

  // Should include request_headers
  expect(response.result).toContain('request_headers:');
});

test('browser_network_requests includes request payload for POST', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify({ name: 'John', age: 30 }),
      headers: { 'Content-Type': 'application/json' }
    })">Submit</button>
  `, 'text/html');

  server.setContent('/api/submit', 'OK', 'text/plain');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Submit button', ref: 'e2' },
  });

  const response = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));

  // Should include request_payload for POST
  expect(response.result).toContain('request_payload:');
  expect(response.result).toContain('John');
});

test('browser_get_network_response retrieves JSON response', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api/data')">Fetch</button>
  `, 'text/html');

  server.setContent('/api/data', JSON.stringify({
    status: 'success',
    data: { id: 123, name: 'Test' }
  }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  // Get request list to extract request_id
  const requestsResponse = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));

  // Extract request_id from the response (format: [request_id] [METHOD] URL)
  const match = requestsResponse.result.match(/\[([\w-]+)\] \[GET\] .*\/api\/data/);
  expect(match).toBeTruthy();
  const requestId = match![1];

  // Get response body using request_id
  const response = parseResponse(await client.callTool({
    name: 'browser_get_network_response',
    arguments: { request_id: requestId },
  }));

  expect(response.result).toContain('status');
  expect(response.result).toContain('success');
  expect(response.result).toContain('Test');
});

test('browser_get_network_response retrieves text response', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api/text')">Fetch</button>
  `, 'text/html');

  server.setContent('/api/text', 'Plain text response', 'text/plain');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  const requestsResponse = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));

  const match = requestsResponse.result.match(/\[([\w-]+)\] \[GET\] .*\/api\/text/);
  expect(match).toBeTruthy();
  const requestId = match![1];

  const response = parseResponse(await client.callTool({
    name: 'browser_get_network_response',
    arguments: { request_id: requestId },
  }));

  expect(response.result).toContain('Plain text response');
});

test('browser_get_network_response handles non-existent request_id', async ({ client, server }) => {
  server.setContent('/', `<div>Content</div>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_network_response',
    arguments: { request_id: 'non-existent-id' },
  });

  expect(response.isError).toBe(true);
  expect(response.content).toContain('not found');
});

test('browser_get_network_response handles collected responses', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/api/data')">Fetch</button>
  `, 'text/html');

  server.setContent('/api/data', JSON.stringify({ data: 'test' }), 'application/json');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  const requestsResponse = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));

  const match = requestsResponse.result.match(/\[([\w-]+)\] \[GET\] .*\/api\/data/);
  expect(match).toBeTruthy();
  const requestId = match![1];

  // Clear network to trigger response collection
  await client.callTool({
    name: 'browser_network_clear',
  });

  // Try to get response after clearing
  const response = await client.callTool({
    name: 'browser_get_network_response',
    arguments: { request_id: requestId },
  });

  // Should handle gracefully (either return cached or indicate collected)
  expect(response.isError || response.content.includes('collected')).toBe(true);
});

test('browser_get_network_response truncates large responses', async ({ client, server }) => {
  const largeData = 'x'.repeat(200000);
  server.setContent('/', `
    <button onclick="fetch('/api/large')">Fetch</button>
  `, 'text/html');

  server.setContent('/api/large', largeData, 'text/plain');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  const requestsResponse = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));

  const match = requestsResponse.result.match(/\[([\w-]+)\] \[GET\] .*\/api\/large/);
  expect(match).toBeTruthy();
  const requestId = match![1];

  const response = parseResponse(await client.callTool({
    name: 'browser_get_network_response',
    arguments: { request_id: requestId },
  }));

  // Should be truncated
  expect(response.result.length).toBeLessThan(largeData.length);
  expect(response.result).toContain('...');
});

test('browser_get_network_response handles HTML responses', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/page.html')">Fetch</button>
  `, 'text/html');

  server.setContent('/page.html', '<html><body><h1>Title</h1></body></html>', 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  const requestsResponse = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));

  const match = requestsResponse.result.match(/\[([\w-]+)\] \[GET\] .*\/page\.html/);
  expect(match).toBeTruthy();
  const requestId = match![1];

  const response = parseResponse(await client.callTool({
    name: 'browser_get_network_response',
    arguments: { request_id: requestId },
  }));

  expect(response.result).toContain('<h1>Title</h1>');
});

test('browser_get_network_response handles failed requests', async ({ client, server }) => {
  server.setContent('/', `
    <button onclick="fetch('/nonexistent')">Fetch</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: { element: 'Fetch button', ref: 'e2' },
  });

  const requestsResponse = parseResponse(await client.callTool({
    name: 'browser_network_requests',
  }));

  const match = requestsResponse.result.match(/\[([\w-]+)\] \[GET\] .*\/nonexistent/);
  expect(match).toBeTruthy();
  const requestId = match![1];

  const response = await client.callTool({
    name: 'browser_get_network_response',
    arguments: { request_id: requestId },
  });

  // Should handle 404 gracefully
  expect(response.isError || response.content.includes('404')).toBe(true);
});
