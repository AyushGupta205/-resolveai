# ResolveAI — 3 to 5 Minute Demo Walkthrough Script

This script provides an exact step-by-step narrative and screen walkthrough for your internship assessment demo recording.

---

## ⏱️ Video Timing Overview

| Segment | Timing | Topic |
|---|---|---|
| **1. Intro & Architecture** | 0:00 – 0:35 | Problem statement, technology stack, and roles overview |
| **2. Customer Ticket Flow** | 0:35 – 1:30 | Customer login, submitting a ticket with AI category detection |
| **3. Agent Cockpit & AI Draft**| 1:30 – 2:45 | Round-robin queue, SLA overdue alert, AI draft editing, public reply |
| **4. Security & Staff Notes** | 2:45 – 3:30 | Creating internal note, verifying zero leakage in customer view |
| **5. Admin Analytics & Tests** | 3:30 – 4:30 | Executive KPIs, agent management, Recharts data, running 18 tests |

---

## 🎬 Step-by-Step Script & Actions

### 1. Introduction & Overview (0:00 – 0:35)
- **On Screen**: Open `http://localhost:5173/login`.
- **Narration**:
  > *"Hello! Today I'm presenting **ResolveAI — Intelligent Support Desk**, a full-stack, enterprise-grade customer support platform built for technical SaaS teams.
  > The application is built with a React and Tailwind CSS frontend, a Node.js Express backend with an ACID-compliant SQLite database, JWT authentication in HTTP-only cookies, and Google Gemini AI integration.
  > ResolveAI features three distinct roles: Customer, Support Specialist, and Administrator, with role-based access control enforced at the database query level."*

### 2. Customer Submission & AI Categorization (0:35 – 1:30)
- **On Screen**: Click the **"Customer"** quick-login button (`john.doe@acmecorp.com`), then click **Sign In**.
- **Action**: Navigate to Customer Dashboard. Click **"New Support Ticket"**.
- **Fill Form**:
  - Subject: `Webhook timeout on EU endpoint during midnight sync`
  - Category: Leave as *Auto-detect with Gemini AI*
  - Priority: `High`
  - Description: `Our server api.techstartup.co is timing out after 30 seconds when processing incoming dispatch events.`
  - Optional: Attach a screenshot or sample file.
  - Click **"Submit Ticket"**.
- **Narration**:
  > *"Notice how the ticket is immediately submitted and Gemini automatically categorized it under 'Technical Issue'.
  > At the same time, the server calculated a persistent 4-hour SLA first-response deadline in UTC and assigned the ticket via transactional round-robin to the next available specialist, skipping anyone on leave."*

### 3. Specialist Queue, SLA Alerts & AI Reply Draft (1:30 – 2:45)
- **Action**: Log out and click the **"Agent"** quick-login button (`sarah.agent@resolveai.com`).
- **On Screen**: Agent Dashboard.
- **Narration**:
  > *"Logging in as Senior Specialist Sarah Connor, we see our operational command center.
  > Notice the dynamic SLA badges: tickets with less than 1 hour remaining glow amber, and overdue tickets feature prominent red alert badges. SLA statuses are calculated from real database timestamps, not browser timers."*
- **Action**: Click on the newly created ticket `Webhook timeout on EU endpoint...` (or an overdue ticket).
- **Action**: In the ticket detail view, show the **"Generate AI Draft"** button and click it.
- **Narration**:
  > *"When an agent needs to reply, clicking 'Generate AI Draft' queries Gemini using only public customer context.
  > Notice that the AI draft is placed into an editable textarea and is NEVER sent automatically. The human agent remains in full control. The specialist can review, customize the instructions, and explicitly click 'Send Public Reply'."*
- **Action**: Type an edit or click **"Send Public Reply"**.
- **Narration**:
  > *"The moment the public reply is saved, the first-response SLA timer stops and the ticket status transitions to 'In Progress'."*

### 4. Staff-Only Internal Notes & Zero-Leakage Privacy (2:45 – 3:30)
- **Action**: On the same ticket, switch to the **"Internal Staff Note"** tab (highlighted in amber with lock icon).
- **Fill Note**: `INTERNAL NOTE: Checked ingress NAT logs. Gateway IP 10.0.4.15 was throttled by Cloudflare rate limits. Hotfix deploying.`
- **Action**: Click **"Save Internal Note"**.
- **Narration**:
  > *"Notice that the internal note is styled with amber warning banners and lock indicators, and it does NOT reset or touch the first-response SLA timer.
  > Now, let's verify security: if we log back in as the customer John Doe and open this ticket, the internal note is completely absent. Our backend filters internal notes at the SQL query layer, so confidential notes and attachments never reach customer payloads."*

### 5. Administrator Analytics, Staff Control & Automated Tests (3:30 – 4:30)
- **Action**: Log in as Administrator (`admin@resolveai.com`).
- **On Screen**: Admin Dashboard.
- **Narration**:
  > *"In the Administrator Portal, executives have real-time visibility into total SLA breaches, average first-response times calculated strictly from answered tickets, and interactive Recharts breakdowns for ticket categories, priorities, and daily volume trends."*
- **Action**: Navigate to **"Staff Management"** (`/admin/agents`).
- **Narration**:
  > *"Administrators can view individual specialist workloads and toggle agent rotation status. Deactivating an agent instantly skips them in future round-robin ticket assignments while safely preserving all previously assigned tickets."*
- **Action**: Switch to the terminal and run the test suite:
  ```bash
  cd server && npm test
  ```
- **Narration**:
  > *"Finally, here is our automated backend test suite built with Vitest and Supertest running against an isolated test database.
  > All 18 tests pass with zero errors, validating password hashing, internal note privacy, round-robin dispatching, SLA timer stoppage, attachment security, and AI fallback resilience."*
- **Wrap-up**:
  > *"ResolveAI is production-ready, fully responsive, and built with security and reliability at every layer. Thank you!"*
