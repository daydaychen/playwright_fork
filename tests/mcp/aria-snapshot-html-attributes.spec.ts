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

test('ariaSnapshot preserves generic nodes with id attribute', async ({ client, server }) => {
  server.setContent('/', `
    <div id="container">
      <div>Content without attributes</div>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_snapshot',
  });

  // Generic div with id should be preserved in snapshot
  expect(response.content).toContain('container');
});

test('ariaSnapshot preserves generic nodes with class attribute', async ({ client, server }) => {
  server.setContent('/', `
    <div class="main-content">
      <span>Text content</span>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_snapshot',
  });

  // Generic div with class should be preserved in snapshot
  expect(response.content).toContain('main-content');
});

test('ariaSnapshot preserves generic nodes with data attributes', async ({ client, server }) => {
  server.setContent('/', `
    <div data-testid="test-container">
      <button>Click me</button>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_snapshot',
  });

  // Generic div with data-* attribute should be preserved
  expect(response.content).toContain('test-container');
});

test('ariaSnapshot removes generic nodes without meaningful attributes', async ({ client, server }) => {
  server.setContent('/', `
    <div>
      <div>
        <button>Click me</button>
      </div>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_snapshot',
  });

  // Generic divs without attributes should be removed, button should be visible
  expect(response.content).toContain('button "Click me"');
  // Should not have excessive generic wrappers
  const genericCount = (response.content.match(/generic/g) || []).length;
  expect(genericCount).toBeLessThan(2);
});

test('ariaSnapshot handles mixed generic nodes', async ({ client, server }) => {
  server.setContent('/', `
    <div id="with-id">
      <div>
        <button>Button 1</button>
      </div>
    </div>
    <div>
      <div class="with-class">
        <button>Button 2</button>
      </div>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_snapshot',
  });

  // Divs with id/class should be preserved
  expect(response.content).toContain('with-id');
  expect(response.content).toContain('with-class');
  // Both buttons should be visible
  expect(response.content).toContain('Button 1');
  expect(response.content).toContain('Button 2');
});
