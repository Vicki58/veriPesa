# M-Pesa Payment Verification for Public and Business

A web-based payment verification and reconciliation system for small-scale retailers in Kenya, built on the Safaricom Daraja API.

## Overview
Small business vendors frequently lose money to fake M-Pesa screenshots and manual reconciliation errors. This system eliminates that risk by verifying payments directly against Safaricom's servers — no customer-presented evidence required.

## Core Features
- **STK Push** — vendor initiates a payment request directly to the customer's phone
- **C2B Fallback** — passively receives and matches customer-initiated payments
- **Fraud Detection** — duplicate transaction detection, amount mismatch flagging, and risk scoring
- **Daily Reconciliation** — structured transaction history and end-of-day reports

## Tech Stack
- Frontend: HTML/CSS/JavaScript
- Backend: PHP / Node.js
- Database: MySQL (XAMPP)
- API: Safaricom Daraja Sandbox (STK Push + C2B)
- Deployment: Vercel / Render

## Project Context
Developed as part of IBL 2305: Software Design and Development  
The Technical University of Kenya — B.Tech CNIT Year 2, June–August 2026  
Lecturer: Mr. Chrispinus Ambani

## Status
🟡 Module 1 — SRS Complete  
⬜ Module 2 — DFD/ERD & UML  
⬜ Module 3 — UI/UX Prototyping  
⬜ Module 4 — System Implementation  
⬜ Module 5 — Testing & Deployment
