Here’s a **comprehensive list of all functional features** for your **administrative football league management system**, based entirely on your SRS, database design, and user roles. I’ve organized them by **actor/module**, making it clear who can do what and what the system must support.

---

# **A. User & Access Management**

### 1. Super Admin

- Create, modify, and delete **Organization Admin** accounts.
- Approve or reject organization requests submitted via the public page.
- Configure **system-wide parameters**: league types, season rules, match rules, default settings.
- View all **audit logs** of actions performed in the system.
- Assign roles and permissions to other admins.

### 2. Organization Admin

- Create **League Admin accounts** for their organization.
- Approve or reject **club registration requests**.
- Configure **league settings**: competition rules, branding, season dates.
- Assign **match event admins** and referees to their leagues.
- Monitor **organization-level reports** and analytics.

### 3. League Admin

- Manage **league-specific configurations**: fixtures, matches, referees.
- Edit **match events** after completion (goals, cards, substitutions, injuries).
- Assign referees to matches.
- Generate **round-robin schedules** for leagues.
- View **league standings** and season analytics.

### 4. Club Admin

- Register **players** and **staff** (coaches, medical, support) for their club.
- Submit **starting lineups** and squad lists for matches.
- View fixtures and match schedule for their club.
- Access only their **own club data**.

### 5. Match Event Admin

- Approve matches **one day before start**.
- Log **live match events** (goals, cards, substitutions, injuries, commentary) within 10 minutes of occurrence.
- After 10 minutes, only League Admins can edit logged events.

---

# **B. Organization & League Management**

- Create and manage **organizations**.
- Register **leagues** under organizations.
- Configure **league types**: Male, Female, Youth.
- Define **season dates** and number of participating clubs.
- Assign **League Admins** to manage specific leagues.
- Assign referees and match event admins to leagues.

---

# **C. Club & Player Management**

- Club registration:
  - Submit **club details** (name, stadium, description, jersey, officials).
  - Club portal creation upon approval.

- Player management:
  - Store **permanent player profile** across seasons and clubs.
  - Manage **season-club-player relations** (position, jersey number, status).
  - Track **player transfers** between clubs.

- Staff management:
  - Register **coaches** and assign them to clubs and seasons.

---

# **D. Match & Fixture Management**

- Generate **fixtures automatically** (round-robin).
- Allow **manual adjustments** for dates, venues, or broadcasting considerations.
- Assign referees to each match.
- Log **match events in real-time**:
  - Goals (free-kick, penalty, own goal, header, shoot)
  - Cards (yellow/red)
  - Substitutions
  - Injuries
  - Commentary

- Edit match events **within allowed time window** (10 minutes).
- Approve matches before they go live.

---

# **E. Season & Standings Management**

- Track **season progress** for each league.
- Compute **league tables/standings**:
  - Matches played
  - Wins, Draws, Losses
  - Goals For / Against
  - Goal Difference
  - Points

- Determine **season results**: champions, relegation, promotion.
- Support multiple **leagues per organization**, with multiple categories (male/female/youth).

---

# **F. Referee & Match Event Admin Management**

- Register referees (name, type, nationality, sex).
- Assign referees to leagues and matches.
- Track **season assignments** of match event admins.

---

# **G. Reporting & Analytics**

- Generate **match reports** immediately after completion.
- Update **team and player statistics** in real-time.
- Provide **season analytics**:
  - Player performance
  - Team performance
  - Awards calculation
  - Match statistics

---

# **H. Notifications & Alerts**

- Notify users about:
  - Match schedules
  - Live match events
  - Team or player updates

- Scope-based notifications:
  - Club Admin → club-specific
  - League Admin → league-specific

---

# **I. Public/Guest Functionalities**

- Public **landing pages**:
  - About system
  - Features
  - Contact information

- Public **organization request page**:
  - Submit new organization request (pending approval by Super Admin)

---

# **J. System & Data Integrity**

- Enforce **role-based access control** (RBAC).
- Ensure **data validation rules**:
  - Unique emails
  - Unique player registrations per season/club
  - Match events linked to valid matches and players

