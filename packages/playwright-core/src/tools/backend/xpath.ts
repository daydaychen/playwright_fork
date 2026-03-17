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

import { z } from '../../mcpBundle';
import { defineTool } from './tool';
import type { Locator } from 'playwright-core';

// Patterns for extraction XPath (returns non-element values)
const EXTRACTION_PATTERNS = [
  /\/text\(\)$/,           // ends with /text()
  /\/string\(\)$/,         // ends with /string()
  /\/@[a-zA-Z_][\w-]*$/,   // ends with /@attr
];

/**
 * Detect if XPath returns non-element values (text, attribute, string).
 * These require document.evaluate() instead of locator.
 */
function isExtractionXPath(xpath: string): boolean {
  return EXTRACTION_PATTERNS.some(pattern => pattern.test(xpath));
}

/**
 * Execute extraction XPath using native document.evaluate().
 * Returns text/attribute values directly.
 */
async function executeExtractionXPath(
  page: any,
  xpath: string,
  response: any
): Promise<void> {
  const results = await page.evaluate((xpath: string) => {
    const result: { type: string; values: string[] } = { type: 'unknown', values: [] };

    try {
      const evaluator = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.ORDERED_NODE_ITERATOR_TYPE,
          null
      );

      // Determine result type from XPath pattern
      if (/\/text\(\)$/.test(xpath))
        result.type = 'text';
      else if (/\/string\(\)$/.test(xpath))
        result.type = 'string';
      else if (/\/@/.test(xpath))
        result.type = 'attribute';


      let node = evaluator.iterateNext();
      let count = 0;
      const maxResults = 20;

      while (node && count < maxResults) {
        if (node.nodeType === Node.TEXT_NODE)
          result.values.push(node.textContent || '');
        else if (node.nodeType === Node.ATTRIBUTE_NODE)
          result.values.push((node as Attr).value);

        node = evaluator.iterateNext();
        count++;
      }

      return result;
    } catch (e) {
      return { type: 'error', values: [], error: (e as Error).message };
    }
  }, xpath);

  if ('error' in results) {
    response.addError(`XPath evaluation failed: ${results.error}`);
    return;
  }

  const count = results.values.length;
  const limit = 10;

  if (count === 0) {
    response.addTextResult(`Found 0 values for extraction XPath: ${xpath}`);
    return;
  }

  if (count > limit)
    response.addTextResult(`Found ${count} ${results.type} values. Showing first ${limit}:`);
  else
    response.addTextResult(`Found ${count} ${results.type} value${count > 1 ? 's' : ''}:`);


  results.values.slice(0, limit).forEach((value: string, i: number) => {
    const truncated = value.length > 200 ? value.slice(0, 200) + '...' : value;
    response.addTextResult(`  [${i + 1}] ${truncated}`);
  });

  response.addCode(`await page.evaluate(() => document.evaluate('${xpath}', document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null))`);
}

const XPATH_TROUBLESHOOTING_TIP = `**Troubleshooting: Found 0 Elements**

Common causes and solutions:

1. **Element doesn't exist:**
   - Check if the element is inside an iframe or shadow DOM
   - Element may not have loaded yet (try waiting or simpler path)
   - Typo in attribute name or value

2. **Using snapshot-specific attributes:**
   ❌ //div[@ref='e123']             (ref doesn't exist in real DOM)
   ✅ //div[@id='container']         (use real DOM attributes)
   ✅ //div[contains(@class, 'card')] (use actual class names)

3. **Unstable selectors:**
   - Class name changed or doesn't exist
   - Overly specific paths that break on DOM changes

4. **Overly specific paths:**
   ❌ //div[1]/div[2]/span[3]        (brittle index-based path)
   ✅ //div[contains(@class, 'container')]//span[@data-id='title']

**Note:** This tool supports both element XPath (returns elements) and extraction XPath (returns text/attribute values):
- Element: //div[@class='title'] → returns elements with ariaSnapshot
- Text: //div[@class='title']/text() → returns text values directly
- Attribute: //a/@href → returns href values directly

**Next steps:** Check the page snapshot to verify the element exists.`;

const getElementsByXPath = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_get_elements_by_xpath',
    title: 'Get Elements by XPath',
    description: `Get elements or extract values from the page using XPath expression.

**Supports two XPath types:**

1. **Element XPath** (returns elements with ariaSnapshot):
   - //div[@class='title']
   - //ul[contains(@class, 'list')]//li
   - //form[@data-form='login']//input[@type='email']

2. **Extraction XPath** (returns text/attribute values directly):
   - //div[@class='title']/text() → returns text content
   - //a/@href → returns href attribute values
   - //span/string() → returns string values

**Element XPath Best Practices:**

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
      xpath: z.string().describe(`XPath expression to match elements or extract values.

**Element XPath examples** (returns elements):
  - //button[@id='submit-btn']
  - //div[@data-testid='product-card']
  - //nav[contains(@class, 'header')]//a[text()='Products']

**Extraction XPath examples** (returns values directly):
  - //div[@class='title']/text()
  - //a/@href
  - //span[contains(@class, 'price')]/text()

**Patterns to avoid:**
  - //div[@ref='e123'] (ref is not a real DOM attribute)
  - //div[@class='css-1a2b3c'] (auto-generated, unstable class)
  - //span[text()='Price: $99'] (dynamic pricing data)`),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const page = context.currentTabOrDie().page;

    // Check if this is an extraction XPath (returns text/attribute values)
    // Note: base_xpath is always element-level, only final xpath can be extraction
    if (!params.base_xpath && isExtractionXPath(params.xpath)) {
      await executeExtractionXPath(page, params.xpath, response);
      return;
    }

    // If base_xpath exists and final xpath is extraction, we need special handling
    if (params.base_xpath && isExtractionXPath(params.xpath)) {
      // Combine base_xpath with extraction xpath and evaluate
      const fullXpath = params.base_xpath + params.xpath.replace(/^\./, '');
      await executeExtractionXPath(page, fullXpath, response);
      return;
    }

    const getLocatorCount = async (locator: Locator): Promise<number | null> => {
      try {
        const count = await locator.count();
        if (count === 0) {
          response.addTextResult(`Found 0 elements for ${locator.toString()}\n\n${XPATH_TROUBLESHOOTING_TIP}`);
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
        response.addTextResult(`Found ${count} final elements. Showing first ${limit}.`);
      else
        response.addTextResult(`Found ${count} final elements.`);

      const loopCount = Math.min(count, limit);
      for (let i = 0; i < loopCount; ++i) {
        const elementLocator = locator.nth(i);
        const snapshot = await elementLocator.ariaSnapshot();
        response.addTextResult(`Element ${i + 1}:\n${snapshot}`);
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
        response.addTextResult(`Found ${count} base elements. Now searching within them...`);
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
