const ResumeAnalysis = require('../models/ResumeAnalysis');
const { ai, resumeAnalysisConfig } = require('../config/gemini');
const { callAIWithFallback } = require('../utils/aiWithFallback');
const { extractTextFromPDF } = require('../utils/pdfParser');

// ─── ANALYZE RESUME ───────────────────────────────────────────────────────────
const analyzeResume = async (req, res) => {
  try {
    const resumeFile = req.files.resume; // validated by validateResumeFile middleware
    const { jobDescription } = req.body; // optional — tailors the analysis to a specific job

    // 1. Extract text from the uploaded PDF (in-memory buffer, no disk I/O)
    let extracted;
    try {
      extracted = await extractTextFromPDF(resumeFile.data);
    } catch (err) {
      return res.status(422).json({
        success: false,
        message: err.message
      });
    }

    const resumeText = extracted.text;

    // 2. Build the prompt for Gemini
    const prompt = `
      Analyze the following resume text (extracted from a PDF, so spacing may be imperfect).

      RESUME TEXT:
      ${resumeText}

      ${jobDescription ? `TARGET JOB DESCRIPTION:\n${jobDescription}` : 'No specific job description was provided — infer the candidate\'s target role from the resume itself.'}

      Instructions:
      - Score this resume as an ATS + recruiter would (0-100)
      - Identify matched skills and clearly missing skills
      - Flag concrete ATS-parsing risks in the formatting/structure
      - Recommend keywords to add for better ATS matching
      - Give prioritized, actionable improvement suggestions
      - Response must be in JSON format following the exact schema provided
    `;

    // 3. Call Gemini (with fallback, same pattern as job match)
    const response = await callAIWithFallback(ai, resumeAnalysisConfig, prompt);
    console.log(`Resume analysis by: ${response.provider} on attempt: ${response.attempt}`);

    const parsed = JSON.parse(response.text);

    // 4. Persist
    const resumeAnalysis = await ResumeAnalysis.create({
      user: req.user._id,
      jobDescription: jobDescription || undefined,
      resumeText,
      fileName: resumeFile.name,
      atsScore: parsed.atsScore,
      atsBreakdown: parsed.atsBreakdown,
      summary: parsed.summary,
      strengths: parsed.strengths,
      matchedSkills: parsed.matchedSkills,
      missingSkills: parsed.missingSkills,
      atsIssues: parsed.atsIssues,
      recommendedKeywords: parsed.recommendedKeywords,
      improvementSuggestions: parsed.improvementSuggestions,
      rawResponse: response.text
    });

    res.status(201).json({
      success: true,
      message: 'Resume analyzed successfully',
      resumeAnalysis
    });

  } catch (error) {
    if (error.message && error.message.includes('All 5 attempts failed')) {
      return res.status(429).json({
        success: false,
        message: 'Service temporarily unavailable. Please try again later.'
      });
    }
    console.error('Resume analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error analyzing resume'
    });
  }
};

// ─── GET ALL RESUME ANALYSES ──────────────────────────────────────────────────
const getResumeAnalyses = async (req, res) => {
  try {
    const analyses = await ResumeAnalysis.find({ user: req.user._id })
      .select('-rawResponse -resumeText -improvementSuggestions')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: analyses.length,
      analyses
    });
  } catch (error) {
    console.error('Get resume analyses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching resume analyses'
    });
  }
};

// ─── GET SINGLE RESUME ANALYSIS ───────────────────────────────────────────────
const getResumeAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    const analysis = await ResumeAnalysis.findOne({
      _id: id,
      user: req.user._id
    }).select('-rawResponse');

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Resume analysis not found'
      });
    }

    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Get resume analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching resume analysis'
    });
  }
};

// ─── DELETE RESUME ANALYSIS ───────────────────────────────────────────────────
const deleteResumeAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    const analysis = await ResumeAnalysis.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Resume analysis not found'
      });
    }

    res.json({ success: true, message: 'Resume analysis deleted successfully' });
  } catch (error) {
    console.error('Delete resume analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting resume analysis'
    });
  }
};

module.exports = {
  analyzeResume,
  getResumeAnalyses,
  getResumeAnalysis,
  deleteResumeAnalysis
};