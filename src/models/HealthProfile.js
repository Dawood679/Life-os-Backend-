const mongoose = require('mongoose');

const healthProfileSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true 
  },
  chronicConditions: [{
    diseaseName: { type: String, required: true }, // e.g., Diabetes, Hypertension
    identifiedDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'resolved'], default: 'active' }
  }],
  temporaryConditions: [{
    diseaseName: { type: String, required: true }, // e.g., Viral Fever, Dengue
    identifiedDate: { type: Date, default: Date.now },
    resolvedAt: { type: Date } // Expected end date
  }],
  historicalRisks: [{
    riskName: { type: String, required: true }, // e.g., Low Hemoglobin, Penicillin Allergy
    identifiedDate: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('HealthProfile', healthProfileSchema);