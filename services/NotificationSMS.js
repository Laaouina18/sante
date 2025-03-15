import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const FREE_SMS_URL = 'https://smsapi.free-mobile.fr/sendmsg';

// Validation des variables d'environnement
const requiredEnvVars = [
  'FREE_MOBILE_USER',  // Votre identifiant Free Mobile (numéro à 8 chiffres)
  'FREE_MOBILE_PASS'   // Votre clé d'identification SMS (disponible sur votre espace Free)
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Variable d'environnement requise manquante: ${envVar}`);
  }
}

/**
 * Envoie un SMS via l'API Free Mobile
 * @param {string} message - Contenu du message
 * @returns {Promise} - Résultat de l'envoi
 */
export const sendSMS = async (message) => {
  if (!message) {
    throw new Error('Le message est requis');
  }

  try {
    const response = await axios.get(FREE_SMS_URL, {
      params: {
        user: process.env.FREE_MOBILE_USER,
        pass: process.env.FREE_MOBILE_PASS,
        msg: message
      }
    });

    if (response.status === 200) {
      console.log('SMS envoyé avec succès');
      return true;
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi du SMS:', error.message);
    switch (error.response?.status) {
      case 400:
        throw new Error('Un des paramètres obligatoires est manquant');
      case 402:
        throw new Error('Trop de SMS envoyés en trop peu de temps');
      case 403:
        throw new Error('Service non activé ou identifiants incorrects');
      case 500:
        throw new Error('Erreur serveur temporaire');
      default:
        throw error;
    }
  }
};