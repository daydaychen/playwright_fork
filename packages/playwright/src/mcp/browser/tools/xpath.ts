/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { z } from '../../sdk/bundle';
import { defineTool } from './tool';

const getElementsByXPath = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_get_elements_by_xpath',
    title: 'Get Elements by XPath',
    description: 'Get elements on the page matching a given XPath expression. Returns a snapshot of the found elements.',
    inputSchema: z.object({
      xpath: z.string().describe('XPath expression to match elements.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const locator = context.currentTabOrDie().page.locator(`xpath=${params.xpath}`);
    response.addCode(`page.locator("xpath=${params.xpath}")`);

    try {
      const count = await locator.count();
      const limit = 10;
      if (count > limit)
        response.addResult(`Found ${count} elements matching the XPath expression. Showing first ${limit}.`);
      else
        response.addResult(`Found ${count} elements matching the XPath expression.`);

      const loopCount = Math.min(count, limit);
      for (let i = 0; i < loopCount; ++i) {
        const elementLocator = locator.nth(i);
        const snapshot = await elementLocator.ariaSnapshot();
        response.addResult(`Element ${i + 1}:\n${snapshot}`);
      }
    } catch (error) {
      const firstLine = error.message.split('\n')[0];
      response.addError(`Error evaluating XPath expression: ${firstLine}`);
    }
  },
});

export default [
  getElementsByXPath,
];
