import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { createNotification } from '../services/NotivicationService.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const generateFileNumber = (patient, timestamp) => {
  const documentType = patient.identityDocument.type.substring(0, 2).toUpperCase();
  const firstNamePrefix = patient.firstName.substring(0, 2).toUpperCase();
  const lastNamePrefix = patient.lastName.substring(0, 2).toUpperCase();
  const date = new Date(timestamp);
  const year = date.getFullYear().toString().substring(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const randomDigits = crypto.randomInt(1000, 9999).toString();

  return `${documentType}${firstNamePrefix}${lastNamePrefix}${year}${month}${randomDigits}`;
};

const validateIdentityDocument = (identityDoc) => {
  if (!identityDoc || (!identityDoc.cin && !identityDoc.passport && !identityDoc.other)) {
    throw new Error("Au moins un document d'identité est requis (CIN, Passport, ou Autre)");
  }
  
  if (identityDoc.cin) {
    if (!/^[A-Z0-9]{4,12}$/i.test(identityDoc.cin)) {
      throw new Error("Format de CIN invalide");
    }
    return {
      type: 'cin',
      number: identityDoc.cin
    };
  }
  
  if (identityDoc.passport) {
    if (!/^[A-Z0-9]{6,12}$/i.test(identityDoc.passport)) {
      throw new Error("Format de passeport invalide");
    }
    return {
      type: 'passport',
      number: identityDoc.passport
    };
  }
  
  if (identityDoc.other) {
   
    return {
      type: identityDoc.other||null,
      number: identityDoc.number|| null
    };
  }
};

