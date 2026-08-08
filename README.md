# VeriPesa — M-Pesa Payment Verification & Reconciliation System

VeriPesa is a web-based payment verification and reconciliation system designed for small-scale retail vendors in Kenya. The application integrates with Safaricom's Daraja Sandbox API (supporting both STK Push callbacks and C2B PayBill confirmation webhooks) to verify customer payments in real-time, detect fraud or transaction mismatches, and automate daily financial reports.

---

## 🎨 Design Theme & Core Features

VeriPesa features a premium, responsive glassmorphic design supporting both **Dark Mode** and **Light Mode** options:
- **Persistent Light & Dark Theme**: Users can toggle between dark slate styling and clean, white-background layouts mimicking the project's original design wireframes. The preference is stored in `localStorage` to persist across logins.
- **Visual Fraud Flags**: Any transaction discrepancies (such as amount mismatches or duplicate receipt IDs) are flagged instantly, highlighted with a distinct **red left-border** inside ledger tables.
- **Onboarding Wizard**: A 3-step registration workflow verifying vendor accounts, business category types, and identity documents.
- **Secure Transaction Portals**: Standardized inputs using `+254` phone prefixes, CBK compliance footer banners, and secure SSL indicators.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, Vanilla CSS3, Javascript (ES6) |
| **Backend** | Node.js, Express.js |
| **Database** | MySQL (via XAMPP / Local host) |
| **Payment API** | Safaricom Daraja API Sandbox (STK Push & C2B PayBill) |

---

## 📂 Project Structure

```
Veripesa/
├── config/
│   └── db.js                 # Lazy pool connection, auto-database creation, & schema migrator
├── controllers/
│   ├── authController.js     # User registration (bcrypt) and login (phone/email interchangeable)
│   ├── callbackController.js # Handles incoming STK & C2B confirmation callbacks from Safaricom
│   ├── paymentController.js  # STK Push triggers & C2B manual sandbox simulation handlers
│   ├── reportController.js   # Generates daily transaction reconciliation summaries
│   ├── saleController.js     # Manages sale order initialization
│   └── transactionController.js # Transaction ledger auditor and dispute logs
├── middleware/
│   └── auth.js               # JWT security route protector
├── public/                   # Client static files
│   ├── css/
│   │   └── style.css         # UI custom variables, layouts, and theme animations
│   ├── js/
│   │   └── app.js            # API request handlers and global theme toggle injection
│   ├── dashboard.html        # Main reconciliation interface & C2B simulation tools
│   ├── disputes.html         # Flagged payment review deck & dispute manager
│   ├── index.html            # 3-Step signup wizard and phone/PIN login panels
│   ├── new-sale.html         # STK payment dispatcher & countdown overlays
│   ├── settings.html         # Account profile details & support configurations
│   └── transactions.html     # Historical audit trails & unmatched PayBill log linkers
├── routes/                   # Route grouping registries (auth, sales, payments, callbacks)
├── schema.sql                # Relational database schema structure
├── server.js                 # Main server startup & Daraja registrar
└── services/
    ├── daraja.js             # M-Pesa STK Push, C2B URL registrations, and Mock callbacks
    └── matching.js           # Reconciliation engine (checks duplicate refs & amount matches)
```

---

## 🚀 Local Installation & Setup

Follow these steps to run VeriPesa on your local development machine:

### 1. Prerequisites
- Install **Node.js** (v16+ recommended).
- Install and start **MySQL** (e.g., using **XAMPP Control Panel** or direct installation).

### 2. Database Migration (Automated)
The application is configured to automatically create the database and tables.
- Start your local MySQL server on port `3306`.
- Ensure your root user credentials match the configurations in `.env` (default is host: `localhost`, user: `root`, password: empty).
- The server will execute migrations from `schema.sql` automatically upon startup if tables are missing!

### 3. Install Dependencies
In the project root directory, run:
```bash
npm install
```

### 4. Set Environment Variables
Create a `.env` file in the root folder with the following variables:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=veripesa
JWT_SECRET=veripesa_development_secret_key_12345

# Leave blank or use 'placeholder' to run in local Mock Mode
CONSUMER_KEY=placeholder
CONSUMER_SECRET=placeholder
SHORTCODE=174379
PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
NGROK_URL=http://localhost:3000
```

### 5. Start the Server
Run the application server:
```bash
node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🧪 Running Diagnostic Tests

To verify the core reconciliation matching engine rules independently of the database, execute the unit test suite:
```bash
node C:/Users/incai/.gemini/antigravity/brain/e3254def-a5bb-4cae-a0d4-24a9b8ad7234/scratch/test_matching.js
```

---

## 👨‍💻 Developer Credits
Developed for **IBL 2305: Software Design and Development** under **Mr. Chrispinus Ambani** at the Technical University of Kenya.
- **Developer:** Victor Mbatia
- **Student ID:** SCCJ/01560/2024
- **Specialization:** B.Tech IT, Year 2
