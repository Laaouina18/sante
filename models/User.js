import mongoose from 'mongoose';

const identityDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  number: {
    type: String,
    required: true
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  // Champs communs
  firstName: {
    type: String,
    
  },
  lastName: {
    type: String,
   
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/.+\@.+\..+/, 'Veuillez entrer un email valide']
  },
  password: {
    type: String,
    
  },
  role: {
    type: String,
    enum: ['patient', 'doctor', 'admin'],
    required: true
  },
  phone: {
    type: String,
    default: null,
  },
  image: {
    type: String,
    default: null,
  },
  
  // Champs spécifiques aux patients
  fileNumber: {
    type: String,
    unique: true,
    sparse: true // Permet null pour les non-patients
  },
  identityDocument: {
    type: identityDocumentSchema,
    required: function() { return this.role === 'patient'; }
  },
  dateOfBirth: {
    type: Date,
    required: function() { return this.role === 'patient'; }
  },
  gender: {
    type: String,
    enum: ['M', 'F', 'other'],
    required: function() { return this.role === 'patient'; }
  },
  address: {
   type:String
  },
city:{
type:String
},
country:{
  type:String
},
  // Champs spécifiques aux médecins (inchangés)
  specialty: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  bio: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  hourlyRate: {
    type: Number,
    required: function() { return this.role === 'doctor'; }
  },

  // Relations
  appointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
  }],
  medicalRecords: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalRecord',
  }],

  // Préférences de notification
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: false // Les comptes sont inactifs par défaut
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  activatedAt: {
    type: Date,
    default: null
  },
  deactivatedAt: {
    type: Date,
    default: null
  },
  archivedAt: {
    type: Date,
    default: null
  },
  users:[{type:mongoose.Schema.ObjectId,
    ref:'User'
  }],
  isAdmin:{
    type:Boolean,
    default:false
  },
  subscriptionStatus: {
    type: String,
    enum: ['inactive', 'active', 'expired', 'grace'],
    default: 'inactive'
  },
  subscriptionType: {
    type: String,
    enum: ['annual', 'monthly', null],
    default: null
  },
  subscriptionStartDate: {
    type: Date,
    default: null
  },
  subscriptionEndDate: {
    type: Date,
    default: null
  },
  lastPaymentDate: {
    type: Date,
    default: null
  },
  nextPaymentDate: {
    type: Date,
    default: null
  },
  
  // Stripe Integration
  stripeCustomerId: {
    type: String,
    default: null
  },
  stripeSubscriptionId: {
    type: String,
    default: null
  },
  trialStatus: {
    type: String,
    enum: ['inactive', 'active', 'expired'],
    default: 'inactive'
  },
  trialStartDate: {
    type: Date,
    default: null
  },
  trialEndDate: {
    type: Date,
    default: null
  },
  trialUsed: {
    type: Boolean,
    default: false
  },
// Modifiez l'enum pour subscriptionStatus
subscriptionStatus: {
  type: String,
  enum: ['inactive', 'trial', 'active', 'expired', 'grace'],
  default: 'inactive'
},
  // Statistiques utilisateur (inchangées)
  stats: {
    totalAppointments: { type: Number, default: 0 },
    cancelledAppointments: { type: Number, default: 0 },
    completedAppointments: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }, // Pour les médecins
    averageRating: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Index pour la recherche rapide par numéro de dossier et document d'identité
userSchema.index({ fileNumber: 1 });
userSchema.index({ 'identityDocument.type': 1, 'identityDocument.number': 1 });

// Virtual pour le nom complet
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});


userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});


// JSON and Object transformations
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });
export default mongoose.model('User', userSchema);








