const { InterviewSession } = require('../models/InterviewSession');
const StudyPlan = require('../models/StudyPlan');
const {
  ai,
  generateContentWithRetry,
  interviewQuestionConfig,
  interviewScorecardConfig,
  studyPlanConfig
} = require('../config/gemini');
const lifeScoreService = require('../services/lifeScoreService');

// Helper to safely parse Gemini JSON responses
const parseJsonSafely = (text) => {
  try {
    return JSON.parse(text);
  } catch (err) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Invalid JSON received from AI engine');
  }
};

// Helper: Safely normalize turn categories to valid strings
const normalizeCategory = (cat = '') => {
  const c = String(cat).toLowerCase().trim();
  if (c.includes('behav')) return 'behavioral';
  if (c.includes('system') || c.includes('design') || c.includes('arch')) return 'system_design';
  if (c.includes('situat')) return 'situational';
  return 'technical';
};

// Helper: Safely normalize weakness severity
const normalizeSeverity = (sev = '') => {
  const s = String(sev).toLowerCase().trim();
  if (s.includes('high') || s.includes('crit')) return 'critical';
  if (s.includes('low') || s.includes('min')) return 'minor';
  return 'moderate';
};

// Helper: Safely normalize readiness verdict
const normalizeVerdict = (verdict = '') => {
  const v = String(verdict).trim();
  if (v.toLowerCase().includes('strong')) return 'Strong Hire';
  if (v.toLowerCase().includes('reserv')) return 'Hire with Reservations';
  if (v.toLowerCase().includes('not') || v.toLowerCase().includes('unready')) return 'Not Ready';
  return 'Needs Preparation';
};

// Helper: Calculate Token Economics & USD estimates
const accumulateUsage = (session, response) => {
  if (response?.usageMetadata) {
    const promptTokens = response.usageMetadata.promptTokenCount || 0;
    const candidateTokens = response.usageMetadata.candidatesTokenCount || 0;
    
    session.usageMetrics.totalPromptTokens = (session.usageMetrics.totalPromptTokens || 0) + promptTokens;
    session.usageMetrics.totalCandidateTokens = (session.usageMetrics.totalCandidateTokens || 0) + candidateTokens;
    
    // Gemini 2.5 Flash Estimated Cost ($0.075/M input, $0.30/M output)
    const cost = (promptTokens * 0.000000075) + (candidateTokens * 0.00000030);
    session.usageMetrics.estimatedCostUsd = parseFloat(((session.usageMetrics.estimatedCostUsd || 0) + cost).toFixed(6));
  }
};

/**
 * 1. Start New Mock Interview Session
 * Generates Question #1
 */
const startInterview = async (req, res) => {
  try {
    const {
      roleTitle,
      experienceLevel = 'mid',
      interviewType = 'mixed',
      targetCompanyOrStyle = 'Standard Tech / Enterprise',
      jobDescription = '',
      totalQuestions = 5
    } = req.body;

    if (!roleTitle || !roleTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Target role title is required.'
      });
    }

    const questionCount = Math.min(10, Math.max(3, parseInt(totalQuestions, 10) || 5));
    const trimmedJd = (jobDescription || '').trim();
    const jdContext = trimmedJd ? `\n- TARGET JOB DESCRIPTION / CORE REQUIREMENTS:\n"${trimmedJd.slice(0, 1000)}"` : '';

    const prompt = `
TASK: Generate Question 1 of ${questionCount} for a candidate mock interview.
- TARGET ROLE: ${roleTitle.trim()}
- EXPERIENCE LEVEL: ${experienceLevel}
- INTERVIEW TYPE: ${interviewType}
- TARGET STYLE: ${targetCompanyOrStyle}${jdContext}
- CURRENT QUESTION NUMBER: 1

Generate an authentic, professional opening interview question (Technical, Conceptual, or Behavioral baseline tailored to the role and specified job requirements if provided).`;

    const response = await generateContentWithRetry({
      model: interviewQuestionConfig.model,
      contents: prompt,
      config: interviewQuestionConfig.config
    });

    const parsedQuestion = parseJsonSafely(response.text);

    const newSession = new InterviewSession({
      user: req.user._id,
      roleTitle: roleTitle.trim(),
      experienceLevel,
      interviewType,
      targetCompanyOrStyle,
      jobDescription: trimmedJd,
      totalQuestions: questionCount,
      currentTurn: 1,
      status: 'in_progress',
      turns: [
        {
          questionNumber: 1,
          questionText: parsedQuestion.questionText,
          category: normalizeCategory(parsedQuestion.category)
        }
      ],
      usageMetrics: {
        totalPromptTokens: 0,
        totalCandidateTokens: 0,
        estimatedCostUsd: 0
      }
    });

    accumulateUsage(newSession, response);
    await newSession.save();

    res.status(201).json({
      success: true,
      message: 'Interview session started.',
      session: newSession,
      currentQuestion: newSession.turns[0]
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start interview session.'
    });
  }
};

