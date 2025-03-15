// Importer Stripe et configurer l'environnement
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Configuration de Stripe
const stripeConfig = {
  // Vos clés de test ou de production
  publishableKey: 'pk_sbox_3gonepdwhnsetufyex2hb2mcq4=',
  secretKey: 'sk_sbox_jnqutyoh27c2aia3y7ij4rpxuir'
};

// Créer un produit et un prix pour l'abonnement annuel
export async function createStripeProduct() {
  const product = await stripe.products.create({
    name: 'Abonnement Médecin Annuel',
    description: 'Abonnement professionnel pour les médecins'
  });

  const price = await stripe.prices.create({
    unit_amount: 29900, // 299.00 € en centimes
    currency: 'eur',
    recurring: {
      interval: 'year'
    },
    product: product.id,
  });

  return { product, price };
}

// Créer un client Stripe pour un utilisateur
export async function createStripeCustomer(user) {
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    metadata: {
      userId: user._id
    }
  });

  return customer;
}

// Créer un abonnement
export async function createSubscription(customerId, priceId) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent']
  });

  return subscription;
}

export { stripe, stripeConfig };
