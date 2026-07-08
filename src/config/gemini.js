const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const roadmapResponseSchema = {
  type: Type.OBJECT,
  properties: {
    roadmapTitle: { type: Type.STRING },
    duration: { type: Type.STRING },
    phases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phaseNumber: { type: Type.INTEGER },
          phaseTitle: { type: Type.STRING },
          milestones: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                estimatedWeeks: { type: Type.INTEGER },
                resources: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ['title', 'description', 'estimatedWeeks', 'resources']
            }
          }
        },
        required: ['phaseNumber', 'phaseTitle', 'milestones']
      }
    }
  },
  required: ['roadmapTitle', 'duration', 'phases']
};

const roadmapConfig = {
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: `You are LIFEOS AI — an expert learning path designer and career coach. Your job is to generate structured, chronological learning roadmaps. Be specific, practical, and actionable.`,
    responseMimeType: 'application/json',
    responseSchema: roadmapResponseSchema,
    temperature: 0.4
  }
};

module.exports = { ai, roadmapConfig };