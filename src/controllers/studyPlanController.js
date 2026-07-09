const StudyPlan = require('../models/StudyPlan');
const { ai, studyPlanConfig } = require('../config/gemini');


const generateStudyPlan = async (req, res) => {
  try {
    const { freeTimePerDay, deadline, currentLevel, subject } = req.body;

    if (!freeTimePerDay || !deadline || !currentLevel || !subject) {
      return res.status(400).json({
        success: false,
        message: 'Please provide freeTimePerDay, deadline, currentLevel and subject'
      });
    }

    const prompt = `
      Generate a detailed daily study plan with the following details:

      Subject/Topic: ${subject}
      Current Level: ${currentLevel}
      Available Time Per Day: ${freeTimePerDay} hours
      Deadline: ${deadline}
      Today's Date: ${new Date().toISOString().split('T')[0]}

      Requirements:
      - Create a realistic day by day study plan from today until the deadline
      - Each day should have specific tasks fitting within ${freeTimePerDay} hours
      - Weekly targets should be progressive (easy to hard)
      - Tips should be motivating and practical
      - Consider the current level (${currentLevel}) when assigning tasks
      - Be specific about what to study each day
    `;

    const response = await ai.models.generateContent({
      model: studyPlanConfig.model,
      config: studyPlanConfig.config,
      contents: prompt
    });

    const parsedPlan = JSON.parse(response.text);

    const studyPlan = await StudyPlan.create({
      user: req.user._id,
      freeTimePerDay,
      deadline,
      currentLevel,
      subject,
      planTitle: parsedPlan.planTitle,
      summary: parsedPlan.summary,
      totalWeeks: parsedPlan.totalWeeks,
      dailyPlan: parsedPlan.dailyPlan,
      weeklyTargets: parsedPlan.weeklyTargets,
      tips: parsedPlan.tips,
      rawResponse: response.text
    });

    res.status(201).json({
      success: true,
      message: 'Study plan generated successfully',
      studyPlan
    });

  } catch (error) {
    console.error('Generate study plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating study plan'
    });
  }
};

// get all study plans
const getStudyPlans = async (req, res) => {
  try {
    const studyPlans = await StudyPlan.find({ user: req.user._id })
      .select('-rawResponse')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: studyPlans.length,
      studyPlans
    });
  } catch (error) {
    console.error('Get study plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching study plans'
    });
  }
};

// get study plan by id
const getStudyPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const studyPlan = await StudyPlan.findOne({
      _id: id,
      user: req.user._id
    });

    if (!studyPlan) {
      return res.status(404).json({
        success: false,
        message: 'Study plan not found'
      });
    }

    res.json({
      success: true,
      studyPlan
    });
  } catch (error) {
    console.error('Get study plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching study plan'
    });
  }
};

// delete
const deleteStudyPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const studyPlan = await StudyPlan.findOneAndDelete({
      _id: id,
      user: req.user._id
    });

    if (!studyPlan) {
      return res.status(404).json({
        success: false,
        message: 'Study plan not found'
      });
    }

    res.json({
      success: true,
      message: 'Study plan deleted successfully'
    });
  } catch (error) {
    console.error('Delete study plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting study plan'
    });
  }
};

module.exports = {
  generateStudyPlan,
  getStudyPlans,
  getStudyPlan,
  deleteStudyPlan
};