/**
 * 2. Answer Current Turn & Advance to Next Question
 * Strictly validated with Turn Replay Guard & Rolling Window Context
 */
const answerTurn = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionNumber, userAnswer } = req.body;

    const session = await InterviewSession.findOne({ _id: id, user: req.user._id });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    if (session.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: `Session is already ${session.status}. Please start a new interview.`
      });
    }

    const currentTurnNum = session.currentTurn;
    const incomingTurnNum = parseInt(questionNumber, 10);

    // Turn Replay / Skip Guard
    if (incomingTurnNum !== currentTurnNum) {
      return res.status(400).json({
        success: false,
        message: `Invalid turn sequence. Expected answer for Question #${currentTurnNum}, received #${incomingTurnNum}.`
      });
    }

    const turnIndex = currentTurnNum - 1;
    if (!session.turns[turnIndex]) {
      return res.status(400).json({ success: false, message: 'Turn not found.' });
    }

    // Save answer
    session.turns[turnIndex].userAnswer = (userAnswer || '').trim();
    session.turns[turnIndex].answeredAt = new Date();

    // Check if more questions remain
    if (currentTurnNum < session.totalQuestions) {
      const nextTurnNum = currentTurnNum + 1;
      const prevQuestion = session.turns[turnIndex].questionText;
      const prevAnswer = session.turns[turnIndex].userAnswer || 'No response provided.';

      // Rolling Window Prompt: Sends only Role + Level + Previous Question & Answer + JD context if present
      const jdHint = session.jobDescription ? `\n- JOB SPECIFICATION CONTEXT: "${session.jobDescription.slice(0, 300)}"` : '';

      const prompt = `
TASK: Generate Question ${nextTurnNum} of ${session.totalQuestions} for a mock interview.
- TARGET ROLE: ${session.roleTitle} (${session.experienceLevel} level)
- INTERVIEW TYPE: ${session.interviewType}${jdHint}
- PREVIOUS QUESTION #${currentTurnNum}: "${prevQuestion}"
- CANDIDATE PREVIOUS ANSWER: "${prevAnswer.slice(0, 400)}"

INSTRUCTIONS:
1. Provide a brief 1-sentence professional acknowledgement of their previous response.
2. Ask the next question (#${nextTurnNum}), transitioning smoothly or probing deeper into a relevant concept.`;

      const response = await generateContentWithRetry({
        model: interviewQuestionConfig.model,
        contents: prompt,
        config: interviewQuestionConfig.config
      });

      const parsedNext = parseJsonSafely(response.text);

      session.turns.push({
        questionNumber: nextTurnNum,
        questionText: parsedNext.questionText,
        category: normalizeCategory(parsedNext.category)
      });

      session.currentTurn = nextTurnNum;
      accumulateUsage(session, response);
      await session.save();

      return res.status(200).json({
        success: true,
        message: `Answer recorded. Question ${nextTurnNum} ready.`,
        session,
        nextQuestion: session.turns[session.turns.length - 1],
        isCompleted: false
      });
    }

    // All questions answered -> Auto Finalize
    await finalizeSessionInternal(session);

    return res.status(200).json({
      success: true,
      message: 'Interview completed and evaluated.',
      session,
      isCompleted: true
    });
  } catch (error) {
    console.error('Answer turn error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit interview turn answer.'
    });
  }
};

/**
 * Helper: Finalize Mock Interview Scorecard (Single-call)
 */
