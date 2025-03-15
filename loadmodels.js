import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from './config/db.js'; // Assurez-vous que le chemin est correct
import { Sequelize } from 'sequelize';

// Obtenir le répertoire du module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadModels = async (sequelize) => {
  const models = {};
  const modelFiles = fs.readdirSync(path.join(__dirname, 'models'));

  for (const file of modelFiles) {
    if (file.endsWith('.js')) {
      const modelPath = path.join(__dirname, 'models', file);
      const model = (await import('file://' + modelPath)).default(sequelize, Sequelize.DataTypes);
      models[model.name] = model;
    }
  }

  // Associer les modèles si nécessaire
  Object.keys(models).forEach((modelName) => {
    if (models[modelName].associate) {
      models[modelName].associate(models);
    }
  });

  return models;
};

export default loadModels;
