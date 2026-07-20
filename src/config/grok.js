const axios = require('axios');

const callGrok = async (prompt, systemInstruction, history = []) => {
  const messages = history.length > 0
    ? [
        { role: 'system', content: systemInstruction },
        ...history
      ]
    : [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ];

  const response = await axios.post(
    'https://api.x.ai/v1/chat/completions',
    {
      model: 'grok-3-mini',
      messages,
      temperature: 0.4
      
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content;
};

module.exports = callGrok;