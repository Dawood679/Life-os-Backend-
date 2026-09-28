# ⚙️ LifeOS Backend API

High-performance REST API and background automation engine for **LifeOS**, built on Node.js, Express.js, MongoDB (Mongoose), Google Gemini 2.5 Flash / Groq resilience fallback, Google Identity Services OAuth 2.0, and Stripe Payments.

---

## 🛠️ Tech Stack & Dependencies

* **Runtime**: Node.js (v18+) & Express.js
* **Database**: MongoDB with Mongoose ODM
* **Security & Auth**: JWT (HTTP-Only cookies), BcryptJS, Express Rate Limiters, Helmet, CORS
* **Payment Gateway**: Stripe Node.js SDK (Hosted Checkout & Webhook verification)
* **AI Engine**: `@google/genai` (Gemini 2.5 Flash) with fallback to Groq (`qwen/qwen-2.5-32b`, `llama-3.3-70b-versatile`)
* **File Uploads & OCR**: Multer, Cloudinary, `pdf-parse`, `tesseract.js`
* **Cron Schedulers**: `node-cron` for medicine reminders, water logging reset, and health evaluation

---

## 🔑 Environment Configuration

Create a `.env` file in `Life-os-Backend-/`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/lifeos
JWT_SECRET=your_super_secret_jwt_key_here

# AI Engine Keys
GEMINI_API_KEY=AIzaSy...
GROQ_API_KEY=gsk_...

# Cloudinary (Optional, for file storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Stripe Monetization
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 📡 API Endpoint Index

### 1. Authentication & Users (`/api/auth`, `/api/profile`)
* `POST /api/auth/register` — Register a new account
* `POST /api/auth/login` — Email/password login with JWT cookie
* `POST /api/auth/google` — Zero-dependency Google OAuth 2.0 GIS token verification
* `POST /api/auth/logout` — Clear session cookies
* `GET /api/auth/me` — Retrieve active session user
* `GET /api/profile` — Get full user profile and Verified Skill Ledger
* `PUT /api/profile` — Update focus mode, target role, and bio

### 2. Payments & Subscriptions (`/api/payments`)
* `POST /api/payments/create-checkout-session` — Create Stripe Checkout session (Monthly subscription `$19/mo` or 1-Year Pass `$180`)
* `POST /api/payments/webhook` — Stripe webhook listener for `checkout.session.completed` and `customer.subscription.deleted`
* `GET /api/payments/subscription-status` — Retrieve active user tier and expiry

### 3. Proactive Intelligence & Automation
* `GET /api/daily-briefing` — Generate or fetch cached Morning / Nightly Executive Briefing
* `GET /api/rescheduler/evaluate` — Evaluate health deficits and generate task snooze proposal
* `POST /api/rescheduler/confirm` — Execute confirmed task snoozing with rollback snapshot
* `POST /api/rescheduler/undo` — 1-click restore snoozed tasks
* `GET /api/life-score/today` — Calculate today's immutable 0–100 Life Score

### 4. CareerOS Powerhouse
* `POST /api/interview/start` — Initiate turn-by-turn AI mock interview
* `POST /api/interview/turn` — Send interview answer and receive adaptive AI follow-up
* `POST /api/interview/finish` — Finalize interview and generate diagnostic scorecard
* `GET /api/job-applications` — List user job applications (Kanban & 16-Col Excel)
* `POST /api/job-applications` — Create job application entry
* `PUT /api/job-applications/:id` — Update status, salary, or follow-up note
* `DELETE /api/job-applications/:id` — Remove job application
* `POST /api/job-match` — Compare resume against job description for skill gaps

### 5. LearningOS & Skill Transformation
* `POST /api/roadmap/generate` — Generate 90-Day Career Transformation Roadmap
* `POST /api/study-plan` — Create outcome-driven study curriculum
* `POST /api/quiz/generate` — Generate timed AI certification quiz
* `POST /api/quiz/submit` — Score quiz and auto-award Verified Skill Badges (Score >= 80%)
* `POST /api/chat` — Socratic AI study chat tutor
* `POST /api/code-review` — Dual-lens Technical & Business asset analyzer

### 6. HealthOS & Wellness
* `GET /api/wellness/today` — Get today's water, sleep, and mood logs
* `POST /api/wellness/water` — Log water intake (+250ml, +500ml)
* `POST /api/wellness/sleep` — Log sleep hours and quality
* `POST /api/wellness/mood` — Log daily mood
* `POST /api/health/prescriptions/scan` — OCR scan & parse prescription labels

---

## ⚡ Stripe CLI Webhook Forwarding (Local Dev)

To test Stripe checkout events on your local machine:

1. Download and install the [Stripe CLI](https://docs.stripe.com/stripe-cli).
2. Authenticate:
   ```bash
   stripe login
   ```
3. Forward webhook events to your local backend:
   ```bash
   stripe listen --forward-to localhost:5000/api/payments/webhook
   ```
4. Copy the webhook signing secret (starts with `whsec_...`) and paste it into `Life-os-Backend-/.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## 🚀 Running the Server

```bash
# Install dependencies
npm install

# Start development server with auto-reload (nodemon)
npm run dev

# Start production server
npm start
```