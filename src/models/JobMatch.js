const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const jobMatchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    jobDescription: { type: String, required: true },
    jobTitle: { type: String },
    company: { type: String },

    // AI Generated Output
    matchPercentage: { type: Number }, 
    matchSummary: { type: String },      
    matchedSkills: [{ type: String }],     
    missingSkills: [{ type: String }],      
    learningPlan: [
      {
        skill: { type: String },
        priority: { type: String },        
        estimatedTime: { type: String },   
        resources: [{ type: String }]
      }
    ],
    recommendations: [{ type: String }],  
    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// for gemini
const jobMatchResponseSchema = {
  type: Type.OBJECT,
  properties: {
    jobTitle: { type: Type.STRING },
    company: { type: Type.STRING },
    matchPercentage: { type: Type.INTEGER },
    matchSummary: { type: Type.STRING },
    matchedSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    missingSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    learningPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skill: { type: Type.STRING },
          priority: { type: Type.STRING },
          estimatedTime: { type: Type.STRING },
          resources: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ['skill', 'priority', 'estimatedTime', 'resources']
      }
    },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: [
    'jobTitle',
    'matchPercentage',
    'matchSummary',
    'matchedSkills',
    'missingSkills',
    'learningPlan',
    'recommendations'
  ]
};

module.exports = mongoose.model('JobMatch', jobMatchSchema);
module.exports.jobMatchResponseSchema = jobMatchResponseSchema;