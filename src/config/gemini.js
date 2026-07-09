const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

//schemas
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

const studyPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    planTitle: { type: Type.STRING },
    summary: { type: Type.STRING },
    totalWeeks: { type: Type.INTEGER },
    dailyPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          date: { type: Type.STRING },
          tasks: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          estimatedHours: { type: Type.NUMBER }
        },
        required: ['day', 'date', 'tasks', 'estimatedHours']
      }
    },
    weeklyTargets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          week: { type: Type.INTEGER },
          target: { type: Type.STRING },
          topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          successCriteria: { type: Type.STRING }
        },
        required: ['week', 'target', 'topics', 'successCriteria']
      }
    },
    tips: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ['planTitle', 'summary', 'totalWeeks', 'dailyPlan', 'weeklyTargets', 'tips']
};



//configs
const roadmapConfig = {
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: `You are LIFEOS AI — an expert learning path designer and career coach. Your job is to generate structured, chronological learning roadmaps. Be specific, practical, and actionable.`,
    responseMimeType: 'application/json',
    responseSchema: roadmapResponseSchema,
    temperature: 0.4
  }
};

const studyPlanConfig = {
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: `You are LIFEOS AI — an expert study planner and learning coach. Your job is to generate personalized, realistic daily study plans based on the user's available time, deadline, and current level. Be practical, encouraging, and specific.`,
    responseMimeType: 'application/json',
    responseSchema: studyPlanResponseSchema,
    temperature: 0.4
  }
};


module.exports = { ai, roadmapConfig, studyPlanConfig };