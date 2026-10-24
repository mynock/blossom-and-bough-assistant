import Anthropic from '@anthropic-ai/sdk';

/**
 * Text of a Messages API response, read by block type. Current models can put
 * thinking blocks ahead of the text, so content[0] is not necessarily text.
 */
export function getResponseText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
}

/**
 * Text of a response that has to be a complete answer (e.g. JSON to parse).
 * Throws a descriptive error when Claude declined or ran out of tokens instead
 * of handing empty or truncated text to the caller's parser.
 */
export function getCompleteResponseText(response: Anthropic.Message, task: string): string {
  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined to ${task} (stop_reason: refusal)`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error(`Claude's response was cut off at max_tokens while trying to ${task}`);
  }

  const text = getResponseText(response);
  if (!text) {
    throw new Error(`Claude returned no text while trying to ${task}`);
  }
  return text;
}
