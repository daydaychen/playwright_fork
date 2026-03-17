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

test('browser_get_html with default options', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <title>Test Page</title>
        <style>.test { color: red; }</style>
        <script>console.log('test');</script>
      </head>
      <body>
        <!-- This is a comment -->
        <div class="content">Hello World</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_html',
    arguments: {},
  });

  expect(response).toHaveResponse({
    html: expect.stringContaining('Hello World'),
  });

  // Default: styles removed, comments removed, scripts kept
  expect(response.content).not.toContain('<style>');
  expect(response.content).not.toContain('<!-- This is a comment -->');
  expect(response.content).toContain('<script>');
});

test('browser_get_html with removeScripts', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <script>console.log('test');</script>
      </head>
      <body>
        <div>Content</div>
        <script>alert('inline');</script>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_html',
    arguments: { removeScripts: true },
  });

  expect(response).toHaveResponse({
    html: expect.stringContaining('Content'),
  });

  expect(response.content).not.toContain('<script>');
  expect(response.content).not.toContain('console.log');
  expect(response.content).not.toContain('alert');
});

test('browser_get_html with removeStyles', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <style>.test { color: red; }</style>
      </head>
      <body>
        <div style="color: blue;">Styled Content</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_html',
    arguments: {
      removeStyles: true,
      removeInlineStyles: true
    },
  });

  expect(response).toHaveResponse({
    html: expect.stringContaining('Styled Content'),
  });

  expect(response.content).not.toContain('<style>');
  expect(response.content).not.toContain('style="');
});

test('browser_get_html with removeComments', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <!-- Comment 1 -->
        <div>Content</div>
        <!-- Comment 2 -->
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_html',
    arguments: { removeComments: true },
  });

  expect(response).toHaveResponse({
    html: expect.stringContaining('Content'),
  });

  expect(response.content).not.toContain('<!-- Comment 1 -->');
  expect(response.content).not.toContain('<!-- Comment 2 -->');
});

test('browser_get_html with removeMeta', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="description" content="Test">
        <title>Test</title>
      </head>
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
    name: 'browser_get_html',
    arguments: { removeMeta: true },
  });

  expect(response).toHaveResponse({
    html: expect.stringContaining('Content'),
  });

  expect(response.content).not.toContain('<meta');
});

test('browser_get_html with removeSvg', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div>Content</div>
        <svg width="100" height="100">
          <circle cx="50" cy="50" r="40" />
        </svg>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_html',
    arguments: { removeSvg: true },
  });

  expect(response).toHaveResponse({
    html: expect.stringContaining('Content'),
  });

  expect(response.content).not.toContain('<svg');
  expect(response.content).not.toContain('<circle');
});

test('browser_get_html with minify', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div>
          Content with
          multiple lines
        </div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const responseMinified = await client.callTool({
    name: 'browser_get_html',
    arguments: { minify: true },
  });

  const responseNotMinified = await client.callTool({
    name: 'browser_get_html',
    arguments: { minify: false },
  });

  // Minified version should be shorter
  expect(responseMinified.content.length).toBeLessThan(responseNotMinified.content.length);
});

test('browser_get_html with maxLength', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div>${'x'.repeat(1000)}</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_html',
    arguments: { maxLength: 500 },
  });

  expect(response.content.length).toBeLessThanOrEqual(500);
  expect(response.content).toContain('...');
});

test('browser_get_html_with_locator', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div class="header">Header Content</div>
        <div class="main">
          <style>.test { color: red; }</style>
          <script>console.log('test');</script>
          Main Content
        </div>
        <div class="footer">Footer Content</div>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_html_with_locator',
    arguments: {
      locator: '.main',
      removeScripts: true,
      removeStyles: true
    },
  });

  expect(response).toHaveResponse({
    html: expect.stringContaining('Main Content'),
  });

  // Should only contain main div content
  expect(response.content).not.toContain('Header Content');
  expect(response.content).not.toContain('Footer Content');
  expect(response.content).not.toContain('<script>');
  expect(response.content).not.toContain('<style>');
});

test('browser_get_html with all cleaning options', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <meta charset="utf-8">
        <title>Test</title>
        <style>.test { color: red; }</style>
        <script>console.log('test');</script>
      </head>
      <body>
        <!-- Comment -->
        <div style="color: blue;">
          Content
        </div>
        <svg><circle /></svg>
      </body>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_get_html',
    arguments: {
      removeScripts: true,
      removeStyles: true,
      removeInlineStyles: true,
      removeComments: true,
      removeMeta: true,
      removeSvg: true,
      minify: true
    },
  });

  expect(response).toHaveResponse({
    html: expect.stringContaining('Content'),
  });

  // All noise should be removed
  expect(response.content).not.toContain('<script>');
  expect(response.content).not.toContain('<style>');
  expect(response.content).not.toContain('style="');
  expect(response.content).not.toContain('<!--');
  expect(response.content).not.toContain('<meta');
  expect(response.content).not.toContain('<svg');
});
