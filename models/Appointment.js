import mongoose from "mongoose";
// models/Appointment.js
const appointmentSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  
  },
  date: {
    type: Date,
    required: true,
  },
  timeSlot: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: 'En attente'
  },
  reason: {
    type: String,
    required: true,
  },
  payment: {
    amount: { type: Number },
    status: { 
      type: String,
      enum: ['pending', 'completed', 'refunded'],
      default: 'pending'
    },
    transactionId: String
  },
  rating: {
    score: { type: Number, min: 1, max: 5 },
    comment: String
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  consultation:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Consultation',
  }
}, {
  timestamps: true
});
export default mongoose.model('Appointment', appointmentSchema);