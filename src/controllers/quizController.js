const Quiz = require('../models/Quiz');
const { ai, quizConfig } = require('../config/gemini');


const generateQuiz = async (req, res) => {
  try {
    const { topic, difficulty, numberOfQuestions } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a topic'
      });
    }

    const prompt = `
      Generate ${numberOfQuestions || 10} MCQ questions for the following:

      Topic: ${topic}
      Difficulty: ${difficulty || 'beginner'}

      Rules:
      - Each question must have exactly 4 options labeled A, B, C, D
      - correctAnswer must be one of: "A", "B", "C", "D"
      - Explanation should be clear and educational
      - Questions should be progressive (easy to hard)
      - Focus specifically on ${topic}
    `;

    const response = await ai.models.generateContent({
      model: quizConfig.model,
      config: quizConfig.config,
      contents: prompt
    });

    const parsedQuiz = JSON.parse(response.text);

    const quiz = await Quiz.create({
      user: req.user._id,
      topic,
      difficulty: difficulty || 'beginner',
      numberOfQuestions: numberOfQuestions || 10,
      quizTitle: parsedQuiz.quizTitle,
      questions: parsedQuiz.questions,
      rawResponse: response.text
    });

    res.status(201).json({
      success: true,
      message: 'Quiz generated successfully',
      quiz
    });

  } catch (error) {
    console.error('Generate quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating quiz'
    });
  }
};

// get all quizzes
const getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ user: req.user._id })
      .select('-rawResponse -questions')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: quizzes.length,
      quizzes
    });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching quizzes'
    });
  }
};

// getQuiz by id
const getQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const quiz = await Quiz.findOne({
      _id: id,
      user: req.user._id
    }).select('-rawResponse');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    res.json({
      success: true,
      quiz
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching quiz'
    });
  }
};

// delete quiz
const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    const quiz = await Quiz.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting quiz'
    });
  }
};

module.exports = { generateQuiz, getQuizzes, getQuiz, deleteQuiz };