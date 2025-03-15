import express from 'express';
const  router = express.Router();
import authRoutes from './Auth.js';
import Rendezvous from "./Appointment.js"
import medicalRecords from './medicalRecords.js';
import notifications from './notification.js';
import conversation from "./Chat.js";
// index.js
import consultationRoutes from './Consultations.js';

import payement from "./payement.js"
router.use('/consultations', consultationRoutes);
router.use('/auth', authRoutes);
router.use('/rendez',Rendezvous)
router.use('/record',medicalRecords);
router.use('/notifications',notifications)
router.use('/conversation',conversation)
router.use('/payement',payement)

export default router;
