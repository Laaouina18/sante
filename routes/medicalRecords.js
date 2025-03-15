import express from 'express';
import {verifyToken} from "../middlewares/auth.js"
import {upsertMedicalRecord,getAllRecord} from '../controllers/medicalRecordController.js';

const router = express.Router();
router.post('/medical-records/upload', upsertMedicalRecord);
router.get('/medical-records/:id',getAllRecord)
export default router;