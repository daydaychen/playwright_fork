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

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTool } from './tool';
import type { Locator } from 'playwright-core';

const XPATH_TROUBLESHOOTING_TIP = `**Troubleshooting: Found 0 Elements**

Common causes and solutions:

1. **XPath returns non-element values:**
   ❌ //div[@class='title']/text()  (returns text node, not element)
   ❌ //a/@href                      (returns attribute, not element)
   ❌ //span[string()]                (returns string, not element)
   ✅ //div[@class='title']          (returns element)
   ✅ //a                             (returns element, extract href later)

2. **Using snapshot-specific attributes:**
   ❌ //div[@ref='e123']             (ref doesn't exist in real DOM)
   ✅ //div[@id='container']         (use real DOM attributes)
   ✅ //div[contains(@class, 'card')] (use actual class names)

3. **Unstable or incorrect selectors:**
   - Class name changed or doesn't exist
   - Element is inside iframe or shadow DOM
   - Element hasn't loaded yet (try waiting or simpler path)
   - Typo in attribute name or value

4. **Overly specific paths:**
   ❌ //div[1]/div[2]/span[3]        (brittle index-based path)
   ✅ //div[contains(@class, 'container')]//span[@data-id='title']

**Next steps:** Check the page snapshot to verify the element exists and use actual DOM attributes visible in the snapshot.`;

const getElementsByXPath = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_get_elements_by_xpath',
    title: 'Get Elements by XPath',
    description: `Get elements on the page matching an XPath expression. Returns an ariaSnapshot of the found elements.

**XPath Best Practices:**

1. **Attribute Priority** (use in this order):
   - Stable IDs: //button[@id='submit-btn']
   - Data attributes: //div[@data-test='login-form']
   - Semantic classes (with contains): //nav[contains(@class, 'main-nav')]
   - Fixed text content: //button[text()='Submit'] (use cautiously - only for truly stable text)

2. **Use contains() for class matching** (classes often have multiple values):
   ✅ //div[contains(@class, 'product-card')]
   ❌ //div[@class='product-card featured active']

3. **Use // for descendant selection** (handles DOM structure changes):
   ✅ //div[contains(@class, 'container')]//button[@id='submit']
   ❌ //div[@class='container']/div/div/div/button[@id='submit']

4. **Avoid unstable patterns:**
   - Random IDs: @id='comp-k1a2b3c' or @id='uuid-xxx'
   - Generated classes: @class='css-1x2y3z' or @class='makeStyles-root-123'
   - Dynamic content: text()='Count: 123', text()='$99.99', text()='2024-01-15'
   - Index-based paths: //div[3]/span[2] (brittle and breaks easily)
   - Snapshot refs: @ref='e123' (ref attributes don't exist in real DOM)

5. **Combine conditions when needed for uniqueness:**
   //form[@data-form='login']//input[@type='email']
   //ul[contains(@class, 'menu')]//a[contains(text(), 'Products') and contains(@class, 'active')]

**Important:** XPath must use actual DOM attributes (id, class, data-*, tag names) that exist in the real HTML.
DO NOT use snapshot-specific attributes like [ref=xxx] - these are internal tracking IDs and not part of the DOM.`,
    inputSchema: z.object({
      base_xpath: z.string().optional().describe('Base XPath expression to start the search from. If not provided, the search starts from the document root.'),
      xpath: z.string().describe(`XPath expression to match elements.

Examples of good XPath patterns:
  - //button[@id='submit-btn']
  - //div[@data-testid='product-card']
  - //nav[contains(@class, 'header')]//a[text()='Products']
  - //form[@data-form='login']//input[@type='email']
  - //ul[contains(@class, 'product-list')]//li[.//span[text()='iPhone']]

Examples to avoid:
  - //div[@ref='e123'] (ref is not a real DOM attribute)
  - //div[@class='css-1a2b3c'] (auto-generated, unstable class)
  - //span[text()='Price: $99'] (dynamic pricing data)
  - //div[text()='2024-01-15'] (dynamic date content)
  - //div[1]/div[2]/button[3] (brittle index-based path)`),
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
