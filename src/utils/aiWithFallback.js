const callGrok = require('../config/grok');

const MAX_ITERATIONS = 5;

// (Roadmap, Quiz, Study Plan, Code Review) 
const callAIWithFallback = async (ai, config, prompt) => {
  let lastError = null;
  let currentProvider = 'gemini';

  for (let attempt = 1; attempt <= MAX_ITERATIONS; attempt++) {
    try {
      console.log(`Attempt ${attempt} — Using ${currentProvider}`);

      if (currentProvider === 'gemini') {
        const response = await ai.models.generateContent({
          model: config.model,
          config: config.config,
          contents: prompt
        });

        console.log(`✅ Success on attempt ${attempt} with Gemini`);
        return { text: response.text, provider: 'gemini', attempt };

      } else {
        const responseText = await callGrok(
          prompt,
          config.config.systemInstruction
        );

        console.log(`✅ Success on attempt ${attempt} with Grok`);
        return { text: responseText, provider: 'grok', attempt };
      }

    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${attempt} failed with ${currentProvider}: ${error.message}`);
      currentProvider = currentProvider === 'gemini' ? 'grok' : 'gemini';

      if (attempt === MAX_ITERATIONS) {
        throw new Error(`All ${MAX_ITERATIONS} attempts failed. Last error: ${lastError.message}`);
      }
    }
  }
};

// (Chat Tutor)
const callChatWithFallback = async (ai, config, history, message) => {
  let lastError = null;
  let currentProvider = 'gemini';

  for (let attempt = 1; attempt <= MAX_ITERATIONS; attempt++) {
    try {
      console.log(`Chat attempt ${attempt} — Using ${currentProvider}`);

      if (currentProvider === 'gemini') {
        // Gemini chat session
        const geminiChat = ai.chats.create({
          model: config.model,
          config: config.config,
          history
        });

        const response = await geminiChat.sendMessage({ message });

        console.log(`✅ Chat success on attempt ${attempt} with Gemini`);
        return { text: response.text, provider: 'gemini', attempt };

      } else {
        // Grok chat
        const grokMessages = history.map((msg) => ({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.parts[0].text
        }));

        grokMessages.push({
          role: 'user',
          content: message
        });

        const responseText = await callGrok(
          message,
          config.config.systemInstruction,
          grokMessages 
        );

        console.log(`✅ Chat success on attempt ${attempt} with Grok`);
        return { text: responseText, provider: 'grok', attempt };
      }

    } catch (error) {
      lastError = error;
      console.log(`❌ Chat attempt ${attempt} failed with ${currentProvider}: ${error.message}`);
      currentProvider = currentProvider === 'gemini' ? 'grok' : 'gemini';

      if (attempt === MAX_ITERATIONS) {
        throw new Error(`All ${MAX_ITERATIONS} attempts failed. Last error: ${lastError.message}`);
      }
    }
  }
};

module.exports = { callAIWithFallback, callChatWithFallback };