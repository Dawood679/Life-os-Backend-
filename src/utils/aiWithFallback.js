const callGrok = require('../config/grok');

const MAX_ITERATIONS = 5;

const callAIWithFallback = async (ai, config, prompt) => {
  let lastError = null;
  let currentProvider = 'gemini'; 

  for (let attempt = 1; attempt <= MAX_ITERATIONS; attempt++) {
    try {
      console.log(`Attempt ${attempt} — Using ${currentProvider}`);

      if (currentProvider === 'gemini') {
        // Gemini call
        const response = await ai.models.generateContent({
          model: config.model,
          config: config.config,
          contents: prompt
        });

        console.log(`✅ Success on attempt ${attempt} with Gemini`);
        return {
          text: response.text,
          provider: 'gemini',
          attempt
        };

      } else {
        // Grok call
        const responseText = await callGrok(
          prompt,
          config.config.systemInstruction
        );

        console.log(`✅ Success on attempt ${attempt} with Grok`);
        return {
          text: responseText,
          provider: 'grok',
          attempt
        };
      }

    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${attempt} failed with ${currentProvider}: ${error.message}`);

    
      currentProvider = currentProvider === 'gemini' ? 'grok' : 'gemini';

    
      if (attempt === MAX_ITERATIONS) {
        throw new Error(
          `All ${MAX_ITERATIONS} attempts failed. Last error: ${lastError.message}`
        );
      }
    }
  }
};

module.exports = callAIWithFallback;