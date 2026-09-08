const callGroq = require('../config/groq');

const MAX_ITERATIONS = 5;

const safeParseJson = (rawText) => {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty or invalid AI response string");
  }
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return JSON.parse(cleaned);
};

// (Roadmap, Quiz, Study Plan, Project Generator, Code Review) 
const callAIWithFallback = async (ai, config, prompt) => {
  let lastError = null;
  let currentProvider = 'gemini';
  const expectsJson = config?.config?.responseMimeType === 'application/json' || config?.forceJson !== false;

  for (let attempt = 1; attempt <= MAX_ITERATIONS; attempt++) {
    try {
      console.log(`Attempt ${attempt} — Using ${currentProvider}`);

      let responseText = '';

      if (currentProvider === 'gemini') {
        if (!ai || !ai.models) {
          throw new Error("Gemini AI instance or API key is missing");
        }

        const response = await ai.models.generateContent({
          model: config?.model || 'gemini-2.5-flash',
          config: config?.config,
          contents: prompt
        });

        responseText = response.text || '';
      } else {
        const systemInstruction = config?.config?.systemInstruction;
        
        responseText = await callGroq(
          prompt,
          systemInstruction
        );
      }

      // Validate JSON if JSON is expected
      let parsed = null;
      if (expectsJson && responseText) {
        parsed = safeParseJson(responseText);
      }

      console.log(`✅ Success on attempt ${attempt} with ${currentProvider}`);
      return { text: responseText, parsed, provider: currentProvider, attempt };

    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${attempt} failed with ${currentProvider}: ${error.message}`);
      
      // Toggle between Gemini and Groq
      currentProvider = currentProvider === 'gemini' ? 'groq' : 'gemini';

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
        // Safe Check for Chat
        if (!ai || !ai.chats) {
          throw new Error("Gemini Chat instance or API key is missing");
        }

        const geminiChat = ai.chats.create({
          model: config?.model || 'gemini-2.5-flash',
          config: config?.config,
          history
        });

        const response = await geminiChat.sendMessage({ message });

        console.log(`✅ Chat success on attempt ${attempt} with Gemini`);
        return { text: response.text, provider: 'gemini', attempt };

      } else {
        // Groq chat payload formatting
        const groqMessages = Array.isArray(history) 
          ? history.map((msg) => ({
              role: msg.role === 'model' ? 'assistant' : 'user',
              content: msg.parts?.[0]?.text || msg.content || ''
            }))
          : [];

        groqMessages.push({
          role: 'user',
          content: message
        });

        const systemInstruction = config?.config?.systemInstruction;

        const responseText = await callGroq(
          message,
          systemInstruction,
          groqMessages 
        );

        console.log(`✅ Chat success on attempt ${attempt} with Groq`);
        return { text: responseText, provider: 'groq', attempt };
      }

    } catch (error) {
      lastError = error;
      console.log(`❌ Chat attempt ${attempt} failed with ${currentProvider}: ${error.message}`);
      
      // Toggle between Gemini and Groq
      currentProvider = currentProvider === 'gemini' ? 'groq' : 'gemini';

      if (attempt === MAX_ITERATIONS) {
        throw new Error(`All ${MAX_ITERATIONS} attempts failed. Last error: ${lastError.message}`);
      }
    }
  }
};

module.exports = { callAIWithFallback, callChatWithFallback };