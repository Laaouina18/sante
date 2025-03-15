// controllers/consultationController.js
import Consultation from '../models/Consultations.js';
import Appointment from "../models/Appointment.js";
import MedicalRecord from '../models/medicalRecords.js';
import User from "../models/User.js";
import archiver from 'archiver';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuration du stockage des fichiers
const UPLOAD_DIR = 'uploads/medical-records';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non supporté. Formats acceptés: PDF, JPEG, PNG, DOC, DOCX'));
  }
};

const upload = multer({ 
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
}).array('documents', MAX_FILES);

// Fonctions utilitaires
const prepareDocuments = (files) => {
  return files.map(file => ({
    nom: file.originalname,
    type: file.mimetype,
    contenu: file.path,
    dateAjout: new Date()
  }));
};

const handleFileError = (err, res) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE' 
        ? `Fichier trop volumineux. Limite: ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
        : err.message
    });
  }
  return res.status(400).json({
    success: false,
    message: err.message
  });
};

const createAppointment = async (patientId, doctorId, nextAppointmentTime, nextAppointment) => {
  const appointment = new Appointment({
    patientId,
    doctorId,
    timeSlot: nextAppointmentTime,
    date: nextAppointment,
    status: "Confirmé",
    reason: "prochain rendez vous",
  });
  return await appointment.save();
};

const updateMedicalRecord = async (patientId, documents) => {
  let medicalRecord = await MedicalRecord.findOne({ patientId });
  
  if (medicalRecord) {
    medicalRecord.documents.push(...documents);
    medicalRecord.derniereMiseAJour = new Date();
    return await medicalRecord.save();
  }

  medicalRecord = new MedicalRecord({
    patientId,
    documents,
    dateCreation: new Date(),
    derniereMiseAJour: new Date(),
  });
  return await medicalRecord.save();
};

const updateUserMedicalRecords = async (userId, medicalRecordId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Utilisateur non trouvé');
  }

  if (!user.medicalRecords.includes(medicalRecordId)) {
    user.medicalRecords.push(medicalRecordId);
    await user.save();
  }
  return user;
};
 
export const createConsultation = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return handleFileError(err, res);
      }

      try {
        const { nextAppointmentTime, nextAppointment, doctorId, patientId } = req.body;

        // Créer le prochain rendez-vous
        const appointment = await createAppointment(
          patientId, 
          doctorId, 
          nextAppointmentTime, 
          nextAppointment
        );

        // Préparer et mettre à jour le dossier médical
        const documents = prepareDocuments(req.files || []);
        const medicalRecord = await updateMedicalRecord(patientId, documents);

        // Mettre à jour l'utilisateur
        await updateUserMedicalRecords(patientId, medicalRecord._id);

        // Créer la consultation
        const consultation = new Consultation({
          ...req.body,
          nextAppointment: appointment._id,
          documents,
        });
        await consultation.save();
        const appointmentex = await Appointment.findById(req.body.appointmentId);
        if (!appointmentex) {
            throw new Error('Appointment not found');
        }
        
        appointmentex.consultation = consultation._id;
        await appointmentex.save();
        res.status(201).json({
          success: true,
          data: consultation,
          message: 'Consultation créée avec succès'
        });
      } catch (error) {
        // Nettoyer les fichiers uploadés en cas d'erreur
        if (req.files) {
          req.files.forEach(file => {
            fs.unlink(file.path, (err) => {
              if (err) console.error(`Erreur lors de la suppression du fichier: ${err}`);
            });
          });
        }
        
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création de la consultation'
    });
  }
};

export const getConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const consultation = await Consultation.findById(id)
      .populate('nextAppointment')
      .populate('patientId')
      .populate('doctorId');
      
    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      data: consultation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de la consultation'
    });
  }
};

export const updateConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const consultation = await Consultation.findByIdAndUpdate(
      id, 
      req.body,
      { new: true, runValidators: true }
    );

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      data: consultation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour de la consultation'
    });
  }
};

export const deleteConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const consultation = await Consultation.findById(id);

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation non trouvée'
      });
    }

    // Supprimer les fichiers associés
    if (consultation.documents) {
      consultation.documents.forEach(doc => {
        if (fs.existsSync(doc.contenu)) {
          fs.unlinkSync(doc.contenu);
        }
      });
    }

    await Consultation.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Consultation supprimée avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression de la consultation'
    });
  }
};