export const createAppointment = async (req, res) => {
  const {
    doctorId,
    date,
    timeSlot,
    reason,
    patient,
    payment,
    patientId
  } = req.body;

  try {
    let user;
    if (patientId) {
      user = await User.findById(patientId);
    } else {
      if (!patient || !patient.firstName || !patient.lastName || !patient.email || !patient.phone || !patient.identityDocument) {
        return res.status(400).json({
          message: "Informations du patient incomplètes"
        });
      }

      let formattedIdentityDoc;
      try {
        formattedIdentityDoc = validateIdentityDocument(patient.identityDocument);
      } catch (error) {
        return res.status(400).json({
          message: error.message
        });
      }

      user = await User.findOne({
        $or: [
          { 'identityDocument.type': formattedIdentityDoc.type, 'identityDocument.number': formattedIdentityDoc.number },
          { email: patient.email }
        ]
      });

      if (!user) {
        const timestamp = new Date().getTime();
        const fileNumber = generateFileNumber({ ...patient, identityDocument: formattedIdentityDoc }, timestamp);

        user = new User({
          firstName: patient.firstName,
          lastName: patient.lastName,
          email: patient.email,
          phone: patient.phone,
          identityDocument: formattedIdentityDoc,
          fileNumber: fileNumber,
          role: 'patient',
          address: patient.address,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          createdAt: timestamp
        });

        await user.save();
      
      } else if (!user.fileNumber) {
        user.fileNumber = generateFileNumber({ ...patient, identityDocument: formattedIdentityDoc }, new Date().getTime());
        
        await user.save();
      }
    }

    const existingAppointment = await Appointment.findOne({
      doctorId,
      date,
      timeSlot,
      status: { $ne: 'Annulé' }
    });

    if (existingAppointment) {
      return res.status(409).json({
        message: "Ce créneau horaire n'est plus disponible."
      });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        message: "Médecin non trouvé."
      });
    }

    if (payment.amount !== doctor.hourlyRate) {
      return res.status(400).json({
        message: "Le montant du paiement ne correspond pas au tarif du médecin."
      });
    }

    const appointment = new Appointment({
      doctorId,
      patientId: user._id,
      fileNumber: user.fileNumber,
      date,
      timeSlot,
      reason,
      status: 'En attente',
      payment: {
        amount: payment.amount,
        status: 'pending',
      },
      patientInfo: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
        identityDocument: user.identityDocument,
        fileNumber: user.fileNumber
      }
    });

    await appointment.save();
    user.users.push(doctor._id);
    user.appointments.push(appointment._id);
    await user.save();
    doctor.users.push(user._id);
    doctor.appointments.push(appointment._id);
    await doctor.save();

    const formattedDate = new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Notification pour le médecin
    const notificationDataDoctor = {
      title: {
        fr: "Nouveau rendez-vous",
        en: "New Appointment",
        ar: "موعد جديد"
      },
      senderId: user._id,
      receiverId: doctorId,
      message: {
        fr: `Nouveau rendez-vous le ${formattedDate} avec ${user.firstName} ${user.lastName}`,
        en: `New appointment on ${formattedDate} with ${user.firstName} ${user.lastName}`,
        ar: `موعد جديد في ${formattedDate} مع ${user.firstName} ${user.lastName}`
      }
    };
    await createNotification(doctorId,notificationDataDoctor);

    // Notification pour le patient
   
    return res.status(201).json({
      message: 'Rendez-vous créé avec succès',
      appointment,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        fileNumber: user.fileNumber
      }
    });

  } catch (error) {
    console.error('Appointment creation error:', error);
    return res.status(500).json({
      message: "Une erreur s'est produite lors de la création du rendez-vous.",
      error: error.message
    });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  const { appointmentId } = req.params;
  const { status } = req.body;

  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorId')
      .populate('patientId');

    if (!appointment) {
      return res.status(404).json({
        message: 'Rendez-vous non trouvé.'
      });
    }

    const appointmentDate = new Date(appointment.date);
    const now = new Date();

    if (appointmentDate < now) {
      return res.status(400).json({
        message: 'Impossible de modifier un rendez-vous passé.'
      });
    }

    appointment.status = status;

    if (status === 'Annulé' && appointment.payment?.status === 'completed') {
      appointment.payment.status = 'refunded';
    }

    await appointment.save();

    const formattedDate = new Date(appointment.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let title, message;
    switch (status) {
      case 'Confirmé':
        title = {
          fr: 'Rendez-vous confirmé',
          en: 'Appointment Confirmed',
          ar: 'تم تأكيد الموعد'
        };
        message = {
          fr: `Votre rendez-vous du ${formattedDate} a été confirmé`,
          en: `Your appointment on ${formattedDate} has been confirmed`,
          ar: `تم تأكيد موعدك في ${formattedDate}`
        };
        break;
      case 'Annulé':
        title = {
          fr: 'Rendez-vous annulé',
          en: 'Appointment Canceled',
          ar: 'تم إلغاء الموعد'
        };
        message = {
          fr: `Le rendez-vous du ${formattedDate} a été annulé`,
          en: `The appointment on ${formattedDate} has been canceled`,
          ar: `تم إلغاء الموعد في ${formattedDate}`
        };
        break;
      default:
        title = {
          fr: 'Mise à jour du rendez-vous',
          en: 'Appointment Update',
          ar: 'تحديث الموعد'
        };
        message = {
          fr: `Le statut de votre rendez-vous du ${formattedDate} a été mis à jour`,
          en: `The status of your appointment on ${formattedDate} has been updated`,
          ar: `تم تحديث حالة موعدك في ${formattedDate}`
        };
    }

    // Notification pour le médecin
    const notificationDataDoctor = {
      title: {
        fr: title.fr,
        en: title.en,
        ar: title.ar
      },
      senderId: appointment.patientId._id,
      receiverId: appointment.doctorId._id,
      message: {
        fr: `${message.fr} avec ${appointment?.patientId?.firstName}`,
        en: `${message.en} with ${appointment?.patientId?.firstName}`,
        ar: `${message.ar} مع ${appointment?.patientId?.firstName}`
      }
    };
    await createNotification(appointment.doctorId._id,notificationDataDoctor);

    // Notification pour le patient
    const notificationDataPatient = {
      title: {
        fr: title.fr,
        en: title.en,
        ar: title.ar
      },
      senderId: appointment.doctorId._id,
      receiverId: appointment.patientId._id,
      message: {
        fr: `${message.fr} avec Dr. ${appointment?.doctorId?.firstName} ${appointment?.doctorId?.lastName}`,
        en: `${message.en} with Dr. ${appointment?.doctorId?.firstName} ${appointment?.doctorId?.lastName}`,
        ar: `${message.ar} مع د. ${appointment?.doctorId?.firstName} ${appointment?.doctorId?.lastName}`
      }
    };
    await createNotification(appointment.patientId._id,notificationDataPatient);

    return res.status(200).json({
      message: 'Statut du rendez-vous mis à jour avec succès',
      appointment
    });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    return res.status(500).json({
      message: "Une erreur s'est produite lors de la mise à jour du statut du rendez-vous.",
      error: error.message
    });
  }
};

