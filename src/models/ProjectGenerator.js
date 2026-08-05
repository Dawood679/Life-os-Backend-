const mongoose = require('mongoose');
const { Type } = require('@google/genai');

// 1. Subdocuments Schemas
const folderItemSchema = new mongoose.Schema({
  path: { type: String },
  description: { type: String }
});

const dbFieldSchema = new mongoose.Schema({
  fieldName: { type: String },
  fieldType: { type: String },
  description: { type: String }
});

const dbModelSchema = new mongoose.Schema({
  modelName: { type: String },
  fields: [dbFieldSchema]
});

// 2. Main Project Generator Schema
const projectGeneratorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    request: { type: String, required: true }, 
    projectTitle: { type: String },
    difficultyLevel: { type: String }, 
    techStack: [{ type: String }],
    description: { type: String },
    features: [{ type: String }],
    folderStructure: [folderItemSchema],
    databaseSchema: [dbModelSchema],
    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// 3. Gemini Structured Output Schema
const projectGeneratorResponseSchema = {
  type: Type.OBJECT,
  properties: {
    projectTitle: { type: Type.STRING },
    difficultyLevel: { type: Type.STRING },
    techStack: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    description: { type: Type.STRING },
    features: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    folderStructure: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          path: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ['path', 'description']
      }
    },
    databaseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          modelName: { type: Type.STRING },
          fields: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                fieldName: { type: Type.STRING },
                fieldType: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ['fieldName', 'fieldType', 'description']
            }
          }
        },
        required: ['modelName', 'fields']
      }
    }
  },
  required: [
    'projectTitle',
    'difficultyLevel',
    'techStack',
    'description',
    'features',
    'folderStructure',
    'databaseSchema'
  ]
};

// 4. Create Model
const ProjectGenerator = mongoose.model('ProjectGenerator', projectGeneratorSchema);

// 5. Clean Combined Export
module.exports = {
  ProjectGenerator,
  projectGeneratorResponseSchema
};