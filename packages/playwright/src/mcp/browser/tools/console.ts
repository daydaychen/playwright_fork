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

const console = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_console_messages',
    title: 'Get console messages',
    description: 'Returns all console messages, optionally filtered by type inclusion or exclusion',
    inputSchema: z.object({
      includeType: z.string().optional().describe('Include only messages of this type (e.g., log, error, warning, info, debug)'),
      excludeType: z.string().optional().describe('Exclude messages of this type (e.g., log, error, warning, info, debug)').default('warning'),
    }),
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    let messages = tab.consoleMessages();

    if (params.includeType)
      messages = messages.filter(message => message.type === params.includeType);


    if (params.excludeType)
      messages = messages.filter(message => message.type !== params.excludeType);


    messages.map(message => response.addResult(message.toString()));
  },
});

export default [
  console,
];