export const updateAppointment = async (req, res) => {
  const { appointmentId } = req.params;
  const { date, timeSlot } = req.body;

  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorId')
      .populate('patientId');
    
    if (!appointment) {
      return res.status(404).json({
        message: 'Rendez-vous non trouvé.'
      });
    }

    const appointmentDate = new Date(appointment.date);
    const now = new Date();
    
    if (appointmentDate < now || date < now) {
      return res.status(400).json({
        message: 'Impossible de modifier un rendez-vous passé.'
      });
    }

    const conflictingAppointment = await Appointment.findOne({
      doctorId: appointment.doctorId,
      date,
      timeSlot,
      _id: { $ne: appointmentId },
      status: { $nin: ['Annulé'] }
    });

    if (conflictingAppointment) {
      return res.status(400).json({
        message: 'Ce créneau horaire est déjà réservé.'
      });
    }

    appointment.date = date;
    appointment.timeSlot = timeSlot;
    await appointment.save();

    const formattedDate = new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Notification pour le médecin
    const notificationDataDoctor = {
      title: {
        fr: "Modification de rendez-vous",
        en: "Appointment Modification",
        ar: "تعديل الموعد"
      },
      senderId: appointment.patientId._id,
      receiverId: appointment.doctorId._id,
      message: {
        fr: `Le rendez-vous avec ${appointment.patientInfo.name} a été modifié pour le ${formattedDate} à ${timeSlot}`,
        en: `The appointment with ${appointment.patientInfo.name} has been modified to ${formattedDate} at ${timeSlot}`,
        ar: `تم تعديل الموعد مع ${appointment.patientInfo.name} إلى ${formattedDate} في الساعة ${timeSlot}`
      }
    };
    await createNotification(receiverId,notificationDataDoctor);

    // Notification pour le patient
    const notificationDataPatient = {
      title: {
        fr: "Modification de rendez-vous",
        en: "Appointment Modification",
        ar: "تعديل الموعد"
      },
      senderId: appointment.doctorId._id,
      receiverId: appointment.patientId._id,
      message: {
        fr: `Votre rendez-vous avec Dr. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName} a été modifié pour le ${formattedDate} à ${timeSlot}`,
        en: `Your appointment with Dr. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName} has been modified to ${formattedDate} at ${timeSlot}`,
        ar: `تم تعديل موعدك مع د. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName} إلى ${formattedDate} في الساعة ${timeSlot}`
      }
    };
    await createNotification(receiverId,notificationDataPatient);

    return res.status(200).json({
      message: 'Rendez-vous modifié avec succès',
      appointment
    });

  } catch (error) {
    console.error('Error updating appointment:', error);
    return res.status(500).json({
      message: "Une erreur s'est produite lors de la modification du rendez-vous.",
      error: error.message
    });
  }
};

export const getAppointments = async (req, res) => {

  try {
    const appointments = await Appointment.find()
      .populate('doctorId')
      .populate({
        path: 'patientId',
        populate: {
          path: 'medicalRecords',
          model: "MedicalRecord"
        }
      }).populate({
        path: 'consultation',
        populate: {
          path: 'nextAppointment',
          model: "Appointment"
        }
      });
    
    return res.status(200).json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({ 
      message: "Une erreur s'est produite lors de la récupération des rendez-vous.",
      error: error.message 
    });
  }
};

