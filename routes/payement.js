import express from 'express';
import Stripe from 'stripe';
import User from '../models/User.js';
import cron from 'node-cron';
import nodemailer from 'nodemailer'; // For sending notification emails

// Initialize Stripe with secret key from environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Configure email transporter (example configuration)
const transporter = nodemailer.createTransport({
  // Configure your email service here
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const paymentRouter = express.Router();

// Annual subscription route
paymentRouter.post('/subscribe', async (req, res) => {
  try {
    const { paymentMethodId, userId, cardDetails ,email,name} = req.body;
    
    // Validate input
    if (!paymentMethodId || !userId) {
      return res.status(400).json({
        message: 'Payment method ID and User ID are required'
      });
    }

    // Retrieve the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user already has an active subscription
    if (user.subscriptionStatus === 'active') {
      return res.status(400).json({
        message: 'User already has an active subscription'
      });
    }

    // Verify Stripe Price ID for annual subscription
    const priceId = process.env.STRIPE_ANNUAL_PRICE_ID;
    if (!priceId) {
      return res.status(500).json({
        message: 'Server configuration error: Missing price ID'
      });
    }

    // Create a Stripe customer
    const customer = await stripe.customers.create({
      payment_method: paymentMethodId,
      email: email,
      name:name,
      metadata: {
        userId: userId
      }
    });

    // Attach the payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    // Create an annual subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price: priceId,
      }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      },
      default_payment_method: paymentMethodId
    });

    // Activate subscription using the new method
   
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  
    // Ajouter la période d'essai de 15 jours
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 15);
  
    user.subscriptionStatus = 'trial';
    user.subscriptionType = 'annual';
    user.subscriptionStartDate = new Date();
    user.subscriptionEndDate = oneYearFromNow;
    user.trialEndDate = trialEndDate; // Nouvelle propriété pour la fin de l'essai
    user.stripeCustomerId = customer.id;
    user.stripeSubscriptionId = subscription.id;
    user.lastPaymentDate = new Date();
    user.nextPaymentDate = oneYearFromNow;
  user.isActive=true;
    await user.save();

    // Send welcome email
    await sendSubscriptionActivationEmail(user);

    return res.status(200).json({
      message: 'Subscription successful',
      success: true,
      subscriptionId: subscription.id,
      nextBillingDate: user.subscriptionEndDate
    });
  } catch (error) {
    console.error('Subscription process error:', error);
    res.status(500).json({
      message: 'Subscription process failed',
      error: error.message
    });
  }
});

