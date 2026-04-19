require('dotenv').config();
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 5 } });

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
        "https://cdn.jsdelivr.net",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com"
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
        "data:",
        "https://www.googletagmanager.com"
      ],
      frameSrc: ["https://js.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://www.googletagmanager.com", "https://www.google-analytics.com", "https://analytics.google.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
    },
  },
}));

// Bundle index.html uses blob: URLs for its embedded assets; relax CSP
// for the root page only. Other paths keep the strict CSP above.
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' blob: data:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://js.stripe.com; " +
      "style-src 'self' 'unsafe-inline' blob:; " +
      "img-src 'self' blob: data: https:; " +
      "font-src 'self' blob: data:; " +
      "connect-src 'self' blob: https:; " +
      "frame-src 'self' https://js.stripe.com;"
    );
  }
  next();
});

// Stripe webhook needs raw body — must come BEFORE express.json()
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
      // Send order notification email to Nina
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const itemsList = lineItems.data.map(li => `${li.description} x${li.quantity} — $${(li.amount_total / 100).toFixed(2)}`).join('\n');
          const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', port: 587, secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          });
          await transporter.sendMail({
            from: `"NHD Orders" <${process.env.SMTP_USER}>`,
            to: 'nina.malyutina@gmail.com',
            subject: `New order! $${(session.amount_total / 100).toFixed(2)} from ${session.customer_details?.name || 'Customer'}`,
            text: `New order received!\n\nCustomer: ${session.customer_details?.name || 'N/A'}\nEmail: ${session.customer_details?.email || 'N/A'}\nTotal: $${(session.amount_total / 100).toFixed(2)} ${session.currency?.toUpperCase()}\n\nItems:\n${itemsList}\n\nShipping to:\n${session.shipping_details?.name || ''}\n${session.shipping_details?.address?.line1 || ''}\n${session.shipping_details?.address?.city || ''}, ${session.shipping_details?.address?.state || ''} ${session.shipping_details?.address?.postal_code || ''}`
          });
        } catch (emailErr) {
          console.error('Order notification email failed:', emailErr.message);
        }
      }
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

// Rate limiter for contact form
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' }
});

// Contact form
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, phone, company, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: `"NHD Website" <${process.env.SMTP_USER}>`,
      to: 'nina.malyutina@gmail.com',
      replyTo: email,
      subject: `New inquiry from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nCompany: ${company || 'N/A'}\n\nMessage:\n${message}`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Contact form error:', err.message);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// Newsletter subscribe
app.post('/api/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required.' });
    }
    const file = '/opt/nhd/subscribers.json';
    let subs = [];
    try { subs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
    if (subs.includes(email.toLowerCase())) {
      return res.json({ success: true, message: 'Already subscribed!' });
    }
    subs.push(email.toLowerCase());
    fs.writeFileSync(file, JSON.stringify(subs, null, 2));
    res.json({ success: true, message: 'Thanks for subscribing!' });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

// Refund request with photo attachments
app.post('/api/refund', contactLimiter, upload.array('photos', 5), async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and details are required.' });
    }
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    const attachments = (req.files || []).map(f => ({
      filename: f.originalname,
      content: f.buffer,
      contentType: f.mimetype
    }));
    await transporter.sendMail({
      from: `"NHD Website" <${process.env.SMTP_USER}>`,
      to: 'nina.malyutina@gmail.com',
      replyTo: email,
      subject: `Refund request from ${name}`,
      text: `${message}\n\nCustomer email: ${email}\n${attachments.length ? attachments.length + ' photo(s) attached.' : 'No photos attached.'}`,
      attachments
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Refund form error:', err.message);
    res.status(500).json({ error: 'Failed to submit request. Please try again.' });
  }
});

// Serve static site files
app.use(express.static(path.join(__dirname, 'public')));


// Shipping quote: regional base rate × per-item multiplier × qty.
// Free at $180+ subtotal. Origin: Ellicott City, MD 21042.
const NHD_SHIP_MULT = {
  'pirates-dream': 1.0, 'lemon-cake': 1.0, 'just-peachy': 1.0,
  'chocolate-surrender': 1.0, 'red-velvet-cake': 1.0,
  'cakesters': 0.75, 'cakester-singles': 0.75,
  'one-tough-cookie': 0.45, 'cookie-royale': 0.45, 'day-night': 0.45, 'honey-crunch': 0.45,
  'apple-confiture': 0.35,
  'heavens-best': 0, 'have-your-cake-and-eat-it': 0, 'creme-de-la-creme': 0,  // pickup-only
};
function nhdRegionFor(zip) {
  const prefix = parseInt(String(zip).slice(0, 3), 10);
  if (!Number.isFinite(prefix)) return null;
  if (prefix >= 206 && prefix <= 219) return { name: 'local', base: 15.50 };
  if (prefix >= 150 && prefix <= 268) return { name: 'regional', base: 16.00 };
  return { name: 'national', base: 35.00 };
}
app.post('/api/shipping-quote', (req, res) => {
  try {
    const { zip, items, subtotal } = req.body || {};
    if (!zip || !/^\d{5}$/.test(String(zip))) {
      return res.status(400).json({ error: 'Valid 5-digit ZIP required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items' });
    }
    const region = nhdRegionFor(zip);
    if (!region) return res.status(400).json({ error: 'Unsupported ZIP' });
    if (typeof subtotal === 'number' && subtotal >= 180) {
      return res.json({ cost: 0, region: region.name, free: true });
    }
    const totalMult = items.reduce((s, i) => {
      const mult = Object.prototype.hasOwnProperty.call(NHD_SHIP_MULT, i.slug) ? NHD_SHIP_MULT[i.slug] : 1;
      return s + (Number(i.qty) || 1) * mult;
    }, 0);
    if (totalMult === 0) {
      return res.json({ cost: 0, region: region.name, free: false, pickupOnly: true });
    }
    const cost = Math.round(region.base * totalMult * 100) / 100;
    res.json({ cost, region: region.name, free: false });
  } catch (err) {
    console.error('Shipping quote error:', err.message);
    res.status(500).json({ error: 'Failed to calculate shipping' });
  }
});

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
    if (shippingCost > 500) {
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
      allow_promotion_codes: true,
      line_items,
      mode: 'payment',
      success_url: `${DOMAIN}/checkout.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
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

// Order details for success page
app.get('/api/order/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId, {
      expand: ['line_items']
    });
    res.json({
      name: session.customer_details?.name,
      email: session.customer_details?.email,
      total: session.amount_total / 100,
      items: session.line_items?.data.map(li => ({
        name: li.description,
        quantity: li.quantity,
        total: li.amount_total / 100
      }))
    });
  } catch (err) {
    res.status(404).json({ error: 'Order not found' });
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
