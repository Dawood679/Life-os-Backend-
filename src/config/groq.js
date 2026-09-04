const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function callGroq(prompt, systemInstruction = '', messagesHistory = [], forceJson = true) {
  try {
    const messages = [];

    let finalSystemInstruction = systemInstruction ? systemInstruction.trim() : '';

    if (forceJson && !finalSystemInstruction.toLowerCase().includes('json')) {
      finalSystemInstruction += ' Respond in valid JSON format.';
    }

    if (finalSystemInstruction) {
      messages.push({ role: 'system', content: finalSystemInstruction });
    }

    // Append history if present, otherwise single user prompt
    if (messagesHistory && messagesHistory.length > 0) {
      messages.push(...messagesHistory);
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const payload = {
      messages: messages,
      model: 'openai/gpt-oss-120b',
      max_tokens: 800,
    };

    if (forceJson) {
      payload.response_format = { type: 'json_object' };
    }

    try {
      const chatCompletion = await groq.chat.completions.create(payload);
      return chatCompletion.choices[0]?.message?.content || '';
    } catch (primaryErr) {
      console.warn(`Groq primary model failed (${primaryErr.message}), trying backup model openai/gpt-oss-20b...`);
      payload.model = 'openai/gpt-oss-20b';
      const backupCompletion = await groq.chat.completions.create(payload);
      return backupCompletion.choices[0]?.message?.content || '';
    }
  } catch (error) {
    console.error('Groq Execution Error:', error.message);
    throw error;
  }
}

module.exports = callGroq;