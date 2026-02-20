/**
 * Voice Classification Prompt Validation Script
 *
 * Runs predefined test cases through the real Anthropic API to validate
 * the classification prompt in VoiceTodoService.
 *
 * Usage: cd server && npm run test:voice-classify
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { VoiceTodoService } from '../services/VoiceTodoService';
import { AnthropicService } from '../services/AnthropicService';
import { NotionService } from '../services/NotionService';
import { ClickUpService } from '../services/ClickUpService';
import { ClientService } from '../services/ClientService';

interface TestCase {
  id: number;
  transcription: string;
  expectedItems: Array<{
    destination: string;
    client_name?: string;
    clickup_list?: string;
  }>;
}

const TEST_CASES: TestCase[] = [
  {
    id: 1,
    transcription: 'need to prune the roses at Stoller next time',
    expectedItems: [{ destination: 'notion', client_name: 'Stoller' }],
  },
  {
    id: 2,
    transcription: 'order more bark mulch from the supplier',
    expectedItems: [{ destination: 'clickup', clickup_list: 'supplies_errands' }],
  },
  {
    id: 3,
    transcription: 'file quarterly taxes by end of month',
    expectedItems: [{ destination: 'clickup', clickup_list: 'taxes' }],
  },
  {
    id: 4,
    transcription: 'schedule Patterson for next Thursday',
    expectedItems: [{ destination: 'clickup', clickup_list: 'scheduling' }],
  },
  {
    id: 5,
    transcription: 'at Feigum the drainage needs checking',
    expectedItems: [{ destination: 'notion', client_name: 'Feigum' }],
  },
  {
    id: 6,
    transcription: 'call the dentist on Monday',
    expectedItems: [{ destination: 'clickup_personal' }],
  },
  {
    id: 7,
    transcription: 'pick up fertilizer and drop off invoice at Scott',
    expectedItems: [
      { destination: 'clickup', clickup_list: 'supplies_errands' },
      { destination: 'clickup', clickup_list: 'scott' },
    ],
  },
  {
    id: 8,
    transcription: 'remember to check the new plantings at Patterson next visit and also order replacement hostas',
    expectedItems: [
      { destination: 'notion', client_name: 'Patterson' },
      { destination: 'clickup', clickup_list: 'supplies_errands' },
    ],
  },
];

// Known client names (matching what ClientService.getActiveClients would return)
const KNOWN_CLIENTS = ['Stoller', 'Feigum', 'Patterson', 'Scott', 'Pankow', 'Johnson', 'Smith'];

async function main() {
  console.log('=== Voice Classification Prompt Validation ===\n');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not set. Add it to your .env file.');
    process.exit(1);
  }

  // Create a VoiceTodoService instance — we only need classifyAndExtract
  const anthropicService = new AnthropicService();
  const service = new VoiceTodoService(
    anthropicService,
    null as unknown as NotionService,
    null as unknown as ClickUpService,
    null as unknown as ClientService,
  );

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    console.log(`--- Test #${testCase.id} ---`);
    console.log(`Input: "${testCase.transcription}"`);

    try {
      const items = await service.classifyAndExtract(testCase.transcription, KNOWN_CLIENTS);

      console.log(`Got ${items.length} item(s):`);

      let testPassed = true;

      // Check each expected item has a match
      for (let i = 0; i < testCase.expectedItems.length; i++) {
        const expected = testCase.expectedItems[i];
        const actual = items[i];

        if (!actual) {
          console.log(`  \x1b[31mFAIL\x1b[0m Expected item ${i + 1} not found`);
          testPassed = false;
          continue;
        }

        const destMatch = actual.destination === expected.destination;
        const clientMatch = !expected.client_name || actual.client_name === expected.client_name;
        const listMatch = !expected.clickup_list || actual.clickup_list === expected.clickup_list;

        const status = destMatch && clientMatch && listMatch ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
        if (!(destMatch && clientMatch && listMatch)) testPassed = false;

        console.log(`  ${status} "${actual.title}" → ${actual.destination}` +
          (actual.client_name ? ` (client: ${actual.client_name})` : '') +
          (actual.clickup_list ? ` (list: ${actual.clickup_list})` : ''));

        if (!destMatch) console.log(`    Expected destination: ${expected.destination}, got: ${actual.destination}`);
        if (!clientMatch) console.log(`    Expected client: ${expected.client_name}, got: ${actual.client_name}`);
        if (!listMatch) console.log(`    Expected list: ${expected.clickup_list}, got: ${actual.clickup_list}`);

        if (actual.reasoning) {
          console.log(`    Reasoning: ${actual.reasoning}`);
        }
      }

      // Check for unexpected extra items
      if (items.length > testCase.expectedItems.length) {
        console.log(`  \x1b[33mWARN\x1b[0m Got ${items.length - testCase.expectedItems.length} extra item(s):`);
        for (let i = testCase.expectedItems.length; i < items.length; i++) {
          console.log(`    "${items[i].title}" → ${items[i].destination}`);
        }
      }

      if (testPassed) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`  \x1b[31mERROR\x1b[0m ${error instanceof Error ? error.message : error}`);
      failed++;
    }

    console.log();
  }

  console.log('=== Results ===');
  console.log(`Total: ${TEST_CASES.length} | \x1b[32mPassed: ${passed}\x1b[0m | \x1b[31mFailed: ${failed}\x1b[0m`);
  console.log(`Accuracy: ${Math.round((passed / TEST_CASES.length) * 100)}%`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
