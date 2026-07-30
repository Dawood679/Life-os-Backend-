const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const resumeAnalysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Optional: if user pastes a target job description, we tailor the analysis to it
    jobDescription: { type: String },

    // Raw text extracted from the uploaded PDF resume
    resumeText: { type: String, required: true },
    fileName: { type: String },

    // ─── AI GENERATED OUTPUT ────────────────────────────────────────────────
    atsScore: { type: Number },              // overall 0-100
    atsBreakdown: {
      formatting: { type: Number },          // 0-100
      keywords: { type: Number },            // 0-100
      readability: { type: Number },         // 0-100
      sectionCompleteness: { type: Number }  // 0-100
    },
    summary: { type: String },

    strengths: [{ type: String }],
    matchedSkills: [{ type: String }],
    missingSkills: [{ type: String }],

    atsIssues: [{ type: String }],           // things that break ATS parsing
    recommendedKeywords: [{ type: String }], // keywords to add for better ATS match

    improvementSuggestions: [
      {
        area: { type: String },              // e.g. "Experience", "Skills", "Formatting"
        issue: { type: String },
        suggestion: { type: String },
        priority: { type: String }           // high, medium, low
      }
    ],

    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// ─── GEMINI SCHEMA ────────────────────────────────────────────────────────────
const resumeAnalysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    atsScore: { type: Type.INTEGER },
    atsBreakdown: {
      type: Type.OBJECT,
      properties: {
        formatting: { type: Type.INTEGER },
        keywords: { type: Type.INTEGER },
        readability: { type: Type.INTEGER },
        sectionCompleteness: { type: Type.INTEGER }
      },
      required: ['formatting', 'keywords', 'readability', 'sectionCompleteness']
    },
    summary: { type: Type.STRING },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    matchedSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    missingSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    atsIssues: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    recommendedKeywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    improvementSuggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          issue: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          priority: { type: Type.STRING }
        },
        required: ['area', 'issue', 'suggestion', 'priority']
      }
    }
  },
  required: [
    'atsScore',
    'atsBreakdown',
    'summary',
    'strengths',
    'matchedSkills',
    'missingSkills',
    'atsIssues',
    'recommendedKeywords',
    'improvementSuggestions'
  ]
};

module.exports = mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
module.exports.resumeAnalysisResponseSchema = resumeAnalysisResponseSchema;