export const getAppointmentsByUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    let appointments;
    if (user.role === 'doctor') {
      appointments = await Appointment.find({ doctorId: userId })
        .populate('patientId')
        .populate('doctorId').populate({
          path: 'consultation',
          populate: {
            path: 'nextAppointment',
            model: "Appointment"
          }
        }).sort({ date: 1, timeSlot: 1 });
    } else {
      appointments = await Appointment.find({ patientId: userId })
      .populate('patientId')
      .populate('doctorId').populate('consultation')
      .sort({ date: 1, timeSlot: 1 });
    }
    return res.status(200).json(appointments);
  } catch (error) {
    console.error('Error fetching user appointments:', error);
    return res.status(500).json({ 
      message: "Une erreur s'est produite lors de la récupération des rendez-vous.",
      error: error.message 
    });
  }
};

export const checkAvailability = async (req, res) => {
  const { userId } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ 
      message: 'La date est requise.' 
    });
  }

  try {
    // Récupérer le médecin pour vérifier s'il existe
    const doctor = await User.findById(userId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ 
        message: 'Médecin non trouvé.' 
      });
    }

    // Récupérer tous les rendez-vous du médecin pour la date spécifiée
    const appointments = await Appointment.find({ 
      doctorId: userId, 
      date: date,
      status: { $ne: 'Annulé' }
    });

    // Définir les créneaux horaires disponibles
    const timeSlots = [
      '09:00', '10:00', '11:00', '12:00',
      '14:00', '15:00', '16:00', '17:00'
    ];

    // Filtrer les créneaux déjà réservés
    const reservedSlots = appointments.map(appointment => appointment.timeSlot);
    const availableSlots = timeSlots.filter(slot => !reservedSlots.includes(slot));

    // Préparer la notification pour le médecin
    const formattedDate = new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

  

    return res.status(200).json({
      availableSlots,
      message: availableSlots.length > 0 
        ? `${availableSlots.length} créneaux disponibles pour le ${formattedDate}.`
        : `Aucun créneau disponible pour le ${formattedDate}.`,
      totalSlots: timeSlots.length,
      reservedSlots: reservedSlots.length,
      availableCount: availableSlots.length
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    return res.status(500).json({ 
      message: "Une erreur s'est produite lors de la vérification de la disponibilité.",
      error: error.message 
    });
  }
};

export const archiveAppointment = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorId')
      .populate('patientId');

    if (!appointment) {
      return res.status(404).json({ 
        message: 'Rendez-vous non trouvé.' 
      });
    }

    appointment.isArchived = true;
    await appointment.save();
    

    return res.status(200).json({
      message: 'Rendez-vous archivé avec succès',
      appointment
    });
  } catch (error) {
    console.error('Erreur lors de l\'archivage du rendez-vous:', error);
    return res.status(500).json({
      message: "Une erreur s'est produite lors de l'archivage du rendez-vous.",
      error: error.message
    });
  }
};

export const unarchiveAppointment = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorId')
      .populate('patientId');

    if (!appointment) {
      return res.status(404).json({ 
        message: 'Rendez-vous non trouvé.' 
      });
    }

    appointment.isArchived = false;
    await appointment.save();

 
    c

    return res.status(200).json({
      message: 'Rendez-vous désarchivé avec succès',
      appointment
    });
  } catch (error) {
    console.error('Erreur lors du désarchivage du rendez-vous:', error);
    return res.status(500).json({
      message: "Une erreur s'est produite lors du désarchivage du rendez-vous.",
      error: error.message
    });
  }
};

export default {
  createAppointment,
  updateAppointmentStatus,
  updateAppointment,
  getAppointments,
  getAppointmentsByUser,
  checkAvailability,
  archiveAppointment,
  unarchiveAppointment
};