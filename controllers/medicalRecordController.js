import MedicalRecord from '../models/medicalRecords.js';
import archiver from 'archiver';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User from "../models/User.js"
// Configuration du stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/medical-records';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configuration de multer avec validation des fichiers
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite de 10MB par fichier
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Formats acceptés: PDF, JPEG, PNG, DOC, DOCX'));
    }
  }
}).array('documents', 10);


// Méthode utilitaire pour préparer les documents
export function prepareDocuments(files) {
  return files.map(file => ({
    nom: file.originalname,
    type: file.mimetype,
    contenu: file.path,
    dateAjout: new Date()
  }));
}

// Méthode utilitaire pour gérer les erreurs de fichiers
export function handleFileError(err, res) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE' 
        ? 'Fichier trop volumineux. Limite: 10MB' 
        : err.message
    });
  }
  return res.status(400).json({
    success: false,
    message: err.message
  });
}

// Créer ou mettre à jour un dossier médical
export async function upsertMedicalRecord(req, res) {
 
  try {
    upload(req, res, async (err) => {
      if (err) {
        return handleFileError(err, res);
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier n\'a été uploadé'
        });
      }
      
      const { patientId } = req.body;
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: 'ID du patient requis'
        });
      }
      let medicalRecord = await MedicalRecord.findOne({ patientId });
      const newDocuments = prepareDocuments(req.files);
      if (medicalRecord) {
        medicalRecord.documents.push(...newDocuments);
        medicalRecord.derniereMiseAJour = new Date();
        await medicalRecord.save();
        const user =await User.findById(patientId);
        if(!user){es.status(201).json({
          success: false,
          message: 'user non trouvé',
        });}
        
        user.medicalRecords.push(medicalRecord._id);
        user.save();
        return res.status(200).json({
          success: true,
          message: 'Documents ajoutés au dossier médical existant',
          data: medicalRecord
        });
      }

      medicalRecord = new MedicalRecord({
        patientId: patientId,
        documents: newDocuments,
        dateCreation: new Date(),
        derniereMiseAJour: new Date()
      });

      await medicalRecord.save();
      const user =await User.findById(patientId);
      if(!user){es.status(201).json({
        success: false,
        message: 'user non trouvé',
      });}
      
      user.medicalRecords.push(medicalRecord._id);
      user.save();
      res.status(201).json({
        success: true,
        message: 'Nouveau dossier médical créé',
      });
    });
    
  } catch (error) {
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Erreur lors de la suppression du fichier:', err);
        });
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la gestion du dossier médical',
      error: error.message
    });
  }
}

// Supprimer un document spécifique avec validation
export async function deleteDocument(req, res) {
  try {
    const { recordId, documentId } = req.params;

    const medicalRecord = await MedicalRecord.findById(recordId);
    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: 'Dossier médical non trouvé'
      });
    }

    const document = medicalRecord.documents.id(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }

    if (fs.existsSync(document.contenu)) {
      fs.unlinkSync(document.contenu);
    }

    await medicalRecord.updateOne({
      $pull: { documents: { _id: documentId } }
    });

    medicalRecord.derniereMiseAJour = new Date();
    await medicalRecord.save();

    res.status(200).json({
      success: true,
      message: 'Document supprimé avec succès'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du document',
      error: error.message
    });
  }
}

// Télécharger tous les documents d'un dossier médical
export async function downloadMedicalRecord(req, res) {
  try {
    const medicalRecord = await MedicalRecord.findById(req.params.id)
      .populate('patient', 'firstName lastName');

    if (!medicalRecord) {
      return res.status(404).json({
        success: false,
        message: 'Dossier médical non trouvé'
      });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { throw err; });

    const patientName = `${medicalRecord.patient.firstName}-${medicalRecord.patient.lastName}`;
    const zipFileName = `dossier-medical-${patientName}-${Date.now()}.zip`;
    
    res.attachment(zipFileName);
    archive.pipe(res);

    for (const doc of medicalRecord.documents) {
      if (fs.existsSync(doc.contenu)) {
        const fileContent = fs.createReadStream(doc.contenu);
        archive.append(fileContent, { name: `${doc.dateAjout.toISOString().split('T')[0]}-${doc.nom}` });
      }
    }

    await archive.finalize();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du dossier médical',
      error: error.message
    });
  }
}
export const getAllRecord=async (req,res)=>{
  const {id}=req.params;
  if(!id){
    return res.status(400).json({
      success:false,
      message: 'Erreur lors du téléchargement du dossier médical',
      error: error.message
    })
  }

  const records = await MedicalRecord.find({patientId:id});
  if(!records){
    return res.status(400).json({
      success:false,
      message: 'Erreur lors du téléchargement du dossier médical',
      error: error.message
    })
  }
  return res.status(200).json(records);
}