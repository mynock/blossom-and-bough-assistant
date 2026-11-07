import { describe, expect, it } from '@jest/globals';
import Anthropic from '@anthropic-ai/sdk';
import { getCompleteResponseText, getResponseText } from '../utils/anthropicResponse';

function message(
  content: Array<Record<string, unknown>>,
  stopReason: Anthropic.StopReason,
  stopDetails: Record<string, unknown> | null = null
): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content,
    stop_reason: stopReason,
    stop_details: stopDetails,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 }
  } as unknown as Anthropic.Message;
}

const thinkingBlock = { type: 'thinking', thinking: '', signature: 'sig' };

describe('getResponseText', () => {
  it('reads text that comes after a thinking block', () => {
    const response = message([thinkingBlock, { type: 'text', text: '{"ok":true}' }], 'end_turn');
    expect(getResponseText(response)).toBe('{"ok":true}');
  });

  it('returns an empty string when there is no text block', () => {
    expect(getResponseText(message([thinkingBlock], 'end_turn'))).toBe('');
  });
});

describe('getCompleteResponseText', () => {
  it('returns the text of a complete response', () => {
    const response = message([thinkingBlock, { type: 'text', text: '[1,2]' }], 'end_turn');
    expect(getCompleteResponseText(response, 'parse a batch')).toBe('[1,2]');
  });

  it('throws with the refusal category instead of returning text', () => {
    const response = message([], 'refusal', { type: 'refusal', category: 'general_harms', explanation: null });
    expect(() => getCompleteResponseText(response, 'parse a batch')).toThrow(
      'Claude declined to parse a batch (refusal category: general_harms)'
    );
  });

  it('throws when the response was cut off at max_tokens', () => {
    const response = message([{ type: 'text', text: '[{"date": "2026-' }], 'max_tokens');
    expect(() => getCompleteResponseText(response, 'parse a batch')).toThrow('cut off (max_tokens)');
  });

  it('throws when the response has no text', () => {
    expect(() => getCompleteResponseText(message([thinkingBlock], 'end_turn'), 'parse a batch')).toThrow(
      'Claude returned no text'
    );
  });
});
