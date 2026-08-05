const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function callGroq(prompt, systemInstruction = '', messagesHistory = []) {
  try {
    const messages = [];

    // System instruction প্রসেসিং
    let finalSystemInstruction = systemInstruction ? systemInstruction.trim() : '';

    // Groq-এর বাধ্যবাধকতা: response_format: 'json_object' থাকলে 'json' শব্দটি থাকতেই হবে
    if (!finalSystemInstruction.toLowerCase().includes('json')) {
      finalSystemInstruction += ' Respond in JSON format.';
    }

    messages.push({ role: 'system', content: finalSystemInstruction.trim() });

    // History অথবা User Prompt যোগ করা
    if (messagesHistory && messagesHistory.length > 0) {
      messages.push(...messagesHistory);
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
    });

    return chatCompletion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Groq Execution Error:', error.message);
    throw error;
  }
}

module.exports = callGroq;