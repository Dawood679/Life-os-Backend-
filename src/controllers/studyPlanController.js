const StudyPlan = require("../models/StudyPlan");
const { ai, studyPlanConfig } = require("../config/gemini");
const { callAIWithFallback } = require('../utils/aiWithFallback');
const lifeScoreService = require('../services/lifeScoreService');
const { incrementFeatureUsage } = require('../middleware/planLimiter');

const generateStudyPlan = async (req, res) => {
  try {
    const { currentLevel = 'beginner', subject, sourceRoadmapId, roadmapPhases } = req.body;

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Please provide a subject or learning goal",
      });
    }

    let contextDetails = "";
    if (roadmapPhases && Array.isArray(roadmapPhases) && roadmapPhases.length > 0) {
      contextDetails = `\nSOURCE ROADMAP PHASES TO STRUCTURE INTO CONCRETE TASKS:\n${JSON.stringify(
        roadmapPhases.map(p => ({ phase: p.phase || p.title, topics: p.topics }))
      )}`;
    }

    const prompt = `
TASK: Generate a comprehensive, multi-task curriculum blueprint containing ALL essential tasks needed to master: "${subject}".
- TARGET SUBJECT/GOAL: ${subject}
- PROFICIENCY LEVEL: ${currentLevel}${contextDetails}

CRITICAL RULES:
1. "planTitle": Punchy, inspiring title (e.g. "Complete ${subject} Mastery Blueprint", "${subject} from Scratch to Production").
2. "summary": 2-3 sentence overview covering everything the learner will build and master.
3. "canonicalSkill": Root canonical skill (e.g. "${subject}").
4. "isSkillVerifiable": true
5. "tasks": You MUST generate between 8 to 12 progressive, step-by-step tasks (Task 1 through Task 10) covering:
   - Fundamentals & Environment (Tasks 1-2)
   - Core Mechanisms, Architecture & Essential Syntax (Tasks 3-5)
   - Practical Patterns, State, APIs & Real-world Workflows (Tasks 6-8)
   - Testing, Optimization & Capstone Project Implementation (Tasks 9-10+)
   
   For EVERY single task, include:
   - "taskNumber": integer (1, 2, 3...)
   - "title": Specific, actionable topic name
   - "description": Clear explanation of what to learn, code, or execute
   - "tier": 'quick_concept' (15 pts) | 'core_mechanism' (25 pts) | 'hands_on_exercise' (45 pts)
   - "estimatedMinutes": number (15-60)
   - "microQuiz": Exactly 2 to 3 sharp active-recall multiple-choice questions testing that specific task:
     * "question": Conceptual or problem-solving question
     * "options": 4 options ["A) ...", "B) ...", "C) ...", "D) ..."]
     * "correctAnswer": "A", "B", "C", or "D"
     * "explanation": Brief explanation

6. "tips": Exactly 3 actionable master tips for retention and project building.
`;

    const response = await callAIWithFallback(ai, studyPlanConfig, prompt);

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format received from AI model.");
    }

    const parsedPlan = JSON.parse(jsonMatch[0]);

    // Ensure points and task properties are calculated with resilient fallbacks
    const rawTasks = Array.isArray(parsedPlan.tasks) ? parsedPlan.tasks : [];
    const tasks = rawTasks.map((t, idx) => {
      let defaultPoints = 25;
      if (t.tier === 'quick_concept') defaultPoints = 15;
      else if (t.tier === 'hands_on_exercise') defaultPoints = 45;

      const taskTitle = t.title || t.name || t.topic || `Task ${idx + 1}: ${subject}`;
      const taskDescription = t.description || t.details || t.summary || t.task || taskTitle || 'Understand and implement this core mechanism.';

      return {
        taskNumber: Number(t.taskNumber) || idx + 1,
        title: String(taskTitle),
        description: String(taskDescription),
        tier: t.tier || (idx % 3 === 0 ? 'quick_concept' : idx % 3 === 1 ? 'core_mechanism' : 'hands_on_exercise'),
        estimatedMinutes: Number(t.estimatedMinutes) || 30,
        points: Number(t.points) || defaultPoints,
        isCompleted: false,
        microQuiz: Array.isArray(t.microQuiz) ? t.microQuiz : []
      };
    });

    const totalPoints = tasks.reduce((sum, t) => sum + (t.points || 20), 0);

    const studyPlan = await StudyPlan.create({
      user: req.user._id,
      currentLevel,
      subject,
      planTitle: parsedPlan.planTitle || `${subject} Study Plan`,
      summary: parsedPlan.summary || '',
      canonicalSkill: parsedPlan.canonicalSkill || subject,
      isSkillVerifiable: parsedPlan.isSkillVerifiable ?? true,
      tasks,
      totalPoints,
      earnedPoints: 0,
      completionPercentage: 0,
      tips: parsedPlan.tips || [],
      sourceRoadmap: sourceRoadmapId || null,
      rawResponse: response.text,
    });

    await incrementFeatureUsage(req.user._id, 'study_plan');

    res.status(201).json({
      success: true,
      message: "Task-based study plan generated successfully",
      studyPlan,
    });
  } catch (error) {
    console.error('Generate study plan error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error generating study plan'
    });
  }
};

