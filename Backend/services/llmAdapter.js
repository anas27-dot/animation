const openai = require('../config/openai');
const { getProviderConfig } = require('../config/llm');
const logger = require('../config/logging');
const { recordMetric } = require('../utils/cloudwatch');

class OpenAIAdapter {
  constructor() {
    this.model = getProviderConfig('openai').model;
  }

  async generateCompletion(messages, systemPrompt, options = {}) {
    let response = null; // Declare outside try so finally can access it
    try {
      // Transform messages for OpenAI Vision API format
      const transformedMessages = messages.map(msg => {
        // Check if message content is an array (Vision format) or string (text)
        if (Array.isArray(msg.content)) {
          return {
            role: msg.role,
            content: msg.content // Already in Vision API format
          };
        } else {
          return {
            role: msg.role,
            content: msg.content // Regular text content
          };
        }
      });

      const requestOptions = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...transformedMessages,
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 500,
        stream: false,
      };

      // Add tools if provided
      if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
        requestOptions.tools = options.tools;
        requestOptions.tool_choice = options.tool_choice || 'auto';
        logger.info(`🔧 [LLM Adapter] Non-streaming call - Tools provided: ${options.tools.length} tool(s)`);
        logger.info(`🔧 [LLM Adapter] Non-streaming call - Tool choice: ${JSON.stringify(requestOptions.tool_choice)}`);
      }

      response = await openai.chat.completions.create(requestOptions);

      // Extract tool calls if present
      const toolCalls = response.choices[0]?.message?.tool_calls || [];

