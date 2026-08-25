const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const issueSchema = new mongoose.Schema({
  lineOrSection: { type: String },
  issue: { type: String },
  suggestion: { type: String }
});

const legacyIssueSchema = new mongoose.Schema({
  line: { type: String },
  issue: { type: String },
  suggestion: { type: String }
});

const codeReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    inputContent: { type: String },
    code: { type: String }, // Legacy alias for inputContent
    languageOrDomain: { type: String, default: 'auto' },
    domain: {
      type: String,
      enum: ['code', 'writing', 'business', 'academic', 'general', 'hybrid'],
      default: 'general'
    },
    overallScore: { type: Number, min: 0, max: 100 },
    summary: { type: String },

    // Multi-perspective evaluation (Technical & Business in 1 single call)
    perspectives: {
      technical: {
        applicable: { type: Boolean, default: true },
        score: { type: Number, default: 0 },
        summary: { type: String, default: '' },
        issues: [issueSchema],
        bestPractices: [{ type: String }]
      },
      business: {
        applicable: { type: Boolean, default: true },
        score: { type: Number, default: 0 },
        summary: { type: String, default: '' },
        marketClarity: { type: String, default: 'N/A' },
        suggestions: [{ type: String }],
        actionItems: [{ type: String }]
      }
    },

    improvedContent: { type: String },

    // Backward-compatible fields
    bugs: [legacyIssueSchema],
    performanceIssues: [legacyIssueSchema],
    securityIssues: [legacyIssueSchema],
    bestPractices: [legacyIssueSchema],
    improvedCode: { type: String },

    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Gemini Structured Output Schema
const codeReviewResponseSchema = {
  type: Type.OBJECT,
  properties: {
    domain: { type: Type.STRING },
    overallScore: { type: Type.INTEGER },
    summary: { type: Type.STRING },
    perspectives: {
      type: Type.OBJECT,
      properties: {
        technical: {
          type: Type.OBJECT,
          properties: {
            applicable: { type: Type.BOOLEAN },
            score: { type: Type.INTEGER },
            summary: { type: Type.STRING },
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  lineOrSection: { type: Type.STRING },
                  issue: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                },
                required: ['lineOrSection', 'issue', 'suggestion']
              }
            },
            bestPractices: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['applicable', 'score', 'summary', 'issues', 'bestPractices']
        },
        business: {
          type: Type.OBJECT,
          properties: {
            applicable: { type: Type.BOOLEAN },
            score: { type: Type.INTEGER },
            summary: { type: Type.STRING },
            marketClarity: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['applicable', 'score', 'summary', 'marketClarity', 'suggestions', 'actionItems']
        }
      },
      required: ['technical', 'business']
    },
    improvedContent: { type: Type.STRING }
  },
  required: ['domain', 'overallScore', 'summary', 'perspectives', 'improvedContent']
};

module.exports = mongoose.model('CodeReview', codeReviewSchema);
module.exports.codeReviewResponseSchema = codeReviewResponseSchema;