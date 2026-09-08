/**
 * Calculates the daily Energy Score (0-100) based on available wellness data.
 */
const calculateEnergyScore = (log) => {
  if (!log) return null;

  // Maximum points for each category (Total = 100)
  const WEIGHTS = {
    sleep: 35,
    water: 20,
    mood: 20,
    activity: 15,
    screenTime: 10
  };

  let earnedPoints = 0;
  let possiblePoints = 0; // Tracks what the user has actually logged

  // 1. SLEEP (Optimal: 8 hours)
  if (log.sleep && log.sleep.hours > 0) {
    possiblePoints += WEIGHTS.sleep;
    const sleepHours = Math.min(log.sleep.hours, 8); // Cap at 8 for scoring
    earnedPoints += (sleepHours / 8) * WEIGHTS.sleep;
  }

  // 2. WATER (Optimal: 100% of target)
  // Only calculate if user has started drinking or if it's explicitly logged
  if (log.water && log.water.consumedMl !== undefined) {
    if (log.water.consumedMl > 0 || log.water.entries?.length > 0) {
      possiblePoints += WEIGHTS.water;
      const target = log.water.targetMl || 2000;
      const waterRatio = Math.min(log.water.consumedMl / target, 1);
      earnedPoints += waterRatio * WEIGHTS.water;
    }
  }

  // 3. MOOD (Scale 1 to 5)
  if (log.mood && log.mood.value) {
    possiblePoints += WEIGHTS.mood;
    // 1=20%, 2=40%, 3=60%, 4=80%, 5=100% of mood weight
    earnedPoints += (log.mood.value / 5) * WEIGHTS.mood;
  }

  // 4. ACTIVITY (Baseline: 30 mins)
  if (log.activity && log.activity.minutes > 0 && log.activity.type !== 'none') {
    possiblePoints += WEIGHTS.activity;
    const activityMins = Math.min(log.activity.minutes, 30); // Cap at 30 mins
    earnedPoints += (activityMins / 30) * WEIGHTS.activity;
  }

  // 5. SCREEN TIME (Penalty based)
  if (log.screenTime && log.screenTime.usedMinutes > 0) {
    possiblePoints += WEIGHTS.screenTime;
    const limit = log.screenTime.limitMinutes || 120;
    
    if (log.screenTime.usedMinutes <= limit) {
      earnedPoints += WEIGHTS.screenTime; // Full points if under limit
    } else {
      // Deduct points proportionally, floor at 0
      const excess = log.screenTime.usedMinutes - limit;
      const penalty = Math.min((excess / limit) * WEIGHTS.screenTime, WEIGHTS.screenTime);
      earnedPoints += (WEIGHTS.screenTime - penalty);
    }
  }

  // If nothing is logged yet, return a neutral baseline score
  if (possiblePoints === 0) return 50; 

  // Calculate final percentage based on provided data
  const finalScore = (earnedPoints / possiblePoints) * 100;
  
  return Math.round(finalScore);
};

module.exports = { calculateEnergyScore };