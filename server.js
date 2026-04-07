require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'http://localhost:3000';

// Middleware
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://js.stripe.com",
        "https://cdn.jsdelivr.net"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://fonts.googleapis.com"
      ],
      imgSrc: [
        "'self'",
        "https://nhd-static-assets.s3.amazonaws.com",
        "https://nhd-static-assets.s3.us-east-1.amazonaws.com",
        "data:"
      ],
      frameSrc: ["https://js.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
    },
  },
}));

// Stripe webhook needs raw body — must come BEFORE express.json()
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET not set — skipping verification');
    return res.status(400).send('Webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('Payment successful for session:', session.id);
      console.log('Customer email:', session.customer_details?.email);
      console.log('Amount total:', session.amount_total / 100, session.currency?.toUpperCase());
      // TODO: Send confirmation email, update order database, etc.
      break;
    }
    case 'checkout.session.expired': {
      console.log('Checkout session expired:', event.data.object.id);
      break;
    }
    default:
      console.log('Unhandled event type:', event.type);
  }

  res.json({ received: true });
});

// JSON body parser for all other routes
app.use(express.json());

// Serve static site files
app.use(express.static(path.join(__dirname, 'public')));

// Stripe: Create checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { items, shipping } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    // Validate items
    for (const item of items) {
      if (!item.name || typeof item.price !== 'number' || item.price <= 0) {
        return res.status(400).json({ error: 'Invalid item data' });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
        return res.status(400).json({ error: 'Invalid quantity' });
      }
    }

    // Validate shipping cost
    const shippingCost = typeof shipping === 'number' && shipping >= 0 ? shipping : 0;
    const VALID_SHIPPING = [0, 12.99, 18.99, 24.99];
    if (!VALID_SHIPPING.includes(shippingCost)) {
      return res.status(400).json({ error: 'Invalid shipping rate' });
    }

    const line_items = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: String(item.name).substring(0, 200),
          ...(item.image && { images: [String(item.image)] }),
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // Add shipping as a line item if > 0
    if (shippingCost > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping & Handling (UPS Ground)' },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${DOMAIN}/checkout.html?success=true`,
      cancel_url: `${DOMAIN}/checkout.html?canceled=true`,
      shipping_address_collection: {
        allowed_countries: ['US'],
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe: Get product prices (for dynamic pricing)
app.get('/api/products', async (req, res) => {
  try {
    const products = await stripe.products.list({ active: true, expand: ['data.default_price'] });
    res.json(products.data);
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Fallback: serve index.html for clean URLs
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'public', req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

app.listen(PORT, () => {
  console.log(`NHD server running on port ${PORT}`);
});
