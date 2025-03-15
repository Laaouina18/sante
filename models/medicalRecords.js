// models/MedicalRecord.js

import mongoose from 'mongoose';

const medicalRecordSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  documents: [{
    nom: { type: String, required: true },
    type: { type: String, required: true },
    contenu: { type: String, required: true },
    dateAjout: { type: Date, default: Date.now }
  }],
  dateCreation: { type: Date, default: Date.now },
  derniereMiseAJour: { type: Date, default: Date.now }
});

// Middleware pour mettre à jour la date de dernière mise à jour
medicalRecordSchema.pre('save', function(next) {
  this.derniereMiseAJour = new Date();
  next();
});

export default mongoose.model('MedicalRecord', medicalRecordSchema);
