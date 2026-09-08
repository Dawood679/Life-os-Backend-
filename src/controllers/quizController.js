const Quiz = require("../models/Quiz");
const { ai, quizConfig } = require("../config/gemini");
const { callAIWithFallback } = require("../utils/aiWithFallback");
const skillService = require("../services/skillService");
const lifeScoreService = require("../services/lifeScoreService");

const generateQuiz = async (req, res) => {
  try {
    const { topic, difficulty = "beginner", numberOfQuestions = 10, isVerificationMode = false } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: "Please provide a topic",
      });
    }

    const verificationInstructions = isVerificationMode
      ? `\nMODE: OFFICIAL SKILL VERIFICATION ASSESSMENT. Questions must be rigorous, practical scenario-based evaluations testing real competency.`
      : `\nMODE: PRACTICE QUIZ. Questions should be educational and progressive.`;

    const prompt = `
Generate ${numberOfQuestions || 10} MCQ questions about "${topic}" at a ${difficulty || "beginner"} level.${verificationInstructions}

REQUIREMENTS:
1. "quizTitle": Professional, clear title (e.g. "${topic} Competency Assessment").
2. "canonicalSkill": The root recognized professional/academic skill (e.g. if topic is "React Props vs State", canonicalSkill is "React.js").
3. "subCompetency": The specific sub-domain (e.g. "State Management", "Component Architecture").
4. "isRecognizedSkill": boolean (true for legitimate tech, business, science, medical, language, or trade skills; false for random trivia or entertainment).
5. "questions": Array of exactly ${numberOfQuestions || 10} questions.
   - "options": JSON array of exactly 4 strings ["Option A text", "Option B text", "Option C text", "Option D text"] (Do NOT prefix with "A)" or "1.").
   - "correctAnswer": Exactly "A", "B", "C", or "D".
   - "explanation": Concise 1-2 sentence explanation of the solution.
`;

    const response = await callAIWithFallback(ai, quizConfig, prompt);

    const cleanText = response.text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsedQuiz = JSON.parse(cleanText);

    const quiz = await Quiz.create({
      user: req.user._id,
      topic,
      difficulty: difficulty || "beginner",
      numberOfQuestions: numberOfQuestions || 10,
      isVerificationMode: !!isVerificationMode,
      canonicalSkill: parsedQuiz.canonicalSkill || topic,
      subCompetency: parsedQuiz.subCompetency || "Core Concepts",
      isRecognizedSkill: parsedQuiz.isRecognizedSkill ?? true,
      quizTitle: parsedQuiz.quizTitle || `${topic} Quiz`,
      questions: parsedQuiz.questions || [],
      rawResponse: response.text,
    });

    res.status(201).json({
      success: true,
      message: "Quiz generated successfully",
      quiz,
    });
  } catch (error) {
    if (error.message && error.message.includes("All 5 attempts failed")) {
      return res.status(429).json({
        success: false,
        message: "Service temporarily unavailable. Please try again later.",
      });
    }
    console.error("Generate quiz error:", error);
    res.status(500).json({
      success: false,
      message: "Server error generating quiz",
    });
  }
};

// Submit Quiz Answers & Save Marks
const submitQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { userAnswers } = req.body; // Expecting { "0": "A", "1": "C", ... }

    if (!userAnswers || typeof userAnswers !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing user answers",
      });
    }

    const quiz = await Quiz.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    // Evaluate score against complete stored questions array
    let score = 0;
    const totalMarks = quiz.questions.length;

    quiz.questions.forEach((question, index) => {
      const selectedAnswer = userAnswers[index] ?? userAnswers[String(index)];
      if (selectedAnswer && selectedAnswer.trim().toUpperCase() === question.correctAnswer.trim().toUpperCase()) {
        score += 1;
      }
    });

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;

    // Save fields to quiz document
    quiz.score = score;
    quiz.totalMarks = totalMarks;
    quiz.percentage = percentage;
    quiz.userAnswers = new Map(Object.entries(userAnswers));
    quiz.isSubmitted = true;
    quiz.submittedAt = new Date();

    await quiz.save();

    // Step 1: Cross-module Skill Verification & Life Score Trigger
    if (percentage >= 75 && quiz.isRecognizedSkill) {
      try {
        const canonicalName = quiz.canonicalSkill || quiz.topic;
        await skillService.addVerifiedSkill(req.user._id, {
          skill: canonicalName,
          category: 'learning',
          score: percentage,
          source: 'quiz'
        });
      } catch (skillErr) {
        console.error('Skill verification warning:', skillErr);
      }
    }

    // Recalculate daily Life Score
    try {
      await lifeScoreService.calculateDailyScore(req.user._id);
    } catch (scoreErr) {
      console.error('Life score update warning:', scoreErr);
    }

    res.json({
      success: true,
      message: "Quiz submitted successfully",
      quiz,
    });
  } catch (error) {
    console.error("Submit quiz error:", error);
    res.status(500).json({
      success: false,
      message: "Server error submitting quiz",
    });
  }
};

// Get all quizzes with Pagination
const getQuizzes = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const totalCount = await Quiz.countDocuments({ user: req.user._id });

    const quizzes = await Quiz.find({ user: req.user._id })
      .select("-rawResponse -questions.explanation")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.json({
      success: true,
      count: quizzes.length,
      pagination: {
        totalItems: totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      quizzes,
    });
  } catch (error) {
    console.error("Get quizzes error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching quizzes",
    });
  }
};

// Get quiz by ID
const getQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const quiz = await Quiz.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    res.json({
      success: true,
      quiz,
    });
  } catch (error) {
    console.error("Get quiz error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching quiz",
    });
  }
};

// Delete quiz
const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const quiz = await Quiz.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    res.json({
      success: true,
      message: "Quiz deleted successfully",
    });
  } catch (error) {
    console.error("Delete quiz error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting quiz",
    });
  }
};

module.exports = {
  generateQuiz,
  submitQuiz,
  getQuizzes,
  getQuiz,
  deleteQuiz,
};