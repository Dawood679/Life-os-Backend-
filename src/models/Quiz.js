const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const optionSchema = new mongoose.Schema({
  label: { type: String },
  text: { type: String }    
});

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [optionSchema],
  correctAnswer: { type: String }, 
  explanation: { type: String }     
});

const quizSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    topic: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    numberOfQuestions: { type: Number, default: 10 },
    quizTitle: { type: String },
    questions: [questionSchema],
    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const quizResponseSchema = {
  type: Type.OBJECT,
  properties: {
    quizTitle: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                text: { type: Type.STRING }
              },
              required: ['label', 'text']
            }
          },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ['question', 'options', 'correctAnswer', 'explanation']
      }
    }
  },
  required: ['quizTitle', 'questions']
};

module.exports = mongoose.model('Quiz', quizSchema);
module.exports.quizResponseSchema = quizResponseSchema;