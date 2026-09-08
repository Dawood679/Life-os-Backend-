const Medicine = require('../models/Medicine');
const Appointment = require('../models/Appointment');
const DoctorAdvice = require('../models/DoctorAdvice');
const WellnessLog = require('../models/WellnessLog');
const Todo = require('../models/Todo');
const callGroq = require('../config/groq');

// calculate medicine adherence rate for the past N days
const calculateMedicineAdherence = async (userId, days = 7) => {
  const medicines = await Medicine.find({ user: userId, isActive: true });
  if (!medicines || medicines.length === 0) {
    return { adherenceRate: 100, totalDoses: 0, takenDoses: 0 };
  }

  let totalDoses = 0;
  let takenDoses = 0;

  medicines.forEach((med) => {
    if (Array.isArray(med.adherenceLogs)) {
      med.adherenceLogs.forEach((log) => {
        totalDoses += 1;
        if (log.status === 'taken') {
          takenDoses += 1;
        }
      });
    }
  });

  const adherenceRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 100;
  return { adherenceRate, totalDoses, takenDoses };
};

// calculate correlation between energy score and completed tasks
const calculateProductivityCorrelation = async (userId, startDate, endDate) => {
  const [wellnessLogs, todos] = await Promise.all([
    WellnessLog.find({ user: userId, date: { $gte: startDate, $lte: endDate } }),
    Todo.find({ user: userId, createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } })
  ]);

  const totalTasks = todos.length;
  const completedTasks = todos.filter((t) => t.isCompleted || t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalEnergy = wellnessLogs.reduce((acc, log) => acc + (log.energyScore || 0), 0);
  const avgEnergyScore = wellnessLogs.length > 0 ? Math.round(totalEnergy / wellnessLogs.length) : 0;

  return {
    avgEnergyScore,
    totalTasks,
    completedTasks,
    completionRate,
    logCount: wellnessLogs.length
  };
};

// generate ai narrative report
const generateHealthNarrativeReport = async (userId, startDate, endDate) => {
  const [adherenceData, correlationData, appointments, activeAdvices] = await Promise.all([
    calculateMedicineAdherence(userId, 7),
    calculateProductivityCorrelation(userId, startDate, endDate),
    Appointment.find({ user: userId, status: 'upcoming' }).limit(3),
    DoctorAdvice.find({ user: userId, status: 'active' })
  ]);

  const systemInstruction = `You are LIFEOS AI — a high-performance personal health and productivity coach. Analyze the user's weekly health, medication adherence, and productivity metrics. Generate an actionable, insightful narrative summary. Be encouraging, precise, and highlight direct correlations (e.g. low energy affecting task completion). Return ONLY a valid JSON object matching this schema: { "weeklySummary": string, "keyStrengths": [string], "areasForImprovement": [string], "actionableAdvice": string }`;

  const prompt = `Health & Performance Summary for the week (${startDate} to ${endDate}):
- Average Energy Score: ${correlationData.avgEnergyScore}/100
- Task Completion Rate: ${correlationData.completionRate}% (${correlationData.completedTasks} completed out of ${correlationData.totalTasks})
- Medicine Adherence Rate: ${adherenceData.adherenceRate}% (${adherenceData.takenDoses}/${adherenceData.totalDoses} doses taken)
- Active Doctor Rules: ${activeAdvices.map((a) => a.instruction).join(', ') || 'None'}
- Upcoming Checkups: ${appointments.map((ap) => `${ap.doctorName} on ${ap.appointmentDate}`).join(', ') || 'None'}

Provide deep, personalized analysis.`;

  try {
    const aiResponse = await callGroq(prompt, systemInstruction);
    const parsedReport = JSON.parse(aiResponse);

    return {
      metrics: {
        avgEnergyScore: correlationData.avgEnergyScore,
        taskCompletionRate: correlationData.completionRate,
        medicineAdherenceRate: adherenceData.adherenceRate
      },
      insights: parsedReport
    };
  } catch (error) {
    console.error('Error generating AI narrative:', error.message);
    return {
      metrics: {
        avgEnergyScore: correlationData.avgEnergyScore,
        taskCompletionRate: correlationData.completionRate,
        medicineAdherenceRate: adherenceData.adherenceRate
      },
      insights: {
        weeklySummary: `Your average energy score this week was ${correlationData.avgEnergyScore}/100 with a ${correlationData.completionRate}% task completion rate.`,
        keyStrengths: ['Consistent tracking'],
        areasForImprovement: ['Improve sleep and hydration consistency'],
        actionableAdvice: 'Maintain hydration and prioritize rest to stabilize daily energy levels.'
      }
    };
  }
};

module.exports = {
  calculateMedicineAdherence,
  calculateProductivityCorrelation,
  generateHealthNarrativeReport
};