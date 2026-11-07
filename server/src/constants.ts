// Anthropic API configuration
export const ANTHROPIC_MODEL = 'claude-sonnet-5-5';

// output_config.effort per route. Sonnet 5.5 defaults to 'high', which adds
// thinking time to every reply. The chat loop has to finish all of its tool
// rounds inside the /api/chat 55s timeout; the parsers are extraction tasks.
export const ANTHROPIC_CHAT_EFFORT = 'low';
export const ANTHROPIC_PARSE_EFFORT = 'low';
