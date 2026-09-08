const CodeReview = require("../models/CodeReview");
const { ai, codeReviewConfig } = require("../config/gemini");
const { callAIWithFallback } = require('../utils/aiWithFallback');
const skillService = require('../services/skillService');
const lifeScoreService = require('../services/lifeScoreService');

/**
 * Universal Work & Code Reviewer Handler
 */
const reviewCode = async (req, res) => {
  try {
    const { code, content, text, language, domain, forcedDomain } = req.body;
    const inputContent = (content || code || text || "").trim();

    if (!inputContent) {
      return res.status(400).json({
        success: false,
        message: "Please provide code, an essay, a proposal, or draft content to review",
      });
    }

    const selectedDomain = forcedDomain || domain || language || "auto";

    const prompt = `
      Perform a comprehensive, multi-perspective Work & Asset Review on the following submission:

      --- SUBMISSION START (${selectedDomain}) ---
      ${inputContent}
      --- SUBMISSION END ---

      INSTRUCTIONS:
      1. Detect domain: ("code", "writing", "business", "academic", "general", or "hybrid").
      2. If technical aspect is present: evaluate bugs, performance, security, architecture, and code quality in perspectives.technical.
      3. If business / strategic / writing aspect is present: evaluate clarity, market viability, structure, tone, and action items in perspectives.business.
      4. If one aspect does not apply, set applicable: false with score: 0 and helpful note.
      5. Provide an improved, production-grade or polished version in improvedContent.
      6. Return valid JSON strictly adhering to schema.
    `;

    const response = await callAIWithFallback(ai, codeReviewConfig, prompt);
    const cleanText = response.text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsedReview = JSON.parse(cleanText);

    // Save with both multi-perspective schema and legacy backward-compatible fields
    const codeReview = await CodeReview.create({
      user: req.user._id,
      inputContent,
      code: inputContent, // Legacy alias
      languageOrDomain: selectedDomain,
      domain: parsedReview.domain || 'general',
      overallScore: parsedReview.overallScore || 70,
      summary: parsedReview.summary || 'Review completed',
      perspectives: parsedReview.perspectives || {
        technical: { applicable: false, score: 0, summary: '', issues: [], bestPractices: [] },
        business: { applicable: false, score: 0, summary: '', marketClarity: 'N/A', suggestions: [], actionItems: [] }
      },
      improvedContent: parsedReview.improvedContent || inputContent,
      improvedCode: parsedReview.improvedContent || inputContent,
      rawResponse: response.text,
    });

    // Recalculate daily Life Score
    try {
      await lifeScoreService.calculateDailyScore(req.user._id);
    } catch (scoreErr) {
      console.error('Life score update error:', scoreErr);
    }

    res.status(201).json({
      success: true,
      message: "Review generated successfully",
      codeReview,
    });
  } catch (error) {
    if (error.message && error.message.includes('All 5 attempts failed')) {
      return res.status(429).json({
        success: false,
        message: 'Service temporarily unavailable. Please try again later.'
      });
    }
    console.error('Review error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error reviewing submission'
    });
  }
};

// get all reviews with pagination
const getReviews = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      CodeReview.find({ user: req.user._id })
        .select("-rawResponse")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CodeReview.countDocuments({ user: req.user._id }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      count: reviews.length,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      reviews,
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching reviews",
    });
  }
};

// get single review
const getReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await CodeReview.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.json({
      success: true,
      review,
    });
  } catch (error) {
    console.error("Get review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching review",
    });
  }
};

// delete review
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await CodeReview.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting review",
    });
  }
};

module.exports = {
  reviewCode,
  getReviews,
  getReview,
  deleteReview,
};
