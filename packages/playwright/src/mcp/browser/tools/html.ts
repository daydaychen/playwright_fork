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

import { z } from '../../sdk/bundle';
import { defineTabTool } from './tool';
import type * as playwright from 'playwright';

interface HtmlCleaningParams {
  removeScripts: boolean;
  removeStyles: boolean;
  removeInlineStyles: boolean;
  removeComments: boolean;
  removeMeta: boolean;
  removeSvg: boolean;
  minify: boolean;
}

/**
 * Helper function to determine cleaning options and apply HTML cleaning
 */
const processHtmlCleaning = async (
  page: playwright.Page,
  html: string,
  options: HtmlCleaningParams,
  isFragment = false
): Promise<string> => {
  // Apply HTML cleaning if any option is enabled
  if (options.removeScripts || options.removeStyles || options.removeInlineStyles || options.removeComments || options.removeMeta || options.removeSvg || options.minify) {
    return await page.evaluate(
        ({ html, options, isFragment }: { html: string; options: HtmlCleaningParams; isFragment: boolean }) => {
        // Create a DOM parser to work with the HTML
          const parser = new DOMParser();
          const docHtml = isFragment ? `<div>${html}</div>` : html;
          const doc = parser.parseFromString(docHtml, 'text/html');
          const container = isFragment ? doc.querySelector('div') : doc.documentElement;

          if (!container)
            return html;

          // Remove script tags if requested
          if (options.removeScripts) {
            const scripts = container.querySelectorAll('script');
            scripts.forEach(script => script.remove());
          }

          // Remove style tags if requested
          if (options.removeStyles) {
            const styles = container.querySelectorAll('style');
            styles.forEach(style => style.remove());

            // Also remove CSS link tags
            const cssLinks = container.querySelectorAll('link[rel="stylesheet"]');
            cssLinks.forEach(link => link.remove());
          }

          // Remove inline style attributes if requested
          if (options.removeInlineStyles) {
            const elementsWithStyle = container.querySelectorAll('[style]');
            elementsWithStyle.forEach(element => element.removeAttribute('style'));
          }

          // Remove meta tags if requested
          if (options.removeMeta) {
            const metaTags = container.querySelectorAll('meta');
            metaTags.forEach(meta => meta.remove());
          }

          // Remove SVG elements if requested
          if (options.removeSvg) {
            const svgElements = container.querySelectorAll('svg');
            svgElements.forEach(svg => svg.remove());
          }

          // Remove HTML comments if requested
          if (options.removeComments) {
            const removeCommentsRecursive = (node: Node) => {
              const childNodes = node.childNodes;
              for (let i = childNodes.length - 1; i >= 0; i--) {
                const child = childNodes[i];
                if (child.nodeType === 8) { // 8 is for comment nodes
                  node.removeChild(child);
                } else if (child.nodeType === 1) { // 1 is for element nodes
                  removeCommentsRecursive(child);
                }
              }
            };
            removeCommentsRecursive(container);
          }

          // Get the processed HTML
          let result = isFragment ? container.innerHTML : container.outerHTML;

          // Minify if requested
          if (options.minify) {
          // Simple minification: remove extra whitespace
            result = result.replace(/>\s+</g, '><').trim();
          }

          return result;
        },
        {
          html,
          options,
          isFragment
        }
    );
  }

  return html;
};


