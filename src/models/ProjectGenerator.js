const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const milestoneSchema = new mongoose.Schema({
  stepNumber: { type: Number },
  title: { type: String },
  description: { type: String },
  deliverable: { type: String },
  checklist: [{ type: String }],
  isCompleted: { type: Boolean, default: false }
});

const legacyFolderItemSchema = new mongoose.Schema({
  path: { type: String },
  description: { type: String }
});

const legacyDbFieldSchema = new mongoose.Schema({
  fieldName: { type: String },
  fieldType: { type: String },
  description: { type: String }
});

const legacyDbModelSchema = new mongoose.Schema({
  modelName: { type: String },
  fields: [legacyDbFieldSchema]
});

const projectGeneratorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    request: { type: String, required: true },
    planTitle: { type: String },
    projectTitle: { type: String }, // Legacy alias
    category: {
      type: String,
      default: 'general'
    },
    difficultyLevel: { type: String, default: 'intermediate' },
    estimatedDuration: { type: String, default: '4 weeks' },
    description: { type: String },

    // Universal milestone-driven roadmap
    milestones: [milestoneSchema],
    resourcesOrTools: [{ type: String }],

    // Legacy fields for backward compatibility
    techStack: [{ type: String }],
    features: [{ type: String }],
    folderStructure: [legacyFolderItemSchema],
    databaseSchema: [legacyDbModelSchema],

    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Gemini Structured Output Schema
const projectGeneratorResponseSchema = {
  type: Type.OBJECT,
  properties: {
    planTitle: { type: Type.STRING },
    category: { type: Type.STRING },
    difficultyLevel: { type: Type.STRING },
    estimatedDuration: { type: Type.STRING },
    description: { type: Type.STRING },
    resourcesOrTools: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    milestones: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          deliverable: { type: Type.STRING },
          checklist: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ['stepNumber', 'title', 'description', 'deliverable', 'checklist']
      }
    }
  },
  required: [
    'planTitle',
    'category',
    'difficultyLevel',
    'estimatedDuration',
    'description',
    'resourcesOrTools',
    'milestones'
  ]
};

const ProjectGenerator = mongoose.model('ProjectGenerator', projectGeneratorSchema);

module.exports = {
  ProjectGenerator,
  projectGeneratorResponseSchema
};