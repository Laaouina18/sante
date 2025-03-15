import express from "express";
import { createAppointment,updateAppointment,archiveAppointment,unarchiveAppointment, getAppointments,updateAppointmentStatus,getAppointmentsByUser,checkAvailability } from "../controllers/appointmentController.js";

const router = express.Router();

router.post('/', createAppointment); 
router.get('/', getAppointments); 
router.get('/:userId', getAppointmentsByUser);
router.get('/user/:userId/availability', checkAvailability);
router.patch('/:appointmentId/status', updateAppointmentStatus);
router.patch('/:appointmentId', updateAppointment);

router.patch('/:appointmentId/archive', archiveAppointment);
router.patch('/:appointmentId/unarchive', unarchiveAppointment);

export default router;
