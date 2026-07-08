const Roadmap = require('../models/Roadmap');
const { ai, roadmapConfig } = require('../config/gemini');

const buildPrompt = (goal) => `
  Generate a detailed learning roadmap for this goal:
  "${goal}"
  
  Make it specific, practical and chronological.
  Include real resources like MDN, freeCodeCamp, official docs.
  Break it down into phases with clear milestones.
`;


const generateRoadmap = async (req, res) => {
  try {
    const { goal } = req.body;

    if (!goal) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a goal'
      });
    }

    const existingRoadmap = await Roadmap.findOne({ user: req.user._id });
    if (existingRoadmap) {
      return res.json({
        success: true,
        message: 'Roadmap fetched from database',
        fromCache: true,
        roadmap: existingRoadmap
      });
    }

    const response = await ai.models.generateContent({
      model: roadmapConfig.model,
      config: roadmapConfig.config,
      contents: buildPrompt(goal)
    });

    const parsedRoadmap = JSON.parse(response.text);

    const roadmap = await Roadmap.create({
      user: req.user._id,
      goal,
      title: parsedRoadmap.roadmapTitle,
      duration: parsedRoadmap.duration,
      phases: parsedRoadmap.phases,
      rawResponse: response.text
    });

    res.status(201).json({
      success: true,
      message: 'Roadmap generated successfully',
      fromCache: false,
      roadmap
    });

  } catch (error) {
    console.error('Generate roadmap error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating roadmap'
    });
  }
};


const getRoadmap = async (req, res) => {
  try {
    const roadmap = await Roadmap.findOne({ user: req.user._id });

    if (!roadmap) {
      return res.status(404).json({
        success: false,
        message: 'No roadmap found. Please generate one first.'
      });
    }

    res.json({
      success: true,
      roadmap
    });
  } catch (error) {
    console.error('Get roadmap error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching roadmap'
    });
  }
};


const regenerateRoadmap = async (req, res) => {
  try {
    const { goal } = req.body;

    if (!goal) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new goal'
      });
    }

    const response = await ai.models.generateContent({
      model: roadmapConfig.model,
      config: roadmapConfig.config,
      contents: buildPrompt(goal)
    });

    const parsedRoadmap = JSON.parse(response.text);

  
    const roadmap = await Roadmap.findOneAndUpdate(
      { user: req.user._id },
      {
        goal,
        title: parsedRoadmap.roadmapTitle,
        duration: parsedRoadmap.duration,
        phases: parsedRoadmap.phases,
        rawResponse: response.text,
        generatedAt: Date.now()
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Roadmap regenerated successfully',
      roadmap
    });

  } catch (error) {
    console.error('Regenerate roadmap error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error regenerating roadmap'
    });
  }
};

module.exports = { generateRoadmap, getRoadmap, regenerateRoadmap };