const finalizeSessionInternal = async (session) => {
  const qaTranscript = session.turns.map(t => ({
    questionNumber: t.questionNumber,
    question: t.questionText,
    category: t.category,
    candidateAnswer: t.userAnswer || 'No response provided.'
  }));

  const prompt = `
TASK: Objectively evaluate this completed mock interview transcript and generate a comprehensive diagnostic scorecard.
- TARGET ROLE: ${session.roleTitle}
- EXPERIENCE LEVEL: ${session.experienceLevel}
- INTERVIEW ROUND TYPE: ${session.interviewType}

INTERVIEW TRANSCRIPT:
${JSON.stringify(qaTranscript, null, 2)}

INSTRUCTIONS:
1. Grade overall candidate performance (overallScore 0-100) and provide an honest readiness verdict.
2. Grade individual sub-metrics (technicalAccuracy, communicationClarity, criticalThinking).
3. For every question in turnsFeedback:
   - Provide feedbackBrief (1-2 sentences on what was good or missing).
   - Provide idealAnswerBullet (Bullet points of what a top candidate benchmark answer looks like).
   - Assign question score (0-100).
4. Identify 2 to 4 concrete weak topics (weakTopics) that the candidate must review.`;

  const response = await generateContentWithRetry({
    model: interviewScorecardConfig.model,
    contents: prompt,
    config: interviewScorecardConfig.config
  });

  const evaluation = parseJsonSafely(response.text);

  session.scorecard = {
    overallScore: Math.min(100, Math.max(0, evaluation.overallScore || 70)),
    readinessVerdict: normalizeVerdict(evaluation.readinessVerdict),
    metrics: {
      technicalAccuracy: Math.min(100, Math.max(0, evaluation.metrics?.technicalAccuracy || 70)),
      communicationClarity: Math.min(100, Math.max(0, evaluation.metrics?.communicationClarity || 70)),
      criticalThinking: Math.min(100, Math.max(0, evaluation.metrics?.criticalThinking || 70))
    },
    strengths: evaluation.strengths || [],
    weaknesses: evaluation.weaknesses || [],
    summaryReview: evaluation.summaryReview || 'Mock interview assessment complete.'
  };

  session.weakTopics = (evaluation.weakTopics || []).map(wt => ({
    topic: wt.topic,
    suggestedSkill: wt.suggestedSkill || session.roleTitle,
    severity: normalizeSeverity(wt.severity)
  }));

  // Update individual turns with feedback
  if (Array.isArray(evaluation.turnsFeedback)) {
    evaluation.turnsFeedback.forEach(tf => {
      const matchTurn = session.turns.find(t => t.questionNumber === tf.questionNumber);
      if (matchTurn) {
        matchTurn.feedbackBrief = tf.feedbackBrief || '';
        matchTurn.idealAnswerBullet = tf.idealAnswerBullet || '';
        matchTurn.score = tf.score || 70;
      }
    });
  }

  session.status = 'completed';
  session.completedAt = new Date();
  accumulateUsage(session, response);

  await session.save();

  // Trigger Life Score recalculation for Career / Learning Pillar
  try {
    await lifeScoreService.calculateDailyScore(session.user);
  } catch (scoreErr) {
    console.error('Life score update warning on interview completion:', scoreErr);
  }
};

/**
 * 3. Finalize Interview Explicitly (Manual trigger if needed)
 */
const finalizeInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await InterviewSession.findOne({ _id: id, user: req.user._id });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    if (session.status === 'completed') {
      return res.status(200).json({ success: true, session });
    }

    await finalizeSessionInternal(session);

    res.status(200).json({
      success: true,
      message: 'Interview finalized and evaluated successfully.',
      session
    });
  } catch (error) {
    console.error('Finalize interview error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to finalize interview scorecard.'
    });
  }
};

/**
 * 4. 1-Click Bridge: Create Study Plan from Interview Weaknesses
 */
