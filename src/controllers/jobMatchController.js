const JobMatch = require('../models/JobMatch');
const { ai, jobMatchConfig } = require('../config/gemini');
const { callAIWithFallback } = require('../utils/aiWithFallback');


const analyzeJobMatch = async (req, res) => {
  try {
    const { jobDescription } = req.body;

    if (!jobDescription) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a job description'
      });
    }

    const User = require('../models/User');
    const userProfile = await User.findById(req.user._id);

    const userSkills = userProfile.skills?.length > 0
      ? userProfile.skills.join(', ')
      : 'No skills listed in profile';

    const userInfo = `
      Name: ${userProfile.name}
      Job Title: ${userProfile.jobTitle || 'Not specified'}
      Experience: ${userProfile.experience || 0} years
      Current Skills: ${userSkills}
      Education: ${userProfile.degree || 'Not specified'} in ${userProfile.major || 'Not specified'}
    `;

    const prompt = `
      Analyze the match between this candidate's profile and the job description.

      CANDIDATE PROFILE:
      ${userInfo}

      JOB DESCRIPTION:
      ${jobDescription}

      Instructions:
      - Calculate honest match percentage based on required skills vs candidate skills
      - List all skills that match between candidate and job
      - List all missing skills required by the job
      - Create a prioritized learning plan for missing skills
      - Give practical recommendations to improve chances
      - Response must be in JSON format following the exact schema provided
    `;

    const response = await callAIWithFallback(ai, jobMatchConfig, prompt);
    console.log(`Job match by: ${response.provider} on attempt: ${response.attempt}`);

    const parsedMatch = JSON.parse(response.text);

    const jobMatch = await JobMatch.create({
      user: req.user._id,
      jobDescription,
      jobTitle: parsedMatch.jobTitle,
      company: parsedMatch.company,
      matchPercentage: parsedMatch.matchPercentage,
      matchSummary: parsedMatch.matchSummary,
      matchedSkills: parsedMatch.matchedSkills,
      missingSkills: parsedMatch.missingSkills,
      learningPlan: parsedMatch.learningPlan,
      recommendations: parsedMatch.recommendations,
      rawResponse: response.text
    });

    res.status(201).json({
      success: true,
      message: 'Job match analyzed successfully',
      jobMatch
    });

  } catch (error) {
    if (error.message.includes('All 5 attempts failed')) {
      return res.status(429).json({
        success: false,
        message: 'Service temporarily unavailable. Please try again later.'
      });
    }
    console.error('Job match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error analyzing job match'
    });
  }
};

// get all jobs
const getJobMatches = async (req, res) => {
  try {
    const jobMatches = await JobMatch.find({ user: req.user._id })
      .select('-rawResponse -jobDescription -learningPlan')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: jobMatches.length,
      jobMatches
    });
  } catch (error) {
    console.error('Get job matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching job matches'
    });
  }
};

// get job by id
const getJobMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const jobMatch = await JobMatch.findOne({
      _id: id,
      user: req.user._id
    }).select('-rawResponse');

    if (!jobMatch) {
      return res.status(404).json({
        success: false,
        message: 'Job match not found'
      });
    }

    res.json({
      success: true,
      jobMatch
    });
  } catch (error) {
    console.error('Get job match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching job match'
    });
  }
};

// delete
const deleteJobMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const jobMatch = await JobMatch.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!jobMatch) {
      return res.status(404).json({
        success: false,
        message: 'Job match not found'
      });
    }

    res.json({
      success: true,
      message: 'Job match deleted successfully'
    });
  } catch (error) {
    console.error('Delete job match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting job match'
    });
  }
};

module.exports = { analyzeJobMatch, getJobMatches, getJobMatch, deleteJobMatch };