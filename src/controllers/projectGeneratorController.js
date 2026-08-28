const { ProjectGenerator } = require("../models/ProjectGenerator");
const { ai, projectGeneratorConfig } = require("../config/gemini");
const { callAIWithFallback } = require('../utils/aiWithFallback');
const lifeScoreService = require('../services/lifeScoreService');

/**
 * Universal Action Plan & Project Blueprint Generator
 */
const generateProject = async (req, res) => {
  try {
    const { request, goal, topic, category } = req.body;
    const userGoal = (request || goal || topic || "").trim();

    if (!userGoal) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a project or goal request (e.g. "Launch a coffee subscription service", "Full-stack AI SaaS app", "Pass USMLE exam")',
      });
    }

    const prompt = `
      User request: "${userGoal}"
      Category hint: "${category || 'general'}"

      Create a concrete, milestone-driven Action Plan and Blueprint.
      Break down the goal into 3-6 progressive chronological milestones.
      Each milestone must have:
      - stepNumber (integer 1, 2, 3...)
      - title (concise phase name)
      - description (what needs to be done)
      - deliverable (tangible outcome to prove completion)
      - checklist (3-5 actionable sub-tasks)

      Provide realistic difficultyLevel ("Beginner" | "Intermediate" | "Advanced") and estimatedDuration.
      Respond strictly in JSON matching the schema.
    `;

    const response = await callAIWithFallback(ai, projectGeneratorConfig, prompt);
    const cleanText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);

    // Format milestones
    const milestones = Array.isArray(parsed.milestones) ? parsed.milestones.map((m, idx) => ({
      stepNumber: m.stepNumber || idx + 1,
      title: m.title || `Milestone ${idx + 1}`,
      description: m.description || '',
      deliverable: m.deliverable || 'Completed milestone task',
      checklist: Array.isArray(m.checklist) ? m.checklist : [],
      isCompleted: false
    })) : [];

    // Synthesize legacy features for backward compatibility
    const synthesizedFeatures = milestones.map(m => `${m.title}: ${m.deliverable}`);

    const projectGen = await ProjectGenerator.create({
      user: req.user._id,
      request: userGoal,
      planTitle: parsed.planTitle || userGoal,
      projectTitle: parsed.planTitle || userGoal, // Legacy alias
      category: parsed.category || category || "general",
      difficultyLevel: parsed.difficultyLevel || "Intermediate",
      estimatedDuration: parsed.estimatedDuration || "4 weeks",
      description: parsed.description || "",
      milestones,
      resourcesOrTools: Array.isArray(parsed.resourcesOrTools) ? parsed.resourcesOrTools : [],
      features: synthesizedFeatures,
      techStack: Array.isArray(parsed.resourcesOrTools) ? parsed.resourcesOrTools : [],
      rawResponse: response.text,
    });

    res.status(201).json({
      success: true,
      message: "Action plan generated successfully",
      project: projectGen,
    });
  } catch (error) {
    if (error.message && error.message.includes("All 5 attempts failed")) {
      return res.status(429).json({
        success: false,
        message: "Service temporarily unavailable. Please try again later.",
      });
    }
    console.error("Generate project/action plan error:", error);
    res.status(500).json({
      success: false,
      message: "Server error generating plan",
    });
  }
};

// Toggle milestone completion state
const toggleMilestone = async (req, res) => {
  try {
    const { id, stepNumber } = req.params;
    const project = await ProjectGenerator.findOne({ _id: id, user: req.user._id });

    if (!project) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    const milestone = project.milestones.find(m => m.stepNumber === parseInt(stepNumber, 10));
    if (!milestone) {
      return res.status(404).json({ success: false, message: "Milestone not found" });
    }

    milestone.isCompleted = !milestone.isCompleted;
    milestone.completedAt = milestone.isCompleted ? new Date() : null;
    await project.save();

    // Recalculate daily Life Score
    try {
      await lifeScoreService.calculateDailyScore(req.user._id);
    } catch (scoreErr) {
      console.error('Life score update warning:', scoreErr);
    }

    res.json({
      success: true,
      message: `Milestone ${milestone.isCompleted ? 'completed' : 'marked active'}`,
      project
    });
  } catch (error) {
    console.error("Toggle milestone error:", error);
    res.status(500).json({ success: false, message: "Server error updating milestone" });
  }
};

// Get all projects for logged in user (Paginated)
const getProjects = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };

    const [projects, total] = await Promise.all([
      ProjectGenerator.find(filter)
        .select("-rawResponse")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ProjectGenerator.countDocuments(filter),
    ]);

    res.json({
      success: true,
      projects,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching projects",
    });
  }
};

// Get single project by ID
const getProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await ProjectGenerator.findOne({
      _id: id,
      user: req.user._id,
    }).select("-rawResponse");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    res.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Get project error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching plan",
    });
  }
};

// Delete project by ID
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await ProjectGenerator.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    res.json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting plan",
    });
  }
};

module.exports = { 
  generateProject, 
  toggleMilestone,
  getProjects, 
  getProject, 
  deleteProject 
};