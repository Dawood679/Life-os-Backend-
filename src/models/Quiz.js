const mongoose = require("mongoose");

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
    questions: [
      {
        question: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswer: { type: String, required: true },
        explanation: { type: String },
      },
    ],
    // --- New Marks & Submission Fields ---
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
      of: String, // Maps question index (or ID) -> chosen answer ("A", "B", etc.)
      default: {},
    },
    submittedAt: {
      type: Date,
    },
    rawResponse: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quiz", quizSchema);