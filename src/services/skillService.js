const User = require('../models/User');

/**
 * Skill Verification Service
 * Handles cross-module verified credentials (e.g. from high quiz scores or validated work reviews)
 */
class SkillService {
  /**
   * Add or upgrade a verified skill for a user (Strictly from quiz assessments)
   * @param {string} userId
   * @param {Object} skillData - { skill, category, score, source }
   */
  async addVerifiedSkill(userId, { skill, category = 'learning', score = 100, source = 'quiz' }) {
    if (!userId || !skill) {
      throw new Error('User ID and skill name are required');
    }

    // Only allow verified badges issued through official quiz assessments
    if (source !== 'quiz') {
      return [];
    }

    const trimmedSkill = skill.trim();
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.verifiedSkills) {
      user.verifiedSkills = [];
    }

    const existingIndex = user.verifiedSkills.findIndex(
      (s) => s.skill.toLowerCase() === trimmedSkill.toLowerCase()
    );

    if (existingIndex !== -1) {
      // Upgrade score if the new achievement is higher
      if (score >= (user.verifiedSkills[existingIndex].score || 0)) {
        user.verifiedSkills[existingIndex].score = score;
        user.verifiedSkills[existingIndex].verifiedAt = new Date();
        user.verifiedSkills[existingIndex].source = 'quiz';
        if (category) user.verifiedSkills[existingIndex].category = category;
      }
    } else {
      user.verifiedSkills.push({
        skill: trimmedSkill,
        category: category || 'learning',
        score: Math.min(100, Math.max(0, score)),
        source: 'quiz',
        verifiedAt: new Date()
      });
    }

    await user.save();
    return user.verifiedSkills.filter(s => !s.source || s.source === 'quiz');
  }

  /**
   * Retrieve all quiz-verified skills for a user
   * @param {string} userId
   */
  async getVerifiedSkills(userId) {
    const user = await User.findById(userId).select('verifiedSkills');
    if (!user || !user.verifiedSkills) return [];
    return user.verifiedSkills.filter(s => !s.source || s.source === 'quiz');
  }
}

module.exports = new SkillService();