// Verify Task Micro-Quiz Answers & Mark Task Complete
const verifyTaskMicroQuiz = async (req, res) => {
  try {
    const { id, taskNumber } = req.params;
    const { answers } = req.body; // Map/Object: { 0: "A", 1: "B", 2: "C" }

    const studyPlan = await StudyPlan.findOne({
      _id: id,
      user: req.user._id
    });

    if (!studyPlan) {
      return res.status(404).json({ success: false, message: "Study plan not found" });
    }

    const taskIndex = studyPlan.tasks.findIndex(t => t.taskNumber === parseInt(taskNumber, 10));
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, message: "Task not found in study plan" });
    }

    const targetTask = studyPlan.tasks[taskIndex];
    const microQuiz = targetTask.microQuiz || [];

    if (microQuiz.length === 0) {
      // If no micro-quiz, toggle complete directly
      targetTask.isCompleted = true;
      targetTask.completedAt = new Date();
    } else {
      let correctCount = 0;
      microQuiz.forEach((q, idx) => {
        const userAnswer = answers ? (answers[idx] || answers[String(idx)]) : null;
        if (userAnswer && q.correctAnswer && userAnswer.trim().toUpperCase().startsWith(q.correctAnswer.trim().toUpperCase())) {
          correctCount++;
        }
      });

      const passThreshold = Math.ceil(microQuiz.length * 0.65); // 1/2 or 2/3
      const passed = correctCount >= passThreshold;

      if (!passed) {
        return res.status(200).json({
          success: true,
          passed: false,
          score: correctCount,
          totalQuestions: microQuiz.length,
          message: `Scored ${correctCount}/${microQuiz.length}. Review the concept and try again!`,
          microQuiz
        });
      }

      // Passed!
      targetTask.isCompleted = true;
      targetTask.completedAt = new Date();
    }

    // Recalculate earned points and completion percentage
    const completedTasks = studyPlan.tasks.filter(t => t.isCompleted);
    const earnedPoints = completedTasks.reduce((sum, t) => sum + (t.points || 20), 0);
    const totalPoints = studyPlan.totalPoints || studyPlan.tasks.reduce((sum, t) => sum + (t.points || 20), 0);

    studyPlan.earnedPoints = earnedPoints;
    studyPlan.completionPercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    await studyPlan.save();

    // Trigger Life Score recalculation for today
    try {
      await lifeScoreService.calculateDailyScore(req.user._id);
    } catch (scoreErr) {
      console.error("Life score update warning on study task pass:", scoreErr);
    }

    return res.status(200).json({
      success: true,
      passed: true,
      score: microQuiz.length,
      totalQuestions: microQuiz.length,
      message: `🎉 Task verified! +${targetTask.points} points awarded.`,
      task: targetTask,
      studyPlan
    });
  } catch (error) {
    console.error("Verify micro-quiz error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to verify task micro-quiz"
    });
  }
};

// Regenerate Fresh Micro-Quiz Questions on Retry
const regenerateTaskMicroQuiz = async (req, res) => {
  try {
    const { id, taskNumber } = req.params;

    const studyPlan = await StudyPlan.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!studyPlan) {
      return res.status(404).json({ success: false, message: "Study plan not found" });
    }

    const taskIndex = studyPlan.tasks.findIndex(t => t.taskNumber === parseInt(taskNumber, 10));
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, message: "Task not found in study plan" });
    }

    const targetTask = studyPlan.tasks[taskIndex];

    const prompt = `
TASK: Generate 2 to 3 BRAND NEW, alternative active-recall MCQ questions to re-test the user on this study task.
- TOPIC/SUBJECT: ${studyPlan.subject} (${studyPlan.canonicalSkill || 'Core Concepts'})
- TASK TITLE: ${targetTask.title}
- TASK DESCRIPTION: ${targetTask.description}

REQUIREMENTS:
1. Generate fresh questions different from previous trivia. Focus on concept understanding and scenario application.
2. Return ONLY a JSON object with:
{
  "microQuiz": [
    {
      "question": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "A",
      "explanation": "string"
    }
  ]
}
`;

    const response = await callAIWithFallback(ai, quizConfig, prompt);
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format received from AI model.");
    }

    const parsedData = JSON.parse(jsonMatch[0]);
    const newQuestions = Array.isArray(parsedData.microQuiz) ? parsedData.microQuiz : [];

    if (newQuestions.length > 0) {
      targetTask.microQuiz = newQuestions;
      await studyPlan.save();
    }

    return res.status(200).json({
      success: true,
      message: "Fresh assessment questions generated successfully",
      task: targetTask,
      microQuiz: targetTask.microQuiz,
    });
  } catch (error) {
    console.error("Regenerate micro-quiz error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to regenerate task quiz questions",
    });
  }
};

// Get all study plans with Pagination
const getStudyPlans = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const totalCount = await StudyPlan.countDocuments({ user: req.user._id });

    const studyPlans = await StudyPlan.find({ user: req.user._id })
      .select("-rawResponse")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.json({
      success: true,
      count: studyPlans.length,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      studyPlans,
    });
  } catch (error) {
    console.error("Get study plans error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching study plans",
    });
  }
};

// Get study plan by ID
const getStudyPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const studyPlan = await StudyPlan.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!studyPlan) {
      return res.status(404).json({
        success: false,
        message: "Study plan not found",
      });
    }

    res.json({
      success: true,
      studyPlan,
    });
  } catch (error) {
    console.error("Get study plan error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching study plan",
    });
  }
};

// Delete study plan
const deleteStudyPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const studyPlan = await StudyPlan.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!studyPlan) {
      return res.status(404).json({
        success: false,
        message: "Study plan not found",
      });
    }

    res.json({
      success: true,
      message: "Study plan deleted successfully",
    });
  } catch (error) {
    console.error("Delete study plan error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting study plan",
    });
  }
};

module.exports = {
  generateStudyPlan,
  verifyTaskMicroQuiz,
  regenerateTaskMicroQuiz,
  getStudyPlans,
  getStudyPlan,
  deleteStudyPlan,
};