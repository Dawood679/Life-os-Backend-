const NotesSummarizer = require('../models/NotesSummarizer');
const { ai, notesSummarizerConfig } = require('../config/gemini');
const { callAIWithFallback } = require('../utils/aiWithFallback');

// 1. Generate Summary
const generateSummary = async (req, res) => {
  try {
    const { lectureText } = req.body;

    if (!lectureText) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the lecture text or notes to summarize.',
      });
    }

    const prompt = `
      User input text: "${lectureText}"

      If this input contains notes, study materials, or a lecture transcript, extract and generate:
      1. A concise overview summary (string).
      2. Bulleted key points (array of strings).
      3. Practical flashcards (array of objects with "question" and "answer" properties).

      If this input is NOT a note/lecture summarization request, respond in JSON with all arrays empty and set the "summary" field to:
      "I can only summarize notes, lectures, or text documents. Please provide a relevant text payload to summarize."

      Respond STRICTLY in valid JSON matching this schema format:
      {
        "summary": "Summary text here",
        "keyPoints": ["Point 1", "Point 2"],
        "flashcards": [
          { "question": "Question 1", "answer": "Answer 1" }
        ]
      }
    `;

    const response = await callAIWithFallback(ai, notesSummarizerConfig, prompt);

    // 🎯 Fix 1: Clean markdown JSON wrap before parsing
    const cleanText = response.text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let parsed = {};
    try {
      parsed = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError, 'Raw Text:', response.text);
      return res.status(500).json({
        success: false,
        message: 'Failed to parse AI response into structured JSON',
      });
    }

    // 🎯 Fix 2: Safe defaults to prevent Mongoose schema validation errors
    const savedSummary = await NotesSummarizer.create({
      user: req.user._id,
      lectureText,
      summary: parsed.summary || 'No summary generated.',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
      rawResponse: response.text,
    });

    res.status(201).json({
      success: true,
      message: 'Notes processed and summarized successfully',
      data: savedSummary,
    });
  } catch (error) {
    console.error('Generate summary error:', error);

    // 🎯 Fix 3: Safe error message checking
    const errorMessage = error?.message || '';

    if (errorMessage.includes('All 5 attempts failed')) {
      return res.status(429).json({
        success: false,
        message: 'Service temporarily unavailable. Please try again later.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error processing summary',
    });
  }
};

// 2. Get all summaries
const getSummaries = async (req, res) => {
  try {
    const summaries = await NotesSummarizer.find({ user: req.user._id })
      .select('-rawResponse')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: summaries.length,
      summaries,
    });
  } catch (error) {
    console.error('Get summaries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching summaries',
    });
  }
};

// 3. Get summary by ID
const getSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await NotesSummarizer.findOne({
      _id: id,
      user: req.user._id,
    }).select('-rawResponse');

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found',
      });
    }

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Get single summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching summary',
    });
  }
};

// 4. Delete summary
const deleteSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await NotesSummarizer.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found',
      });
    }

    res.json({
      success: true,
      message: 'Summary deleted successfully',
    });
  } catch (error) {
    console.error('Delete summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting summary',
    });
  }
};

module.exports = {
  generateSummary,
  getSummaries,
  getSummary,
  deleteSummary,
};