      return {
        content: response.choices[0].message.content,
        toolCalls: toolCalls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
        tokens: {
          prompt: response.usage.prompt_tokens,
          completion: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        },
      };
    } catch (error) {
      logger.error('OpenAI completion error:', error);
      throw new Error(`OpenAI API error: ${error.message}`);
    } finally {
      // Record token metrics even if there's an error (though usage might be 0)
      if (response && response.usage) {
        recordMetric('LLMTokens', response.usage.prompt_tokens, 'Count', { Type: 'Prompt', Provider: 'OpenAI' });
        recordMetric('LLMTokens', response.usage.completion_tokens, 'Count', { Type: 'Completion', Provider: 'OpenAI' });
      }
    }
  }

  async* generateStreamingCompletion(messages, systemPrompt, options = {}) {
    try {
      // Transform messages for OpenAI Vision API format
      const transformedMessages = messages.map(msg => {
        // Check if message content is an array (Vision format) or string (text)
        if (Array.isArray(msg.content)) {
          return {
            role: msg.role,
            content: msg.content // Already in Vision API format
          };
        } else {
          return {
            role: msg.role,
            content: msg.content // Regular text content
          };
        }
      });

      const requestOptions = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...transformedMessages,
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 500,
        stream: true,
      };

      // Add tools if provided
      if (options.tools && Array.isArray(options.tools) && options.tools.length > 0) {
        requestOptions.tools = options.tools;
        requestOptions.tool_choice = options.tool_choice || 'auto';
        logger.info(`🔧 [LLM Adapter] Tools provided: ${options.tools.length} tool(s)`);
        logger.info(`🔧 [LLM Adapter] Tool names: ${options.tools.map(t => t.function?.name).join(', ')}`);
        logger.info(`🔧 [LLM Adapter] Tool choice: ${JSON.stringify(requestOptions.tool_choice)}`);
      } else {
        logger.info('🔧 [LLM Adapter] No tools provided in options');
      }

      const stream = await openai.chat.completions.create(requestOptions);

      let fullContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let toolCalls = [];
      let toolCallsYielded = false;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        // Handle tool calls FIRST - collect them as they come in
        if (delta?.tool_calls) {
          logger.info(`🔧 [LLM Adapter] Tool call delta detected: ${delta.tool_calls.length} tool call(s)`);
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index;

            if (!toolCalls[index]) {
              toolCalls[index] = {
                id: toolCallDelta.id || '',
                type: 'function',
                function: {
                  name: toolCallDelta.function?.name || '',
                  arguments: '',
                },
              };
              logger.info(`🔧 [LLM Adapter] New tool call started at index ${index}: ${toolCallDelta.function?.name || 'unknown'}`);
            }

            if (toolCallDelta.function?.name) {
              toolCalls[index].function.name = toolCallDelta.function.name;
            }

            if (toolCallDelta.function?.arguments) {
              toolCalls[index].function.arguments += toolCallDelta.function.arguments;
            }

            if (toolCallDelta.id) {
              toolCalls[index].id = toolCallDelta.id;
            }
          }
          logger.info(`🔧 [LLM Adapter] Total tool calls collected so far: ${toolCalls.length}`);
          logger.info(`🔧 [LLM Adapter] Tool calls array: ${JSON.stringify(toolCalls.map(tc => ({ name: tc.function?.name, argsLength: tc.function?.arguments?.length })), null, 2)}`);
        }

        // Collect any text content
        if (delta?.content) {
          fullContent += delta.content;
          yield {
            type: 'content',
            content: delta.content,
          };
        }

        // Check finish_reason - if it's 'tool_calls', yield tool calls immediately
        if (finishReason === 'tool_calls' && toolCalls.length > 0 && !toolCallsYielded) {
          toolCallsYielded = true;
          logger.info('🔧 [LLM Adapter] Tool calls detected with finish_reason === "tool_calls"');
          logger.info(`🔧 [LLM Adapter] Tool calls to yield: ${toolCalls.length}`);
          logger.info(`🔧 [LLM Adapter] Text content before tool call: "${fullContent.substring(0, 100)}"`);

          // Yield tool calls (chatService will handle converting to proposal_intent_detected)
          yield {
            type: 'tool_calls',
            toolCalls: toolCalls,
          };

          // If we have text content, yield a complete event with it
          // This ensures the text response is displayed before the tool call triggers confirmation
          if (fullContent.trim().length > 0) {
            logger.info('🔧 [LLM Adapter] Yielding complete event with text content before tool call');
            yield {
              type: 'complete',
              content: fullContent,
              tokens: {
                prompt: promptTokens,
                completion: completionTokens,
                total: promptTokens + completionTokens,
              },
            };
          } else {
            logger.info('🔧 [LLM Adapter] No text content before tool call, skipping complete event');
          }
          return;
        }

        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens || promptTokens;
          completionTokens = chunk.usage.completion_tokens || completionTokens;
        }
      }

      // After stream ends, check if we collected tool calls but didn't yield them
      // This handles the case where tool calls were collected but finish_reason wasn't 'tool_calls'
      if (toolCalls.length > 0 && !toolCallsYielded) {
        logger.info(`🔧 [LLM Adapter] Stream ended with ${toolCalls.length} tool call(s) collected but not yielded`);
        logger.info(`🔧 [LLM Adapter] Tool calls: ${JSON.stringify(toolCalls.map(tc => ({ name: tc.function?.name, args: tc.function?.arguments?.substring(0, 100) })), null, 2)}`);
        logger.info(`🔧 [LLM Adapter] Text content: "${fullContent.substring(0, 100)}"`);

        // Yield tool calls even if finish_reason wasn't 'tool_calls'
        toolCallsYielded = true;
        yield {
          type: 'tool_calls',
          toolCalls: toolCalls,
        };

        // Yield complete event with text if we have it
        if (fullContent.trim().length > 0) {
          logger.info('🔧 [LLM Adapter] Yielding complete event with text content after tool calls');
          yield {
            type: 'complete',
            content: fullContent,
            tokens: {
              prompt: promptTokens,
              completion: completionTokens,
              total: promptTokens + completionTokens,
            },
          };
        }
        return;
      }

      // If tool calls were detected but not yet yielded (fallback)
      if (toolCalls.length > 0 && !toolCallsYielded) {
        logger.info('🔧 [LLM Adapter] Tool calls detected at end of stream (fallback), yielding now');
        yield {
          type: 'tool_calls',
          toolCalls: toolCalls,
        };
        // Don't yield complete event if we have tool calls
        logger.info('🔧 [LLM Adapter] Tool calls yielded (fallback), returning early (no complete event)');
        return;
      }

      // Only yield complete if no tool calls were made
      yield {
        type: 'complete',
        content: fullContent,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
      };

      // Record final token counts for the stream
      if (promptTokens > 0 || completionTokens > 0) {
        recordMetric('LLMTokens', promptTokens, 'Count', { Type: 'Prompt', Provider: 'OpenAI', Mode: 'Stream' });
        recordMetric('LLMTokens', completionTokens, 'Count', { Type: 'Completion', Provider: 'OpenAI', Mode: 'Stream' });
      }
    } catch (error) {
      logger.error('OpenAI streaming error:', error);
      yield {
        type: 'error',
        error: error.message,
      };
    }
  }
}

class AnthropicAdapter {
  constructor() {
    // Note: Requires @anthropic-ai/sdk
    // This is a placeholder - implement with actual Anthropic SDK
    this.model = getProviderConfig('anthropic').model;
  }

  async generateCompletion(messages, systemPrompt, options = {}) {
    throw new Error('Anthropic adapter not fully implemented');
  }

  async* generateStreamingCompletion(messages, systemPrompt, options = {}) {
    throw new Error('Anthropic adapter not fully implemented');
  }
}

class GrokAdapter {
  constructor() {
    // Note: Requires xai SDK
    // This is a placeholder - implement with actual Grok SDK
    this.model = getProviderConfig('grok').model;
  }

  async generateCompletion(messages, systemPrompt, options = {}) {
    throw new Error('Grok adapter not fully implemented');
  }

  async* generateStreamingCompletion(messages, systemPrompt, options = {}) {
    throw new Error('Grok adapter not fully implemented');
  }
}

// Factory function to get adapter
function getLLMAdapter(providerName = null) {
  const provider = providerName || process.env.LLM_PROVIDER || 'openai';

  switch (provider) {
    case 'openai':
      return new OpenAIAdapter();
    case 'anthropic':
      return new AnthropicAdapter();
    case 'grok':
      return new GrokAdapter();
    default:
      logger.warn(`Unknown provider ${provider}, defaulting to OpenAI`);
      return new OpenAIAdapter();
  }
}

module.exports = {
  getLLMAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
  GrokAdapter,
};