// Renew subscription route
paymentRouter.post('/renew', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if renewal is possible
    if (user.subscriptionStatus !== 'expired' && user.subscriptionStatus !== 'grace') {
      return res.status(400).json({
        message: 'Subscription cannot be renewed at this time'
      });
    }
    
    // Retrieve existing Stripe customer
    const customer = await stripe.customers.retrieve(user.stripeCustomerId);
    
    // Create new subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price: process.env.STRIPE_ANNUAL_PRICE_ID,
      }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      }
    });
    
    // Renew subscription
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    user.subscriptionStatus = 'active';
    user.subscriptionEndDate = oneYearFromNow;
    user.stripeSubscriptionId = subscription.id;
    user.lastPaymentDate = new Date();
    user.nextPaymentDate = oneYearFromNow;
    
    await user.save();
    
    // Send renewal confirmation email
    await sendSubscriptionRenewalEmail(user);
    
    return res.status(200).json({
      message: 'Subscription renewed successfully',
      nextBillingDate: user.subscriptionEndDate
    });
  } catch (error) {
    console.error('Subscription renewal error:', error);
    res.status(500).json({
      message: 'Subscription renewal failed',
      error: error.message
    });
  }
});
paymentRouter.post('/start-trial', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Valider l'ID utilisateur
    if (!userId) {
      return res.status(400).json({
        message: 'User ID is required'
      });
    }

    // Récupérer l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Vérifier si l'utilisateur a déjà utilisé un essai
    if (user.trialUsed) {
      return res.status(400).json({
        message: 'Trial has already been used'
      });
    }

    // Vérifier s'il y a déjà un abonnement actif
    if (user.subscriptionStatus === 'active') {
      return res.status(400).json({
        message: 'User already has an active subscription'
      });
    }

    // Activer l'essai gratuit
    if (user.trialUsed) {
      throw new Error('Trial has already been used');
    }
  
    // Définir les dates d'essai
    const now = new Date();
    user.trialStartDate = now;
    user.trialEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 jours
    user.trialStatus = 'active';
    user.trialUsed = true;
  user.isActive=true;
    await user.save();

    // Envoyer un email de confirmation d'essai
    await sendTrialActivationEmail(user);

    return res.status(200).json({
      message: 'Free trial activated successfully',
      success: true,
      trialEndDate: user.trialEndDate
    });
  } catch (error) {
    console.error('Free trial activation error:', error);
    res.status(500).json({
      message: 'Free trial activation failed',
      error: error.message
    });
  }
});
paymentRouter.get('/verif', async () => {
  console.log('Cron job started for checking trials and subscriptions.');

  try {
    // Trouver les utilisateurs avec des essais ou des abonnements à vérifier
    const usersToCheck = await User.find({
      $or: [
        { subscriptionStatus: { $in: ['active', 'grace'] } },
        { trialStatus: 'active' }
      ]
    });

    const now = new Date();

    for (const user of usersToCheck) {
      try {
        // Vérification de l'essai gratuit
        if (user.trialStatus === 'active') {
          if (now > user.trialEndDate) {
            user.trialStatus = 'expired';
            await user.save();
            await sendTrialExpirationEmail(user); // Envoyer l'email d'expiration
            console.log(`Trial expired for user ${user._id}`);
          }
        }

        // Vérification de l'abonnement
        if (user.trialStatus === 'expired' || user.trialStatus !== 'active') {
          if (user.trialEndDate && now <= user.trialEndDate) {
            user.subscriptionStatus = 'trial';
          } else if (user.trialEndDate && now > user.trialEndDate) {
            user.subscriptionStatus = 'active';
          }

          if (user.subscriptionEndDate && now > user.subscriptionEndDate) {
            user.subscriptionStatus = 'expired';
            await user.save();
            await sendSubscriptionExpirationEmail(user); // Envoyer l'email d'expiration
            console.log(`Subscription expired for user ${user._id}`);
          } else if (user.subscriptionEndDate) {
            const gracePeriodEnd = new Date(user.subscriptionEndDate);
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

            if (now > user.subscriptionEndDate && now <= gracePeriodEnd) {
              user.subscriptionStatus = 'grace';
              await user.save();
              console.log(`User ${user._id} is in grace period.`);
            }
          }
        }

        await user.save(); // Enregistrer les modifications du statut de l'utilisateur
      } catch (userError) {
        console.error(`Error processing user ${user._id}:`, userError);
      }
    }
  } catch (error) {
    console.error('Daily subscription and trial check error:', error);
  } finally {
    console.log('Cron job completed.');
  }
});

// Fonction d'aide pour envoyer un email d'activation d'essai
async function sendTrialActivationEmail(user) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Votre essai gratuit a commencé',
      html: `
        <h1>Bienvenue à votre essai gratuit!</h1>
        <p>Vous bénéficiez maintenant d'un essai gratuit de 15 jours.</p>
        <p>Date de fin d'essai: ${user.trialEndDate.toLocaleDateString()}</p>
        <p>Profitez de toutes nos fonctionnalités pendant cette période.</p>
      `
    });
  } catch (error) {
    console.error('Trial activation email error:', error);
  }
}

// Fonction d'aide pour envoyer un email d'expiration d'essai
async function sendTrialExpirationEmail(user) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Votre essai gratuit a expiré',
      html: `
        <h1>Essai terminé</h1>
        <p>Votre période d'essai gratuit de 15 jours est arrivée à son terme.</p>
        <p>Pour continuer à bénéficier de nos services, veuillez souscrire à un abonnement.</p>
      `
    });
  } catch (error) {
    console.error('Trial expiration email error:', error);
  }
}

// Helper function to send subscription activation email
async function sendSubscriptionActivationEmail(user) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Votre abonnement a été activé',
      html: `
        <h1>Bienvenue!</h1>
        <p>Votre abonnement annuel a été activé avec succès.</p>
        <p>Date de fin d'abonnement: ${user.subscriptionEndDate.toLocaleDateString()}</p>
      `
    });
  } catch (error) {
    console.error('Email sending error:', error);
  }
}

// Helper function to send subscription renewal email
async function sendSubscriptionRenewalEmail(user) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Votre abonnement a été renouvelé',
      html: `
        <h1>Renouvellement réussi!</h1>
        <p>Votre abonnement a été renouvelé automatiquement.</p>
        <p>Nouvelle date de fin d'abonnement: ${user.subscriptionEndDate.toLocaleDateString()}</p>
      `
    });
  } catch (error) {
    console.error('Email sending error:', error);
  }
}

// Helper function to send subscription expiration email
async function sendSubscriptionExpirationEmail(user) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Votre abonnement a expiré',
      html: `
        <h1>Abonnement expiré</h1>
        <p>Votre abonnement a expiré. Veuillez renouveler pour continuer à accéder aux services.</p>
      `
    });
  } catch (error) {
    console.error('Email sending error:', error);
  }
}

export default paymentRouter;