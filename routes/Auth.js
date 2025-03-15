import express from "express";
import {verifyToken} from "../middlewares/auth.js"
import { register, login ,getAll, getById,updateUser ,activateUser,deactivateUser,unarchiveUser,archiveUser} from "../controllers/AuthController.js";
import upload from "../middlewares/file.js";
const router = express.Router();

router.post("/register",upload.single('image'), register);
router.post("/login", login);
router.get('/users', getAll); 
router.get('/users/:id',verifyToken, getById); 
router.patch('/users/:id',upload.single('image'),updateUser)
router.put('/:id/archive', archiveUser);
router.put('/:id/unarchive', unarchiveUser);

// Routes pour l'activation
router.put('/:id/activate', activateUser);
router.put('/:id/deactivate',deactivateUser);

export default router;
