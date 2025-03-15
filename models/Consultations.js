// models/Consultation.js
import mongoose from 'mongoose';

const consultationSchema = new mongoose.Schema({
  diagnostic: { type: String, required: true },
  symptoms: { type: String, required: true },
  notes: { type: String },
  medications: [
    {
      name: { type: String },
      dosage: { type: String },
      frequency: { type: String },
      duration: { type: String }
    }
  ],
  nextAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  medicalTests: { type: String },
  recommendations: { type: String },
  documents: [{
    nom: { type: String, required: true },
    type: { type: String, required: true },
    contenu: { type: String, required: true },
    dateAjout: { type: Date, default: Date.now }
  }],
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

const Consultation = mongoose.model('Consultation', consultationSchema);
export default Consultation;