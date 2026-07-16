const axios = require('axios');

const callGrok = async (prompt, systemInstruction) => {
  const response = await axios.post(
    'https://api.x.ai/v1/chat/completions',
    {
      model: 'grok-3-mini',
      messages: [
        {
          role: 'system',
          content: systemInstruction
        },
        {
          role: 'user',
          content: prompt
        }
      ],
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