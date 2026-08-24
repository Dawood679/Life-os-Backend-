const Medicine = require('../models/Medicine');
const Appointment = require('../models/Appointment');
const DoctorAdvice = require('../models/DoctorAdvice');
const Prescription = require('../models/Prescription');
const cloudinary = require('../config/cloudinary');
const { parsePrescriptionHybrid } = require('../utils/prescriptionParser');
const {
  calculateMedicineAdherence,
  calculateProductivityCorrelation,
  generateHealthNarrativeReport
} = require('../utils/healthAnalyticsEngine');
const HealthProfile = require('../models/HealthProfile');

// medicine

const addMedicine = async (req, res) => {
  try {
    const { name, dosage, frequency, startDate, endDate, times, reminder } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Name, startDate, and endDate are required.' });
    }

    const medicine = await Medicine.create({
      user: req.user._id,
      name,
      dosage,
      frequency,
      startDate,
      endDate,
      times: times || [],
      reminder: reminder || { enabled: false, type: 'everyday', days: [], dates: [] }
    });

    res.status(201).json({ success: true, data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateMedicineAdherence = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status } = req.body;

    const medicine = await Medicine.findOne({ _id: id, user: req.user._id });
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    const logIndex = medicine.adherenceLogs.findIndex((log) => log.date === date);
    if (logIndex > -1) {
      medicine.adherenceLogs[logIndex].status = status;
    } else {
      medicine.adherenceLogs.push({ date, status });
    }

    await medicine.save();
    res.status(200).json({ success: true, data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const { dosage, frequency, endDate, times, reminder } = req.body;

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { 
        $set: { 
          dosage, 
          frequency, 
          endDate, 
          times, 
          reminder 
        } 
      },
      { new: true } // Returns the updated document
    );

    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    res.status(200).json({ success: true, data: medicine });
  } catch (error) {
    console.error('Update Medicine Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// appointment
const addAppointment = async (req, res) => {
  try {
    const { doctorName, appointmentDate, reason, questionsChecklist, reminder } = req.body;

    if (!doctorName || !appointmentDate) {
      return res.status(400).json({ success: false, message: 'Doctor name and appointment date are required.' });
    }

    const appointment = await Appointment.create({
      user: req.user._id,
      doctorName,
      appointmentDate,
      reason,
      questionsChecklist: questionsChecklist || [],
      reminder: reminder || { inApp: true, email: false, isNotified: false }
    });

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ user: req.user._id }).sort({ appointmentDate: 1 });
    res.status(200).json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// doctor advice

const addDoctorAdvice = async (req, res) => {
  try {
    const { category, instruction, isDailyTask } = req.body;

    if (!instruction) {
      return res.status(400).json({ success: false, message: 'Instruction text is required.' });
    }

    const advice = await DoctorAdvice.create({
      user: req.user._id,
      category: category || 'general',
      instruction,
      isDailyTask: isDailyTask !== undefined ? isDailyTask : true
    });

    res.status(201).json({ success: true, data: advice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDoctorAdvice = async (req, res) => {
  try {
    const advices = await DoctorAdvice.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: advices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// medical history timeline

const getMedicalHistoryTimeline = async (req, res) => {
  try {
    const userId = req.user._id;

    const [prescriptions, medicines, appointments, advices] = await Promise.all([
      Prescription.find({ user: userId }).sort({ createdAt: -1 }),
      Medicine.find({ user: userId }).sort({ createdAt: -1 }),
      Appointment.find({ user: userId }).sort({ appointmentDate: -1 }),
      DoctorAdvice.find({ user: userId }).sort({ createdAt: -1 })
    ]);

    res.status(200).json({
      success: true,
      data: {
        prescriptions,
        medicines,
        appointments,
        advices
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// scan prescription (upload + parse review)

const scanPrescription = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const isPdf = req.file.mimetype === 'application/pdf';
    const resourceType = isPdf ? 'raw' : 'image';

    // upload buffer directly to cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'prescriptions', resource_type: resourceType },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // parse text and extract structured fields
    const parsedData = await parsePrescriptionHybrid(req.file.buffer, req.file.mimetype);

    res.status(200).json({
      success: true,
      data: {
        fileUrl: uploadResult.secure_url,
        fileType: isPdf ? 'pdf' : 'image',
        ...parsedData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// confirm and auto-populate data from review screen

const confirmPrescriptionData = async (req, res) => {
  try {
    const { 
      fileUrl, 
      fileType, 
      doctorName, 
      rawText, 
      medicines, 
      appointment, 
      adviceList, 
      recordType,
      conditions 
    } = req.body;

    const userId = req.user._id; 

    const combinedSummary = conditions && conditions.length > 0 
      ? conditions.map(c => c.name).join(', ') 
      : '';

    const newPrescription = new Prescription({
      user: userId,
      fileUrl,
      fileType,
      doctorName,
      rawText,
      recordType: recordType || 'active',
      illnessSummary: combinedSummary
    });
    await newPrescription.save();

    if (conditions && conditions.length > 0) {
      let profile = await HealthProfile.findOne({ user: userId });
      if (!profile) {
        profile = new HealthProfile({ user: userId });
      }

      for (const cond of conditions) {
        if (!cond.name || cond.type === 'unknown') continue;
        
        const conditionData = { diseaseName: cond.name, identifiedDate: new Date() };

        if (cond.type === 'chronic') {
          const exists = profile.chronicConditions.find(c => c.diseaseName.toLowerCase() === cond.name.toLowerCase());
          if (!exists) profile.chronicConditions.push(conditionData);
        } 
        else if (cond.type === 'temporary') {
          profile.temporaryConditions.push(conditionData);
        } 
        else if (cond.type === 'historical_risk') {
          profile.historicalRisks.push({ riskName: cond.name, identifiedDate: new Date() });
        }
      }
      await profile.save();
    }

    if (recordType === 'archive') {
      return res.status(201).json({ 
        success: true, 
        message: 'Old record archived successfully. Health profile updated.',
        data: newPrescription 
      });
    }

    if (medicines && medicines.length > 0) {
      const medDocs = medicines.map(m => ({
        user: userId,
        prescriptionId: newPrescription._id,
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }));
      await Medicine.insertMany(medDocs);
    }

    if (adviceList && adviceList.length > 0) {
      const adviceDocs = adviceList.map(a => ({
        user: userId,
        prescriptionId: newPrescription._id,
        category: a.category,
        instruction: a.instruction,
        isDailyTask: true
      }));
      await DoctorAdvice.insertMany(adviceDocs);
    }
    
    // UPDATED: Link appointment to the prescription
    if (appointment && appointment.appointmentDate) {
      await Appointment.create({
        user: userId,
        prescription: newPrescription._id, // Added reference
        doctorName: appointment.doctorName || doctorName || 'Unknown Doctor',
        appointmentDate: appointment.appointmentDate,
        reason: combinedSummary || 'Follow-up'
      });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Active prescription confirmed and schedules created.',
      data: newPrescription 
    });

  } catch (error) {
    console.error('Confirm Prescription Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get health insights & adherence stats

const getHealthInsights = async (req, res) => {
  try {
    const userId = req.user._id;
    const adherence = await calculateMedicineAdherence(userId, 7);
    
    res.status(200).json({
      success: true,
      data: adherence
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// generate weekly narrative ai report (paywall-tier feature)

const getWeeklyHealthNarrative = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const report = await generateHealthNarrativeReport(userId, start, end);

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a specific medicine
const deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const medicine = await Medicine.findOneAndDelete({ _id: id, user: req.user._id });
    
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found.' });
    }

    res.status(200).json({ success: true, message: 'Medicine deleted successfully.' });
  } catch (error) {
    console.error('Delete Medicine Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a prescription
const deletePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const prescription = await Prescription.findOneAndDelete({ _id: id, user: userId });
    
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found.' });
    }

    // UPDATED: Cascade delete medicines, advice, AND appointments
    if (prescription.recordType === 'active') {
      await Medicine.deleteMany({ prescriptionId: id, user: userId });
      await DoctorAdvice.deleteMany({ prescriptionId: id, user: userId });
      await Appointment.deleteMany({ prescription: id, user: userId }); // Using 'prescription' as per your schema
    }

    if (prescription.illnessSummary) {
      const conditionNames = prescription.illnessSummary.split(',').map(name => name.trim());
      const conditionsToSafelyRemove = [];

      for (const condition of conditionNames) {
        if (!condition) continue;

        const conditionStillExists = await Prescription.findOne({
          user: userId,
          _id: { $ne: id },
          illnessSummary: { $regex: new RegExp(`\\b${condition}\\b`, 'i') } 
        });

        if (!conditionStillExists) {
          conditionsToSafelyRemove.push(condition);
        }
      }

      if (conditionsToSafelyRemove.length > 0) {
        await HealthProfile.findOneAndUpdate(
          { user: userId },
          { 
            $pull: { 
              chronicConditions: { diseaseName: { $in: conditionsToSafelyRemove } },
              temporaryConditions: { diseaseName: { $in: conditionsToSafelyRemove } },
              historicalRisks: { riskName: { $in: conditionsToSafelyRemove } }
            } 
          }
        );
      }
    }

    res.status(200).json({ 
      success: true, 
      message: 'Prescription, schedules, appointments, and conditions safely deleted.' 
    });
  } catch (error) {
    console.error('Delete Prescription Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};



// Delete individual Appointment
const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findOneAndDelete({ _id: id, user: req.user._id });
    
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    res.status(200).json({ success: true, message: 'Appointment deleted successfully.' });
  } catch (error) {
    console.error('Delete Appointment Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete individual Doctor Advice
const deleteDoctorAdvice = async (req, res) => {
  try {
    const { id } = req.params;
    const advice = await DoctorAdvice.findOneAndDelete({ _id: id, user: req.user._id });
    
    if (!advice) {
      return res.status(404).json({ success: false, message: 'Advice not found.' });
    }

    res.status(200).json({ success: true, message: 'Doctor advice deleted successfully.' });
  } catch (error) {
    console.error('Delete Advice Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getHealthProfile = async (req, res) => {
  try {
    let profile = await HealthProfile.findOne({ user: req.user._id });
    
    if (!profile) {
      profile = {
        chronicConditions: [],
        temporaryConditions: [],
        historicalRisks: []
      };
    }

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Fetch Health Profile Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addMedicine,
  getMedicines,
  updateMedicineAdherence,
  updateMedicine,
  addAppointment,
  getAppointments,
  addDoctorAdvice,
  getDoctorAdvice,
  getMedicalHistoryTimeline,
  scanPrescription,
  confirmPrescriptionData,
  getHealthInsights,
  getWeeklyHealthNarrative,
  deleteMedicine,
  deletePrescription,
  deleteAppointment,
  deleteDoctorAdvice,
  getHealthProfile
};