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

import { test, expect } from './fixtures';

test('browser_get_elements_by_xpath - element selection', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <button id="submit">Submit</button>
        <button id="cancel">Cancel</button>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//button[@id="submit"]' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('Found 1 element'),
  });
  expect(response.content).toContain('button "Submit"');
});

test('browser_get_elements_by_xpath - text extraction', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div class="price">$19.99</div>
        <div class="price">$29.99</div>
        <div class="price">$39.99</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//div[@class="price"]/text()' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('$19.99'),
  });
  expect(response.content).toContain('$29.99');
  expect(response.content).toContain('$39.99');
});

test('browser_get_elements_by_xpath - attribute extraction', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <a href="https://example.com">Example</a>
        <a href="https://test.com">Test</a>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//a/@href' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('https://example.com'),
  });
  expect(response.content).toContain('https://test.com');
});

test('browser_get_elements_by_xpath - multiple elements', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div class="card">Card 1</div>
        <div class="card">Card 2</div>
        <div class="card">Card 3</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//div[@class="card"]' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('Found 3 elements'),
  });
});

test('browser_get_elements_by_xpath - no results', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div>Content</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//button[@id="nonexistent"]' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('Found 0 elements'),
  });
  expect(response.content).toContain('Common causes:');
  expect(response.content).toContain('Suggestions:');
});

test('browser_get_elements_by_xpath - contains function', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div class="main-content">Main</div>
        <div class="sidebar-content">Sidebar</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//div[contains(@class, "main")]' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('Found 1 element'),
  });
  expect(response.content).toContain('Main');
});

test('browser_get_elements_by_xpath - starts-with function', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <a href="https://example.com">External 1</a>
        <a href="https://test.com">External 2</a>
        <a href="/internal">Internal</a>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//a[starts-with(@href, "https")]/@href' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('https://example.com'),
  });
  expect(response.content).toContain('https://test.com');
  expect(response.content).not.toContain('/internal');
});

test('browser_get_elements_by_xpath - nested extraction', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div class="product">
          <span class="name">Product 1</span>
          <span class="price">$10</span>
        </div>
        <div class="product">
          <span class="name">Product 2</span>
          <span class="price">$20</span>
        </div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//div[@class="product"]/span[@class="price"]/text()' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('$10'),
  });
  expect(response.content).toContain('$20');
});

test('browser_get_elements_by_xpath - with base_xpath', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div id="container1">
          <span>Container 1 Text</span>
        </div>
        <div id="container2">
          <span>Container 2 Text</span>
        </div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: {
      base_xpath: '//div[@id="container1"]',
      xpath: './/span/text()'
    },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('Container 1 Text'),
  });
  expect(response.content).not.toContain('Container 2 Text');
});

test('browser_get_elements_by_xpath - data attributes', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div data-product-id="123">Product A</div>
        <div data-product-id="456">Product B</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//div[@data-product-id="123"]/text()' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('Product A'),
  });
  expect(response.content).not.toContain('Product B');
});

test('browser_get_elements_by_xpath - metadata extraction', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <meta property="og:title" content="Page Title">
        <meta property="og:description" content="Page Description">
      </head>
      <body></body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//meta[@property="og:title"]/@content' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('Page Title'),
  });
});

test('browser_get_elements_by_xpath - invalid xpath', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div>Content</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//div[invalid' },
  });

  expect(response.isError).toBe(true);
  expect(response.content).toContain('Invalid XPath');
});

test('browser_get_elements_by_xpath - truncation for many results', async ({ client, server }) => {
  const items = Array.from({ length: 50 }, (_, i) => `<div class="item">Item ${i}</div>`).join('');
  server.setContent('/', `
    <html>
      <body>${items}</body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_elements_by_xpath',
    arguments: { xpath: '//div[@class="item"]' },
  });

  expect(response).toHaveResponse({
    result: expect.stringContaining('Found 50 elements'),
  });
  // Should show truncation message
  expect(response.content).toContain('first 10');
});
