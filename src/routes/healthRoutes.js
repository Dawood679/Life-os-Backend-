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
  deletePrescription,
  deleteAppointment,
  deleteDoctorAdvice,
  getHealthProfile,
  updateMedicine
} = require('../controllers/healthController');

const { protect } = require('../middleware/auth');
const upload = require('../middleware/prescriptionUpload');

// medicine routes
router.route('/medicines')
  .get(protect, getMedicines)
  .post(protect, addMedicine);

router.patch('/medicines/:id/adherence', protect, updateMedicineAdherence);
router.patch('/medicines/:id', protect, updateMedicine);

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
router.get('/profile', protect, getHealthProfile);

// prescription scanner & confirmation routes
router.post('/prescriptions/scan', protect, upload.single('prescription'), scanPrescription);
router.post('/prescriptions/confirm', protect, confirmPrescriptionData);

// health intelligence & weekly ai report routes
router.get('/insights', protect, getHealthInsights);
router.get('/weekly-report', protect, getWeeklyHealthNarrative);


router.delete('/medicines/:id', protect, deleteMedicine);
router.delete('/prescriptions/:id', protect, deletePrescription);
router.delete('/appointments/:id', protect, deleteAppointment);
router.delete('/advice/:id', protect, deleteDoctorAdvice);

module.exports = router;