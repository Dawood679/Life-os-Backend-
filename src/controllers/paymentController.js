const User = require('../models/User');
const Payment = require('../models/Payment');

const getStripeInstance = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (key && key.startsWith('sk_') && !key.includes('...') && !key.includes('YOUR_STRIPE')) {
    return require('stripe')(key);
  }
  return null;
};

// Pricing config
const PLANS = {
  pro_monthly: {
    name: 'LifeOS Pro (Monthly Subscription)',
    amount: 1900, // $19.00 in cents
    interval: 'month',
    planType: 'pro',
    mode: 'subscription',
    durationDays: 30
  },
  yearly_pass: {
    name: 'LifeOS 1-Year Full Access Pass',
    amount: 18000, // $180.00 one-time in cents
    planType: 'pro',
    mode: 'payment',
    durationDays: 365
  },
  pro_yearly: {
    name: 'LifeOS 1-Year Full Access Pass',
    amount: 18000, // $180.00 one-time in cents
    planType: 'pro',
    mode: 'payment',
    durationDays: 365
  }
};

/**
 * Create Stripe Checkout Session
 * POST /api/payments/create-checkout-session
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { plan = 'pro_monthly', email } = req.body;
    const selectedPlan = PLANS[plan] || PLANS.pro_monthly;

    const user = req.user;
    const customerEmail = user ? user.email : email;

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const successUrl = `${clientUrl}/dashboard?payment=success&plan=${selectedPlan.planType}&access=${plan}`;
    const cancelUrl = `${clientUrl}/#pricing?payment=cancelled`;

    const stripe = getStripeInstance();

    // 1. Live/Test Stripe Checkout if Stripe Secret Key is configured
    if (stripe) {
      const sessionParams = {
        payment_method_types: ['card'],
        customer_email: customerEmail || undefined,
        client_reference_id: user ? user._id.toString() : undefined,
        metadata: {
          userId: user ? user._id.toString() : '',
          plan: plan,
          planType: selectedPlan.planType,
          durationDays: String(selectedPlan.durationDays || 365)
        },
        mode: selectedPlan.mode,
        success_url: successUrl,
        cancel_url: cancelUrl
      };

      if (selectedPlan.mode === 'subscription') {
        sessionParams.line_items = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: selectedPlan.name,
                description: 'Universal AI Life Operating System monthly intelligence subscription.'
              },
              unit_amount: selectedPlan.amount,
              recurring: { interval: selectedPlan.interval }
            },
            quantity: 1
          }
        ];
      } else {
        // One-time 1-Year Payment ($180)
        sessionParams.line_items = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: selectedPlan.name,
                description: '1-Year (365 days) unrestricted access to LifeOS Universal AI Intelligence.'
              },
              unit_amount: selectedPlan.amount
            },
            quantity: 1
          }
        ];
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return res.json({
        success: true,
        url: session.url,
        sessionId: session.id,
        mode: 'stripe'
      });
    }

    // 2. If Stripe key is missing and user is not logged in, prompt authentication
    if (!user) {
      return res.status(401).json({
        success: false,
        requireAuth: true,
        message: 'Please sign in or register to activate your LifeOS Pro subscription.'
      });
    }

    // 3. Seamless Dev Simulation Mode for logged-in users
    const isYearly = plan.includes('year') || selectedPlan.durationDays > 60;
    const days = selectedPlan.durationDays || (isYearly ? 365 : 30);
    user.subscription = {
      plan: selectedPlan.planType,
      billingCycle: isYearly ? 'yearly' : 'monthly',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    };
    await user.save({ validateBeforeSave: false });

    // Record Payment Transaction Log
    try {
      await Payment.create({
        user: user._id,
        userEmail: user.email,
        userName: user.name || 'User',
        amount: selectedPlan.amount,
        currency: 'usd',
        plan: isYearly ? 'pro_yearly' : 'pro_monthly',
        billingCycle: isYearly ? 'yearly' : 'monthly',
        status: 'succeeded',
        paymentGateway: 'simulation',
        stripeSessionId: `sim_${Date.now()}`
      });
    } catch (payErr) {
      console.warn('Failed to log simulated payment record:', payErr.message);
    }

    return res.json({
      success: true,
      url: successUrl,
      mode: 'simulation',
      message: `Activated ${selectedPlan.name} (${isYearly ? 'Yearly Pass' : 'Monthly Subscription'})!`
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error initiating Stripe checkout'
    });
  }
};

/**
 * Handle Stripe Webhooks
 * POST /api/payments/webhook
 */
const handleStripeWebhook = async (req, res) => {
  const stripe = getStripeInstance();
  if (!stripe) {
    return res.status(400).send('Stripe not configured');
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId || session.client_reference_id;
        const planType = session.metadata?.planType || 'pro';
        const planKey = session.metadata?.plan || '';
        const isYearly = planKey.includes('year') || (session.metadata?.durationDays && Number(session.metadata.durationDays) > 60);

        let user = null;
        if (userId) {
          user = await User.findById(userId);
        } else if (session.customer_email) {
          user = await User.findOne({ email: session.customer_email });
        }

        if (user) {
          user.subscription = {
            plan: planType,
            billingCycle: isYearly ? 'yearly' : 'monthly',
            status: 'active',
            stripeCustomerId: session.customer || '',
            stripeSubscriptionId: session.subscription || '',
            currentPeriodEnd: new Date(Date.now() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000)
          };
          await user.save({ validateBeforeSave: false });

          // Record Payment in Transaction Log
          try {
            await Payment.create({
              user: user._id,
              userEmail: user.email,
              userName: user.name || 'Customer',
              amount: session.amount_total || (isYearly ? 18000 : 1900),
              currency: session.currency || 'usd',
              plan: isYearly ? 'pro_yearly' : 'pro_monthly',
              billingCycle: isYearly ? 'yearly' : 'monthly',
              status: 'succeeded',
              paymentGateway: 'stripe',
              stripeSessionId: session.id || '',
              stripeCustomerId: String(session.customer || ''),
              stripeSubscriptionId: String(session.subscription || '')
            });
          } catch (payErr) {
            console.warn('Failed to record Stripe payment log:', payErr.message);
          }

          console.log(`[Stripe] Successfully activated ${planType} (${isYearly ? 'yearly' : 'monthly'}) for user ${user.email}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const user = await User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
        if (user) {
          user.subscription.status = 'canceled';
          user.subscription.plan = 'free';
          await user.save({ validateBeforeSave: false });
          console.log(`[Stripe] Subscription canceled for user ${user.email}`);
        }
        break;
      }

      default:
        console.log(`[Stripe] Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Get Subscription Status for current user
 * GET /api/payments/status
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('subscription name email role');
    return res.json({
      success: true,
      subscription: user.subscription || { plan: 'free', status: 'inactive' }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching subscription' });
  }
};

module.exports = {
  createCheckoutSession,
  handleStripeWebhook,
  getSubscriptionStatus
};
