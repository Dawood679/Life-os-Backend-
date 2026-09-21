const AiUsageLog = require('../models/AiUsageLog');

// Pricing configuration per 1,000 tokens (USD)
const PRICING = {
  gemini: {
    inputPer1k: 0.000075,  // $0.075 / 1M tokens
    outputPer1k: 0.000300, // $0.300 / 1M tokens
  },
  groq: {
    inputPer1k: 0.000590,  // $0.59 / 1M tokens
    outputPer1k: 0.000790, // $0.79 / 1M tokens
  },
  default: {
    inputPer1k: 0.000100,
    outputPer1k: 0.000300,
  }
};

/**
 * Calculates estimated USD cost for token consumption
 */
const calculateCost = (provider, promptTokens = 0, candidateTokens = 0) => {
  const rates = PRICING[provider] || PRICING.default;
  const inputCost = (promptTokens / 1000) * rates.inputPer1k;
  const outputCost = (candidateTokens / 1000) * rates.outputPer1k;
  return +(inputCost + outputCost).toFixed(6);
};

/**
 * Non-blocking logger for AI token consumption
 */
const logAiUsage = async ({
  user = null,
  module = 'general',
  provider = 'gemini',
  modelName = 'gemini-2.5-flash',
  promptTokens = 0,
  candidateTokens = 0,
  latencyMs = 0,
  status = 'success',
  errorMessage = ''
}) => {
  try {
    const totalTokens = promptTokens + candidateTokens;
    const estimatedCostUsd = calculateCost(provider, promptTokens, candidateTokens);

    await AiUsageLog.create({
      user: user || null,
      module,
      provider,
      modelName,
      promptTokens,
      candidateTokens,
      totalTokens,
      estimatedCostUsd,
      latencyMs,
      status,
      errorMessage
    });
  } catch (err) {
    // Non-fatal, log warning
    console.warn('Failed to record AI usage log:', err.message);
  }
};

module.exports = {
  logAiUsage,
  calculateCost,
  PRICING
};
