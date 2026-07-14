const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const issueSchema = new mongoose.Schema({
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
    code: { type: String, required: true },
    language: { type: String, default: 'javascript' },
    overallScore: { type: Number }, 
    summary: { type: String },
    bugs: [issueSchema],
    performanceIssues: [issueSchema],
    securityIssues: [issueSchema],
    bestPractices: [issueSchema],
    improvedCode: { type: String },    
    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// for gemini
const codeReviewResponseSchema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.INTEGER },
    summary: { type: Type.STRING },
    bugs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          line: { type: Type.STRING },
          issue: { type: Type.STRING },
          suggestion: { type: Type.STRING }
        },
        required: ['line', 'issue', 'suggestion']
      }
    },
    performanceIssues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          line: { type: Type.STRING },
          issue: { type: Type.STRING },
          suggestion: { type: Type.STRING }
        },
        required: ['line', 'issue', 'suggestion']
      }
    },
    securityIssues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          line: { type: Type.STRING },
          issue: { type: Type.STRING },
          suggestion: { type: Type.STRING }
        },
        required: ['line', 'issue', 'suggestion']
      }
    },
    bestPractices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          line: { type: Type.STRING },
          issue: { type: Type.STRING },
          suggestion: { type: Type.STRING }
        },
        required: ['line', 'issue', 'suggestion']
      }
    },
    improvedCode: { type: Type.STRING }
  },
  required: ['overallScore', 'summary', 'bugs', 'performanceIssues', 'securityIssues', 'bestPractices', 'improvedCode']
};

module.exports = mongoose.model('CodeReview', codeReviewSchema);
module.exports.codeReviewResponseSchema = codeReviewResponseSchema;