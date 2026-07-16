const NotesSummarizer = require('../models/NotesSummarizer');
const { ai, notesSummarizerConfig } = require('../config/gemini');
const callAIWithFallback = require('../utils/aiWithFallback');

const generateSummary = async (req, res) => {
  try {
    const { lectureText } = req.body;
    
    if (!lectureText) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the lecture text or notes to summarize.'
      });
    }

    const prompt = `
      User input text: "${lectureText}"
      
      If this input contains notes, study materials, or a lecture transcript, extract and generate:
      1. A concise overview summary.
      2. Bulleted key points.
      3. Practical flashcards with clear questions and answers.

      If this input is NOT a note/lecture summarization request (e.g. it's a general question, a coding request, or completely unrelated), respond in JSON with all arrays empty and set the "summary" field to:
      "I can only summarize notes, lectures, or text documents. Please provide a relevant text payload to summarize."
      
      Response must follow the exact JSON structure defined in the schema.
    `;

    const response = await callAIWithFallback(ai, config, prompt);

    const parsed = JSON.parse(response.text);

    const savedSummary = await NotesSummarizer.create({
      user: req.user._id,
      lectureText,
      summary: parsed.summary,
      keyPoints: parsed.keyPoints,
      flashcards: parsed.flashcards,
      rawResponse: response.text
    });

    res.status(201).json({
      success: true,
      message: 'Notes processed and summarized successfully',
      data: savedSummary
    });
  } catch (error) {
     if (error.message.includes('All 5 attempts failed')) {
    return res.status(429).json({
      success: false,
      message: 'Service temporarily unavailable. Please try again later.'
    });
  }
  res.status(500).json({
    success: false,
    message: 'Server error'
  });
}
};

// get all summary
const getSummaries = async (req, res) => {
  try {
    const summaries = await NotesSummarizer.find({ user: req.user._id })
      .select('-rawResponse')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: summaries.length,
      summaries
    });
  } catch (error) {
    console.error('Get summaries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching summaries'
    });
  }
};

// get summary by id
const getSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await NotesSummarizer.findOne({
      _id: id,
      user: req.user._id
    }).select('-rawResponse');

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found'
      });
    }

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Get single summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching summary'
    });
  }
};

// delete
const deleteSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await NotesSummarizer.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found'
      });
    }

    res.json({
      success: true,
      message: 'Summary deleted successfully'
    });
  } catch (error) {
    console.error('Delete summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting summary'
    });
  }
};

module.exports = { generateSummary, getSummaries, getSummary, deleteSummary };