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

import { z } from '../mcpBundle';
import { defineTool, defineTabTool } from './tool';

const navigate = defineTool({
  capability: 'core-navigation',

  schema: {
    name: 'browser_navigate',
    title: 'Navigate to a URL',
    description: `Navigate to a URL and return an ariaSnapshot of the page structure.

**About ariaSnapshot Output:**
The snapshot includes semantic roles and HTML attributes to help you locate elements:
- [tag=xxx]: HTML tag name (e.g., div, button, a)
- [id=xxx]: Element ID attribute (prefer stable, semantic IDs)
- [class=xxx]: CSS class names (prefer semantic classes, avoid auto-generated ones like css-1a2b3c)
- [data-*=xxx]: Data attributes (often stable and designed for testing/selection)
- [ref=xxx]: Internal reference for snapshot tracking (⚠️ DO NOT use in XPath - this is NOT a real DOM attribute)

**For XPath Generation:**
Use only real DOM attributes visible in the snapshot (id, class, data-*, tag names).
Prioritize stable attributes that won't change across page loads, user sessions, or dynamic updates.
The [ref=xxx] attribute is snapshot-specific and does not exist in the actual HTML DOM.`,
    inputSchema: z.object({
      url: z.string().describe('The URL to navigate to'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const tab = await context.ensureTab();
    let url = params.url;
    try {
      new URL(url);
    } catch (e) {
      if (url.startsWith('localhost'))
        url = 'http://' + url;
      else
        url = 'https://' + url;
    }

    await tab.navigate(url);

    response.setIncludeSnapshot();
    response.addCode(`await page.goto('${url}');`);
  },
});

const goBack = defineTabTool({
  capability: 'core-navigation',
  schema: {
    name: 'browser_navigate_back',
    title: 'Go back',
    description: 'Go back to the previous page in the history',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.goBack(tab.navigationTimeoutOptions);
    response.setIncludeSnapshot();
    response.addCode(`await page.goBack();`);
  },
});

const goForward = defineTabTool({
  capability: 'core-navigation',
  skillOnly: true,
  schema: {
    name: 'browser_navigate_forward',
    title: 'Go forward',
    description: 'Go forward to the next page in the history',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.goForward(tab.navigationTimeoutOptions);
    response.setIncludeSnapshot();
    response.addCode(`await page.goForward();`);
  },
});

const reload = defineTabTool({
  capability: 'core-navigation',
  skillOnly: true,
  schema: {
    name: 'browser_reload',
    title: 'Reload the page',
    description: 'Reload the current page',
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    await tab.page.reload(tab.navigationTimeoutOptions);
    response.setIncludeSnapshot();
    response.addCode(`await page.reload();`);
  },
});

export default [
  navigate,
  goBack,
  goForward,
  reload,
];