const createStudyPlanFromWeaknesses = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await InterviewSession.findOne({ _id: id, user: req.user._id });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    const { specificTopic } = req.body || {};
    let subjectTitle = '';
    let targetTopicsText = '';
    const isSingleTopic = Boolean(specificTopic && String(specificTopic).trim());

    if (isSingleTopic) {
      subjectTitle = `${session.roleTitle}: ${String(specificTopic).trim()}`;
      targetTopicsText = String(specificTopic).trim();
    } else {
      if (session.linkedStudyPlan) {
        const existingPlan = await StudyPlan.findById(session.linkedStudyPlan);
        if (existingPlan) {
          return res.status(200).json({
            success: true,
            message: 'Study plan already generated for this session.',
            studyPlan: existingPlan
          });
        }
      }
      const weakTopicsList = (session.weakTopics || []).map(wt => `${wt.topic} (${wt.severity})`).join(', ');
      subjectTitle = `${session.roleTitle} Interview Remediation`;
      targetTopicsText = weakTopicsList || 'Core interview concepts and problem solving';
    }

    const prompt = `
TASK: Generate a targeted remediation Study Plan addressing specific weak areas identified in a mock interview.
- TARGET ROLE: ${session.roleTitle}
- CANDIDATE LEVEL: ${session.experienceLevel}
- TARGET FOCUS TOPIC: ${targetTopicsText}

INSTRUCTIONS:
1. Create 6 to 8 task-based learning modules directly remedying these weak topics.
2. Include 2-3 active recall micro-quiz questions for each task.
3. Assign appropriate point tiers (quick_concept, core_mechanism, hands_on_exercise).`;

    const response = await generateContentWithRetry({
      model: studyPlanConfig.model,
      contents: prompt,
      config: studyPlanConfig.config
    });

    const parsedPlan = parseJsonSafely(response.text);

    const studyPlan = new StudyPlan({
      user: req.user._id,
      subject: subjectTitle,
      currentLevel: session.experienceLevel,
      planTitle: parsedPlan.planTitle || `Remediation Plan for ${subjectTitle}`,
      summary: parsedPlan.summary || `Targeted study plan addressing ${targetTopicsText}.`,
      canonicalSkill: parsedPlan.canonicalSkill || session.roleTitle,
      isSkillVerifiable: true,
      tasks: parsedPlan.tasks || [],
      tips: parsedPlan.tips || []
    });

    const totalPts = studyPlan.tasks.reduce((sum, t) => sum + (t.points || 20), 0);
    studyPlan.totalPoints = totalPts > 0 ? totalPts : 100;
    studyPlan.earnedPoints = 0;
    studyPlan.completionPercentage = 0;

    await studyPlan.save();

    if (!isSingleTopic) {
      session.linkedStudyPlan = studyPlan._id;
      await session.save();
    }

    res.status(201).json({
      success: true,
      message: `Targeted Study Plan generated for ${targetTopicsText}.`,
      studyPlan
    });
  } catch (error) {
    console.error('Create study plan from weaknesses error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create study plan from interview weaknesses.'
    });
  }
};

/**
 * 5. Get All User Interviews (With Lazy Abandoned Cleanup)
 */
const getInterviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Lazy Cleanup: Mark in_progress sessions older than 2 hours as 'abandoned'
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await InterviewSession.updateMany(
      {
        user: req.user._id,
        status: 'in_progress',
        updatedAt: { $lt: twoHoursAgo }
      },
      { status: 'abandoned' }
    );

    const totalCount = await InterviewSession.countDocuments({ user: req.user._id });
    const sessions = await InterviewSession.find({ user: req.user._id })
      .select('-turns.idealAnswerBullet -turns.feedbackBrief')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.status(200).json({
      success: true,
      count: sessions.length,
      pagination: {
        totalItems: totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      sessions
    });
  } catch (error) {
    console.error('Get interviews error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch interview history.'
    });
  }
};

/**
 * 6. Get Single Interview Session Details
 */
const getInterviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await InterviewSession.findOne({ _id: id, user: req.user._id })
      .populate('linkedStudyPlan', 'planTitle earnedPoints completionPercentage totalPoints');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    res.status(200).json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Get interview by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch interview session.'
    });
  }
};

/**
 * 7. Delete Interview Session
 */
const deleteInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await InterviewSession.findOneAndDelete({ _id: id, user: req.user._id });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Interview session not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Interview session deleted successfully.'
    });
  } catch (error) {
    console.error('Delete interview error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete interview session.'
    });
  }
};

module.exports = {
  startInterview,
  answerTurn,
  finalizeInterview,
  createStudyPlanFromWeaknesses,
  getInterviews,
  getInterviewById,
  deleteInterview
};
