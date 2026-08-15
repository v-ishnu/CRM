# Developer CRM, Invoicing & Telegram Notification System

A complete, production-ready Full-Stack Next.js (App Router) CRM and invoicing application for web developers to manage clients, project milestones, payments, and automated client notifications via the Telegram Bot API.

## Features

- **Admin Dashboard**: Real-time KPI metrics (Total revenue, collections rates, outstanding balances) aggregated from MongoDB.
- **Client & Project Management**: Searchable database, onboarding wizard, status updates with automated notifications.
- **Transaction Ledger**: Individual payment records, server-side project balance calculations, and invoice status updates.
- **Invoice PDF Generator**: Professional PDF generation using `pdfkit`, stored locally and served on-demand.
- **Telegram Bot Integration**:
  - **Client Commands**: `/myprofile`, `/myproject`, `/payments`, `/invoices` (receives latest PDF), `/status`.
  - **Admin Commands**: `/admin`, `/clients`, `/client <clientCode>`, `/payments`, `/pending`, `/invoices` (requires verification against `ADMIN_TELEGRAM_ID`).
  - **Webhook Simulator**: Local diagnostic simulator to test webhook updates without public tunnel dependencies.
- **Security**: jose JWT cookies, password hashing with bcrypt, rate-limiting, and webhook token validation.
- **Audit Logs**: Persistent read-only log entries tracking all sensitive modifications.

---

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose ORM)
- **Styling**: Tailwind CSS v4, Lucide icons
- **Security**: Jose (JWT), BcryptJS
- **PDF Generation**: PDFKit
- **Testing**: Vitest

---

## Folder Structure

```text
client-telegram-management/
├── public/                 # Static assets and saved invoice PDFs
│   └── invoices/           # Generated PDF Invoices (INV-*.pdf)
├── scripts/
│   └── seed.ts             # Database seeder script
├── src/
│   ├── app/
│   │   ├── api/            # API Route Handlers (Dashboard, auth, webhook, etc)
│   │   ├── dashboard/      # Admin console pages
│   │   ├── login/          # Dark-themed login page
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── lib/
│   │   ├── auth/           # JWT & admin bootstrapping helper
│   │   └── db/             # Mongoose cached connection utility
│   ├── models/             # Mongoose schemas (Client, Project, Payment, Invoice, etc)
│   ├── services/           # Business logic layer services
│   ├── tests/              # Vitest test suite
│   └── middleware.ts       # Route guard middleware
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Installation & Setup

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory. You can copy the values from `.env.example`:
```bash
cp .env.example .env
```
Fill out the variables:
- `MONGODB_URI`: Your MongoDB Atlas URI connection string.
- `AUTH_SECRET`: A secure 32+ character random string for JWT.
- `TELEGRAM_BOT_TOKEN`: Retrieve this from [BotFather](https://t.me/BotFather).
- `TELEGRAM_BOT_USERNAME`: Your Telegram bot username.
- `TELEGRAM_WEBHOOK_SECRET`: A secret string for webhook token authentication.
- `ADMIN_TELEGRAM_ID`: Your numerical Telegram user ID (use bots like `/myprofile` or `@userinfobot` to find it).
- `ADMIN_EMAIL` & `ADMIN_PASSWORD`: Default credentials to bootstrap the administrator account.

### 3. Seed Database
Wipe database collections and seed three clients with mock projects, payments, and generated invoice PDFs:
```bash
npm run seed
```

### 4. Run Locally
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in using your `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

---

## Automated Testing
Run Vitest to verify all financial calculations, integrity constraints, and Telegram linking logic:
```bash
npm run test
```

---

## Telegram Bot Setup

### Webhook Configuration
1. Obtain a public HTTPS URL (via VPS deployment or local tunnel tools like `ngrok`).
2. Set your `NEXT_PUBLIC_APP_URL` in `.env` to this domain (e.g. `https://crm.yourdomain.com`).
3. Log in to the CRM dashboard, navigate to **Telegram Bot** settings, and click **Set Webhook**.
4. The system will configure Telegram to send webhook updates to `/api/telegram/webhook` securely.

### Local Testing (Simulator)
If developing locally without a public tunnel, navigate to the **Telegram Bot** dashboard and use the **Webhook Simulator** panel. Input a command (e.g., `/myproject`) and user ID to mock the Telegram Bot payload.

---

## Production Deployment (Linux VPS using PM2 & Nginx)

### 1. Build the Application
```bash
npm run build
```

### 2. Configure PM2 (Process Manager)
Install PM2 globally:
```bash
sudo npm install pm2 -g
```
Start the Next.js production server with PM2:
```bash
pm2 start npm --name "dev-crm" --port 3000 -- run start
pm2 save
pm2 startup
```

### 3. Nginx Reverse Proxy Setup
Configure Nginx to route traffic to the PM2 server. Create a site config under `/etc/nginx/sites-available/crm`:
```nginx
server {
    listen 80;
    server_name crm.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Enable SSL with Certbot (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d crm.yourdomain.com
```

---

## Troubleshooting

- **Mongoose Connection Failures**: Verify your `MONGODB_URI` string and database firewall whitelists.
- **Telegram Not Delivering Messages**: Verify your bot token matches BotFather and the client has started a chat session.
- **PDF Invoice Not Downloading**: Ensure the `public/invoices/` directory has write permissions on your server.
# CRM_ManagedByTelegramBot
