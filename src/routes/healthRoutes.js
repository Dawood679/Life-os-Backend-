const express = require('express');
const router = express.Router();

const {
  addMedicine,
  getMedicines,
  updateMedicineAdherence,
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
  deletePrescription
} = require('../controllers/healthController');

const { protect } = require('../middleware/auth');
const upload = require('../middleware/prescriptionUpload');

// medicine routes
router.route('/medicines')
  .get(protect, getMedicines)
  .post(protect, addMedicine);

router.patch('/medicines/:id/adherence', protect, updateMedicineAdherence);

// appointment routes
router.route('/appointments')
  .get(protect, getAppointments)
  .post(protect, addAppointment);

// doctor advice routes
router.route('/advice')
  .get(protect, getDoctorAdvice)
  .post(protect, addDoctorAdvice);

// medical history timeline
router.get('/history', protect, getMedicalHistoryTimeline);

// prescription scanner & confirmation routes
router.post('/prescriptions/scan', protect, upload.single('prescription'), scanPrescription);
router.post('/prescriptions/confirm', protect, confirmPrescriptionData);

// health intelligence & weekly ai report routes
router.get('/insights', protect, getHealthInsights);
router.get('/weekly-report', protect, getWeeklyHealthNarrative);


router.delete('/medicines/:id', protect, deleteMedicine);
router.delete('/prescriptions/:id', protect, deletePrescription);

module.exports = router;