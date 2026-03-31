const LLM_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    adapter: 'OpenAIAdapter',
  },
  anthropic: {
    name: 'Anthropic',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
    adapter: 'AnthropicAdapter',
  },
  grok: {
    name: 'Grok',
    model: process.env.GROK_MODEL || 'grok-3-mini',
    adapter: 'GrokAdapter',
  },
};

// Get default provider from environment
const DEFAULT_PROVIDER = process.env.LLM_PROVIDER || 'openai';

function getProviderConfig(providerName = DEFAULT_PROVIDER) {
  const provider = LLM_PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unknown LLM provider: ${providerName}`);
  }
  return provider;
}

function getAllProviders() {
  return Object.keys(LLM_PROVIDERS);
}

module.exports = {
  LLM_PROVIDERS,
  DEFAULT_PROVIDER,
  getProviderConfig,
  getAllProviders,
};

