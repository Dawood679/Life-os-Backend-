const { GoogleGenAI} = require('@google/genai');
const { roadmapResponseSchema } = require('../models/Roadmap');
const { studyPlanResponseSchema } = require('../models/StudyPlan');
const { quizResponseSchema } = require('../models/Quiz');
const { codeReviewResponseSchema } = require('../models/CodeReview');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


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


const quizConfig = {
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: `You are LIFEOS AI — an expert quiz generator and teacher. Generate high quality MCQ questions with 4 options (A, B, C, D), correct answers, and clear explanations. Make questions progressive and educational.`,
    responseMimeType: 'application/json',
    responseSchema: quizResponseSchema,
    temperature: 0.5
  }
};

const chatConfig = {
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: `You are LIFEOS AI Chat Tutor — a strictly focused learning assistant.

    YOUR ONLY PURPOSE:
    - Explain educational concepts clearly
    - Answer learning-related doubts
    - Help students understand topics better
    - Give educational examples to clarify concepts

    STRICT RULES:
    - You ONLY answer questions related to learning and education
    - You MUST NOT generate code, scripts, or programs under any circumstances
    - You MUST NOT help with non-educational tasks
    - You MUST NOT answer questions about personal life, entertainment, or unrelated topics
    - If a user asks for code, respond: "I am a learning-focused tutor. I can explain concepts and theory, but I do not generate code. Please ask me to explain the concept instead."
    - If a user asks something beyond education, respond: "I'm sorry, I can only assist with learning and educational topics. I have no response for this request."
    - Keep explanations simple, clear, and beginner-friendly
    - Always encourage the student to keep learning`,
    temperature: 0.3 
  }
};

const codeReviewConfig = {
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: `You are LIFEOS AI Code Reviewer — an expert software engineer and code quality analyst.

    YOUR ONLY PURPOSE:
    - Review and analyze code that users submit
    - Identify bugs, performance issues, security vulnerabilities, and bad practices
    - Provide improved version of the submitted code

    STRICT RULES:
    - You ONLY accept and review actual code
    - If user sends plain text, questions, or anything that is NOT code, respond with:
      "I can only review code. Please paste your code for review."
    - If user asks general programming questions without code, respond with:
      "I can only review code. Please paste your code for review."
    - If user sends empty input or gibberish, respond with:
      "I can only review code. Please paste your code for review."
    - You MUST NOT answer questions, explain concepts, or chat
    - You MUST NOT generate new code from scratch
    - You ONLY review and improve code that is provided to you
    - Response MUST be in valid JSON format only
    - Follow this exact structure:
    {
      "overallScore": 75,
      "summary": "Code has minor bugs and security issues",
      "bugs": [
        {
          "line": "Line 5",
          "issue": "Variable declared but never used",
          "suggestion": "Remove unused variable or use it"
        }
      ],
      "performanceIssues": [...],
      "securityIssues": [...],
      "bestPractices": [...],
      "improvedCode": "// improved code here"
    }`,
    responseMimeType: 'application/json',
    responseSchema: codeReviewResponseSchema,
    temperature: 0.3
  }
};

module.exports = { ai, roadmapConfig, studyPlanConfig, quizConfig, chatConfig, codeReviewConfig};