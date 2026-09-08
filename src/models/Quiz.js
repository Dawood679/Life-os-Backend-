const mongoose = require("mongoose");
const { Type } = require("@google/genai");

const quizSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    topic: { type: String, required: true },
    difficulty: { type: String, default: "beginner" },
    numberOfQuestions: { type: Number, default: 10 },
    quizTitle: { type: String },

    // Canonical Skill Mapping
    isVerificationMode: { type: Boolean, default: false },
    canonicalSkill: { type: String, default: "General" },
    subCompetency: { type: String },
    isRecognizedSkill: { type: Boolean, default: true },

    questions: [
      {
        question: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswer: { type: String, required: true },
        explanation: { type: String },
      },
    ],
    // --- Marks & Submission Fields ---
    isSubmitted: {
      type: Boolean,
      default: false,
    },
    score: {
      type: Number,
      default: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    userAnswers: {
      type: Map,
      of: String, // Maps question index -> chosen answer ("A", "B", etc.)
      default: {},
    },
    submittedAt: {
      type: Date,
    },
    rawResponse: { type: String },
  },
  { timestamps: true }
);

// Gemini Structured Output Schema for Quiz Generator
const quizResponseSchema = {
  type: Type.OBJECT,
  properties: {
    quizTitle: { type: Type.STRING },
    canonicalSkill: { type: Type.STRING },
    subCompetency: { type: Type.STRING },
    isRecognizedSkill: { type: Type.BOOLEAN },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["question", "options", "correctAnswer", "explanation"]
      }
    }
  },
  required: ["quizTitle", "canonicalSkill", "subCompetency", "isRecognizedSkill", "questions"]
};

module.exports = mongoose.model("Quiz", quizSchema);
module.exports.quizResponseSchema = quizResponseSchema;