- Maintain **audit logs** of user actions.
- Restrict editing and deletion based on business rules (e.g., cannot delete parent entity if children exist).

---

# **K. Advanced Functional Features (Optional / Future)**

- Ratings system:
  - Rate **stadiums, clubs, players, coaches, referees, leagues**
  - Use in reporting or ranking

- Live updates (via Socket.IO)
- Historical statistics per season, club, player

jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj
JJJJJJJJJJJJJJJJJJJJJJJJJJ
JJJJJJJJJJJJJJJJJJJ
JJJJJJJJJJJJJJJJJJJJJJJJJJJ
JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ

Build a secure organization onboarding system with public pages and admin approval flow for this platform. The implementation must follow modern security best practices and maintain a clean, reusable architecture.

---

## 🔹 1. Public Pages (Before Login)

Modify the app so it no longer opens directly to login.

### Create a Landing Page (/)

This is the default entry point of the application.

Include:

- System introduction (what the platform does)
- Key features overview (league management, live match tracking, analytics, etc.)
- Clean, modern UI (dark blue theme consistent with dashboard)

Add clear Call-To-Actions:

- “Login” → redirects to /login
- “Request Organization” → redirects to /request-organization

---

### Create Organization Request Page (/request-organization)

Build a public form with the following fields:

- Organization Name
- Country
- City
- Description
- Applicant Full Name
- Email
- Phone

### On Submit:

System must:

1. Create a new Organization:
   - status = "pending"

2. Create a new User:
   - status = "inactive"
   - passwordHash = null (no password yet)

3. Store applicant info and link the user to the organization

4. Do NOT allow login for this user yet

---

## 🔹 2. Secure Organization Approval Flow (Core Logic)

When a Super Admin approves an organization, implement the following secure onboarding process:

### System Actions:

1. Update:
   - Organization → status = "approved"
   - User → status = "active"

2. Generate a secure random token:
   - Use cryptographically secure method (e.g., crypto.randomBytes)
   - Token must be long and unpredictable

3. Store in database:
   - passwordResetToken
   - passwordResetExpires (1 hour expiry)

4. Send email to the user containing:

A secure link:

/set-password?token=YOUR_SECURE_TOKEN

---

## 🔹 3. Password Setup Flow

Create page: /set-password

### Behavior:

- Extract token from URL
- Show form:
  - New Password
  - Confirm Password

### On Submit:

Backend must:

1. Validate token:
   - Exists
   - Not expired

2. If valid:
   - Hash new password using bcrypt
   - Save as passwordHash
   - Clear:
     - passwordResetToken
     - passwordResetExpires

3. Allow user to login normally after this

---

## 🔹 4. Login Security Rules

When user attempts login:

- Check:
  - If status !== "active" → deny access
  - Return error:
    "Your account is not active. Please wait for approval."

---

## 🔹 5. UI Behavior for Super Admin

After login:

Super Admin can:

### Full Access:

- Organizations:
  - View pending requests
  - Approve / Reject

- Users:
  - Create
  - Edit
  - Assign roles

### View-Only Pages:

- Clubs
- Players
- Coaches
- Referees
- Seasons
- Matches
- Notifications

### IMPORTANT:

- Remove all “Add” buttons from view-only pages
- No create/edit actions outside Users and Organizations

---

## 🔹 6. Organization Approval UI

On Organizations page:

- Show two sections:
  - Pending Requests
  - Approved Organizations

Each pending item must have:

- View details
- Approve button
- Reject button

---

## 🔹 7. Email Requirements

Send email after approval:

- Subject: “Organization Approved”
- Include:
  - Welcome message
  - Secure password setup link
  - Expiration notice (1 hour)

---

## 🔹 8. Architecture Requirements

- Use reusable components (forms, cards, tables)
- Maintain consistent dark theme UI
- Separate concerns:
  - API layer
  - Service logic
  - UI components

- Ensure clean folder structure

---

Then:

- Implement all features step by step

---

Final Goal

This system must behave like a modern SaaS onboarding flow, where:

Users never receive passwords via email
Accounts are activated securely
Access is strictly controlled
UI is clean, consistent, and role-aware
