// routes/consultationRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  createConsultation,
  updateConsultation,
  getConsultation,
  deleteConsultation
} from '../controllers/consultationControlller.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

router.post('/:appointmentId', createConsultation);
router.patch('/:id', updateConsultation);
router.get('/:id', getConsultation);
router.delete('/:id', deleteConsultation);

export default router;