const getPageHTML = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_get_html',
    title: 'Get page HTML',
    description: 'Get the HTML content of the current page with optional cleaning options.',
    inputSchema: z.object({
      maxLength: z.number().int().positive().max(500000).optional().default(100000).describe('Maximum HTML length to return (default: 100000).'),
      removeScripts: z.boolean().optional().default(false).describe('Remove script tags from HTML (default: false).'),
      removeStyles: z.boolean().optional().default(true).describe('Remove style tags and CSS link tags from HTML, but keep inline styles (default: true).'),
      removeInlineStyles: z.boolean().optional().default(true).describe('Remove inline style attributes from HTML elements (default: true).'),
      removeComments: z.boolean().optional().default(true).describe('Remove HTML comments (default: true).'),
      removeMeta: z.boolean().optional().default(false).describe('Remove meta tags from HTML (default: false).'),
      removeSvg: z.boolean().optional().default(true).describe('Remove SVG elements from HTML (default: true).'),
      minify: z.boolean().optional().default(true).describe('Minify HTML by removing extra whitespace (default: true).'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const { maxLength, ...cleaningParams } = params;

    response.addCode(`await page.content();`);

    try {
      let html = await tab.page.content();

      response.addResult(`Original HTML length: ${html.length}.`);
      // Apply HTML cleaning using helper function
      html = await processHtmlCleaning(tab.page, html, cleaningParams);
      response.addResult(`Processed HTML length: ${html.length}.`);

      if (html.length > maxLength) {
        html = html.substring(0, maxLength) + '... [truncated]';
        response.addResult(`HTML content truncated to ${maxLength} characters:\n${html}`);
      } else {
        const lines = [];
        lines.push('Full HTML content:');
        lines.push('```html');
        lines.push(html);
        lines.push('```');
        response.addResult(lines.join('\n'));
      }
    } catch (error) {
      throw new Error(`Failed to get page HTML: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

const getPageHtmlWithLocator = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_get_html_with_locator',
    title: 'Get HTML with locator',
    description: 'Get the HTML content of a specific element using a locator with optional cleaning options.',
    inputSchema: z.object({
      locator: z.string().min(1, 'Locator cannot be empty').describe('locator to specify an element on the page.'),
      maxLength: z.number().int().positive().max(500000).optional().default(100000).describe('Maximum HTML length to return (default: 100000).'),
      timeout: z.number().int().positive().max(60000).optional().default(30000).describe('Timeout in milliseconds (default: 30000).'),
      removeScripts: z.boolean().optional().default(false).describe('Remove script tags from HTML (default: false).'),
      removeStyles: z.boolean().optional().default(true).describe('Remove style tags and CSS link tags from HTML, but keep inline styles (default: true).'),
      removeInlineStyles: z.boolean().optional().default(true).describe('Remove inline style attributes from HTML elements (default: true).'),
      removeComments: z.boolean().optional().default(true).describe('Remove HTML comments (default: true).'),
      removeMeta: z.boolean().optional().default(false).describe('Remove meta tags from HTML (default: false).'),
      removeSvg: z.boolean().optional().default(true).describe('Remove SVG elements from HTML (default: true).'),
      minify: z.boolean().optional().default(true).describe('Minify HTML by removing extra whitespace (default: true).'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const { locator, maxLength, timeout, ...cleaningParams } = params;

    response.addCode(`await page.locator(${JSON.stringify(locator)}).innerHTML();`);
    const locatorObj = tab.page.locator(locator);

    try {
      await locatorObj.waitFor({ state: 'attached', timeout });

      const count = await locatorObj.count();
      if (count === 0)
        throw new Error(`No element found for locator: ${locator}`);

      let html = await locatorObj.innerHTML();

      // Apply HTML cleaning using helper function (for fragment HTML)
      html = await processHtmlCleaning(tab.page, html, cleaningParams, true); // isFragment = true for innerHTML

      if (html.length > maxLength) {
        html = html.substring(0, maxLength) + '... [truncated]';
        response.addResult(`HTML content truncated to ${maxLength} characters:\n${html}`);
      } else {
        response.addResult(html);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Timeout'))
          throw new Error(`Element with locator '${locator}' not found within ${timeout}ms timeout`);
        throw error;
      }
      throw new Error(`Failed to get HTML for locator '${locator}': ${String(error)}`);
    }
  },
});


export default [
  getPageHTML,
  getPageHtmlWithLocator,
];
