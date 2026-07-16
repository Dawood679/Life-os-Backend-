const mongoose = require('mongoose');
const { Type } = require('@google/genai');

const flashcardSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true }
});

const notesSummarizerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    lectureText: { type: String, required: true },
    summary: { type: String },
    keyPoints: [{ type: String }],
    flashcards: [flashcardSchema],
    rawResponse: { type: String },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// for gemini
const notesSummarizerResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    keyPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING }
        },
        required: ['question', 'answer']
      }
    }
  },
  required: ['summary', 'keyPoints', 'flashcards']
};

module.exports = mongoose.model('NotesSummarizer', notesSummarizerSchema);
module.exports.notesSummarizerResponseSchema = notesSummarizerResponseSchema;