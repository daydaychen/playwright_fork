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
import type { Locator } from 'playwright-core';

const XPATH_TROUBLESHOOTING_TIP = `**Troubleshooting Tip:** This can happen if the XPath expression does not select an element node. For example, expressions ending in '/text()', '/@attribute', or using functions like 'string()' will not return elements that a locator can use. Please ensure your XPath points to one or more elements.`;

const getElementsByXPath = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_get_elements_by_xpath',
    title: 'Get Elements by XPath',
    description: 'Get elements on the page matching a given XPath expression. Returns a snapshot of the found elements. Important: The XPath should resolve to a list of web elements, not text, attributes, or other values. For example, do not use \'/text()\', \'/@attribute\', or \'string()\' in the expression.',
    inputSchema: z.object({
      base_xpath: z.string().optional().describe('Base XPath expression to start the search from. If not provided, the search starts from the document root.'),
      xpath: z.string().describe('XPath expression to match elements.'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const page = context.currentTabOrDie().page;

    const getLocatorCount = async (locator: Locator): Promise<number | null> => {
      try {
        const count = await locator.count();
        if (count === 0) {
          response.addResult(`Found 0 elements for ${locator.toString()}\n\n${XPATH_TROUBLESHOOTING_TIP}`);
          return null;
        }
        return count;
      } catch (error) {
        const firstLine = error.message.split('\n')[0];
        response.addError(`Error evaluating ${locator.toString()}: ${firstLine}.`);
        return null;
      }
    };

    const snapshotter = async (locator: Locator, count: number) => {
      const limit = 10;
      if (count > limit)
        response.addResult(`Found ${count} final elements. Showing first ${limit}.`);
      else
        response.addResult(`Found ${count} final elements.`);

      const loopCount = Math.min(count, limit);
      for (let i = 0; i < loopCount; ++i) {
        const elementLocator = locator.nth(i);
        const snapshot = await elementLocator.ariaSnapshot();
        response.addResult(`Element ${i + 1}:\n${snapshot}`);
      }
    };

    const processXpathChain = async (xpaths: string[], baseLocator?: Locator) => {
      const currentXpath = xpaths[0];
      const remainingXpaths = xpaths.slice(1);

      const isBase = !baseLocator;
      const locator = isBase ? page.locator(`xpath=${currentXpath}`) : baseLocator!.locator(`xpath=${currentXpath}`);

      const code = isBase
        ? `page.locator(${JSON.stringify('xpath=' + currentXpath)})`
        : `.locator(${JSON.stringify('xpath=' + currentXpath)})`;
      response.addCode(code);

      const count = await getLocatorCount(locator);
      if (count === null)
        return;

      if (remainingXpaths.length > 0) {
        response.addResult(`Found ${count} base elements. Now searching within them...`);
        await processXpathChain(remainingXpaths, locator);
      } else {
        await snapshotter(locator, count);
      }
    };

    const xpathsToProcess = params.base_xpath ? [params.base_xpath, params.xpath] : [params.xpath];
    await processXpathChain(xpathsToProcess);
  },
});

export default [
  getElementsByXPath,
];
