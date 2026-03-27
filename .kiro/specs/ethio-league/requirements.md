# Requirements Document

## Introduction

Ethio League is an administrative football league management platform built with Next.js and Prisma ORM. The system supports role-based access control across five admin roles (Super Admin, Organization Admin, League Admin, Club Admin, Match Event Admin) plus a public-facing section.

A significant portion of the system has already been implemented:

**Already implemented:**
- Database schema (Prisma) with all models: User, Organization, Club, Stadium, Player, Coach, Referee, Season, Match, MatchEvent, MatchReferee, MatchLineup, SeasonClub, SeasonClubPlayer, SeasonClubCoach, RefereeLeague, UserRoleScope, Notification, AuditLog
- Public pages: Landing page, Login page, Organization Request page, Set Password page
- Auth API: login, set-password, refresh-token, validate-token
- Organization API: request, approve/reject, CRUD
- Dashboard layout with sidebar, topbar, auth context, org context
- Dashboard overview pages (Super Admin and Org Admin views with mock data)
- Leagues page (UI + API): list, create with first season + league admin, add seasons, assign officials
- Clubs page (UI + API): list, approve/reject pending clubs
- Users page (UI + API): list, create Match Event Admins (Org Admin), full user management (Super Admin)
- Seasons page (UI): list view with mock data
- Matches page (UI): list view with mock data
- Players page (UI): list view with mock data
- Coaches page (UI): list view with mock data
- Referees page (UI + API): full CRUD for Org Admin
- Notifications page (UI + API): list, mark as read, send
- Match Events API: log events, edit events, list by match
- Fixtures API: round-robin generation
- Season assignments API: assign referees and MEAs to seasons

**Not yet implemented (scope of this spec):**
- Email sending (password setup links are returned in API responses but not emailed)
- Club creation workflow (League Admin creates club + Club Admin account)
- Club Admin dashboard and all Club Admin features
- League Admin dashboard and scoped views
- Match Event Admin dashboard and live event logging UI
- Lineup submission UI and API wiring
- Match approval workflow (MEA approves 1 day before)
- Match detail / live event logging UI
- Standings and analytics pages
- Profile management page
- Audit log page (Super Admin)
- System configuration page (Super Admin)
- Season player assignment (League Admin assigns players to season)
- Real API wiring for several pages that currently use mock data only
- Scope enforcement on several API routes (org/league/club/season scoping)

---

## Glossary

- **System**: The Ethio League platform as a whole
- **Super_Admin**: Platform-level administrator with full access to all data
- **Organization_Admin**: Administrator scoped to a single organization
- **League_Admin**: Administrator scoped to a single league season
- **Club_Admin**: Administrator scoped to a single club
- **Match_Event_Admin (MEA)**: Administrator scoped to assigned seasons, responsible for match approval and live event logging
- **Organization**: A football federation or association that owns leagues
- **League**: A named competition (e.g., Ethiopian Premier League) that has one or more seasons
- **Season**: A time-bounded instance of a league (e.g., 2025/26 Season)
- **Club**: A football club that participates in seasons
- **SeasonClub**: The participation record linking a club to a season
- **SeasonClubPlayer**: The record linking a player to a club's season participation
- **MatchEvent**: A recorded in-game event (goal, card, substitution, injury, commentary)
- **MatchLineup**: The submitted starting lineup and substitutes for a match
- **RefereeLeague**: The assignment record linking a referee to a season
- **UserRoleScope**: The record linking a user to a role with optional org/season/club scope
- **Password_Setup_Link**: A time-limited URL containing a secure token for first-time password creation
- **Fixture**: A scheduled match between two clubs in a season
- **Standing**: The computed league table showing club rankings by points, goal difference, etc.

---

## Requirements

### Requirement 1: Email Delivery for Password Setup

**User Story:** As a new user, I want to receive a password setup email when my account is created, so that I can securely set my password without the link being exposed in API responses.

#### Acceptance Criteria

1. WHEN an organization request is approved, THE System SHALL send a password setup email to the applicant's email address containing the Password_Setup_Link.
2. WHEN a League Admin account is created by an Organization_Admin, THE System SHALL send a password setup email to the new League Admin's email address.
3. WHEN a Match Event Admin account is created, THE System SHALL send a password setup email to the new MEA's email address.
4. WHEN a Club Admin account is created by a League Admin, THE System SHALL send a password setup email to the new Club Admin's email address.
5. THE System SHALL NOT return the raw password setup token in API responses in production environments.
6. WHEN a password setup token expires without being used, THE System SHALL allow authorized admins to regenerate and resend the password setup email.
7. IF the email delivery fails, THEN THE System SHALL log the failure and surface an error to the initiating admin.

---

### Requirement 2: Club Creation Workflow (League Admin)

**User Story:** As a League Admin, I want to create clubs with an associated Club Admin account, so that clubs can be registered and their admins can fill in details for Org Admin approval.

#### Acceptance Criteria

1. WHEN a League Admin submits a club creation request with club name, admin full name, admin email, and admin phone, THE System SHALL create a Club record with status "pending", create a Club Admin user account with status "inactive", and assign the Club Admin role scoped to the new club.
2. WHEN the club and Club Admin are created, THE System SHALL send a password setup email to the Club Admin's email address.
3. THE System SHALL enforce that only League Admins (scoped to the relevant season) and Super Admins can create clubs via this workflow.
4. WHEN a club is created via this workflow, THE System SHALL associate the club with the League Admin's assigned season as a pending SeasonClub record.
5. IF a user with the provided admin email already exists, THEN THE System SHALL return a descriptive error and SHALL NOT create a duplicate user.

---

### Requirement 3: Club Admin Dashboard and Club Profile Management

**User Story:** As a Club Admin, I want a dedicated dashboard showing my club's overview, so that I can manage my club's profile, players, coaches, and match information.

#### Acceptance Criteria

1. WHEN a Club Admin logs in, THE System SHALL display a dashboard scoped to the Club Admin's assigned club showing: club profile summary, player count, coach count, upcoming fixtures, and recent results.
2. THE Club_Admin SHALL be able to edit the club's name, logo URL, stadium details, description, and contact information.
3. WHEN a Club Admin edits club profile fields, THE System SHALL validate that required fields (name) are not empty before saving.
4. THE System SHALL enforce that Club Admins can only view and edit data belonging to their assigned club.
5. WHILE a club's status is "pending", THE Club_Admin SHALL be able to view and edit the club profile but SHALL NOT be able to submit lineups.

---

### Requirement 4: Player Management (Club Admin)

**User Story:** As a Club Admin, I want to create and manage players for my club, so that players have permanent identity records that can be assigned to seasons.

#### Acceptance Criteria

1. WHEN a Club Admin creates a player with first name, last name, date of birth, nationality, gender, position, height, and weight, THE System SHALL create a permanent Player record associated with the Club Admin's club.
2. THE Club_Admin SHALL be able to edit player details including name, date of birth, nationality, position, height, weight, and preferred foot.
3. THE Club_Admin SHALL be able to view all players belonging to their club.
4. THE System SHALL enforce that Club Admins can only create and edit players belonging to their assigned club.
5. WHEN a player is created, THE System SHALL set the player's status to "active" by default.
6. IF a Club Admin attempts to create a player with a duplicate name and date of birth within the same club, THEN THE System SHALL warn the admin of a potential duplicate before saving.

---

### Requirement 5: Coach and Staff Management (Club Admin)

**User Story:** As a Club Admin, I want to create and manage coaching staff for my club, so that coaching records are maintained as permanent identities.

#### Acceptance Criteria

1. WHEN a Club Admin creates a coach with first name, last name, date of birth, nationality, license level, and coaching role, THE System SHALL create a permanent Coach record.
2. THE Club_Admin SHALL be able to assign coaching roles: head_coach, assistant_coach, goalkeeping_coach, fitness_coach, or medical_staff.
3. THE Club_Admin SHALL be able to edit and deactivate coach records belonging to their club.
4. THE System SHALL enforce that Club Admins can only manage coaches belonging to their assigned club.

---

### Requirement 6: Season Player Assignment (League Admin)

**User Story:** As a League Admin, I want to assign players from approved clubs to the current season, so that only season-registered players are eligible for lineups and match events.

#### Acceptance Criteria

1. WHEN a League Admin assigns a player to a season, THE System SHALL create a SeasonClubPlayer record linking the player to the club's SeasonClub entry with a jersey number and position.
2. THE League_Admin SHALL be able to view all players from all clubs participating in their assigned season.
3. THE League_Admin SHALL be able to assign and remove players from a season's club roster.
4. THE System SHALL enforce that only players belonging to an approved club in the season can be assigned to that season.
5. IF a player is already assigned to the same season via another club, THEN THE System SHALL return an error preventing duplicate season registration.

---

### Requirement 7: Fixture Generation and Match Management (League Admin)

**User Story:** As a League Admin, I want to generate round-robin fixtures and manage match details for my season, so that all clubs play each other in a structured schedule.

#### Acceptance Criteria

1. WHEN a League Admin triggers fixture generation for a season, THE System SHALL generate a double round-robin schedule using only clubs with SeasonClub status "active", assigning home and away roles alternately across rounds.
2. WHEN fixtures are generated, THE System SHALL space matches approximately 7 days apart starting from the season's start date.
3. THE League_Admin SHALL be able to assign officials to each match: 1 main referee, 2 assistant referees, 1 fourth official, and 1 MEA, selecting only from officials assigned to the season.
4. THE League_Admin SHALL be able to edit match date, time, and stadium for any fixture in their assigned season.
5. IF fixtures already exist for a season, THEN THE System SHALL require the League Admin to confirm deletion of existing fixtures before regenerating.
6. THE League_Admin SHALL be able to edit match events (goals, cards, substitutions, injuries, commentary) for completed matches regardless of the 10-minute editing window that applies to MEAs.
7. THE System SHALL enforce that League Admins can only manage fixtures and matches within their assigned season.

---

### Requirement 8: Match Approval (Match Event Admin)

**User Story:** As a Match Event Admin, I want to approve matches before they start, so that only properly prepared matches proceed to live status.

#### Acceptance Criteria

1. WHEN a Match Event Admin views their assigned matches, THE System SHALL display only matches belonging to seasons the MEA is assigned to.
2. WHEN a Match Event Admin approves a match, THE System SHALL require that the match's scheduled date is within 24 hours of the current time.
3. WHEN a match is approved by a MEA, THE System SHALL update the match status to "approved" and record the approving MEA's identity.
4. IF a MEA attempts to approve a match more than 24 hours before its scheduled start time, THEN THE System SHALL reject the approval with a descriptive error message.
5. THE System SHALL enforce that MEAs can only approve matches in their assigned seasons.

---

### Requirement 9: Live Match Event Logging (Match Event Admin)

**User Story:** As a Match Event Admin, I want to log match events in real time during a live match, so that goals, cards, substitutions, and other events are recorded accurately.

#### Acceptance Criteria

1. WHEN a match status is "live", THE Match_Event_Admin SHALL be able to log events of types: goal, own_goal, penalty_goal, yellow_card, red_card, substitution, injury, and commentary.
2. WHEN logging an event, THE System SHALL require: match ID, event type, player, club, and minute; and SHALL accept optional fields: related player, extra time, and description.
3. WHEN a goal event is logged, THE System SHALL automatically increment the scoring club's score on the match record.
4. WHEN a MEA edits an event, THE System SHALL enforce that the edit occurs within 10 minutes of the event's creation timestamp.
5. IF a MEA attempts to edit an event after the 10-minute window, THEN THE System SHALL reject the edit with a message indicating that only a League Admin can edit the event.
6. THE System SHALL enforce that MEAs can only log events for matches in their assigned seasons.
7. WHEN a substitution event is logged, THE System SHALL require both the outgoing player and the incoming player to be specified.

---

### Requirement 10: Lineup Submission (Club Admin)

**User Story:** As a Club Admin, I want to submit a lineup for an upcoming match, so that my club's starting players, substitutes, and captain are officially registered before the match.

#### Acceptance Criteria

1. WHEN a Club Admin submits a lineup for a match, THE System SHALL require: a list of starting players (11), a list of substitute players, a designated captain, and position assignments for starting players.
2. THE System SHALL validate that all submitted players are registered in the SeasonClubPlayer table for the club's current season participation.
3. THE System SHALL validate that no player appears in both the starting lineup and the substitute list.
4. THE System SHALL validate that exactly one player is designated as captain.
5. IF a Club Admin submits a lineup for a match where the club is not a participant, THEN THE System SHALL reject the submission with a descriptive error.
6. WHEN a lineup is successfully submitted, THE System SHALL store a MatchLineup record for each player and notify the League Admin.
7. THE System SHALL enforce that Club Admins can only submit lineups for matches involving their assigned club.

---

### Requirement 11: Standings and Analytics (League Admin)

**User Story:** As a League Admin, I want to view live standings and season analytics for my league, so that I can monitor team performance and generate reports.

#### Acceptance Criteria

1. WHEN a League Admin views standings for a season, THE System SHALL compute and display: club name, matches played, wins, draws, losses, goals for, goals against, goal difference, and total points, sorted by points descending then goal difference descending.
2. WHEN match results are updated, THE System SHALL recompute standings automatically.
3. THE League_Admin SHALL be able to view top scorers for a season, showing player name, club, and goal count, sorted by goals descending.
4. THE League_Admin SHALL be able to view discipline statistics showing yellow cards, red cards, and suspensions per player and per club.
5. THE League_Admin SHALL be able to view a season summary including total matches played, total goals, average goals per match, and top-performing clubs.
6. THE System SHALL enforce that League Admins can only view analytics for their assigned season.

---

### Requirement 12: Profile Management

**User Story:** As an authenticated user, I want to view and update my account profile, so that my contact information and password are kept current.

#### Acceptance Criteria

1. WHEN any authenticated user navigates to their profile page, THE System SHALL display their full name, email address, phone number, role(s), and scope information (organization, season, or club as applicable).
2. THE System SHALL allow authenticated users to update their full name and phone number.
3. WHEN a user submits a password change, THE System SHALL require the current password, a new password, and a confirmation of the new password.
4. THE System SHALL validate that the new password is at least 8 characters long.
5. IF the current password provided does not match the stored hash, THEN THE System SHALL reject the password change with an error message.
6. THE System SHALL NOT display or return the user's password hash in any API response.

---

### Requirement 13: Audit Log (Super Admin)

**User Story:** As a Super Admin, I want to view a complete audit trail of system actions, so that I can investigate issues and ensure compliance.

#### Acceptance Criteria

1. THE System SHALL record an audit log entry for each of the following actions: login attempt (success and failure), organization request submission, organization approval/rejection, user creation, role assignment, club approval/rejection, league creation, season creation, fixture generation, match event creation, match event editing, lineup submission, and profile update.
2. WHEN an audit log entry is created, THE System SHALL record: the acting user's ID and name, the action type, the affected record's ID and type, the timestamp, and a human-readable description.
3. WHEN a Super Admin views the audit log, THE System SHALL display entries with filtering by action type, date range, and acting user.
4. THE System SHALL enforce that only Super Admins can access the audit log page.
5. THE System SHALL NOT allow audit log entries to be deleted or modified by any user.

---

### Requirement 14: System Configuration (Super Admin)

**User Story:** As a Super Admin, I want to manage system-wide configuration such as league types, event types, and player positions, so that the platform's reference data is kept accurate.

#### Acceptance Criteria

1. THE Super_Admin SHALL be able to view, create, and edit LeagueType records (e.g., round_robin, knockout, hybrid).
2. THE Super_Admin SHALL be able to view, create, and edit EventType records (e.g., goal, yellow_card, substitution).
3. THE Super_Admin SHALL be able to view, create, and edit Position records (e.g., GK, CB, ST) with code and name.
4. THE System SHALL enforce that only Super Admins can access the system configuration page.
5. IF a Super Admin attempts to delete a LeagueType, EventType, or Position that is referenced by existing records, THEN THE System SHALL prevent deletion and display a descriptive error.

---

### Requirement 15: API Scope Enforcement

**User Story:** As a system operator, I want all API routes to enforce role-based scope rules, so that users can only access and modify data within their authorized scope.

#### Acceptance Criteria

1. WHEN an Organization Admin calls any API endpoint, THE System SHALL restrict returned data to records belonging to the Organization Admin's assigned organization.
2. WHEN a League Admin calls any API endpoint, THE System SHALL restrict returned data to records belonging to the League Admin's assigned season.
3. WHEN a Club Admin calls any API endpoint, THE System SHALL restrict returned data to records belonging to the Club Admin's assigned club.
4. WHEN a Match Event Admin calls any API endpoint, THE System SHALL restrict returned data to matches and events in the MEA's assigned seasons.
5. IF a user attempts to access or modify a record outside their authorized scope, THEN THE System SHALL return a 403 Forbidden response.
6. THE System SHALL enforce scope rules on all write operations (POST, PATCH, DELETE) in addition to read operations (GET).

---

### Requirement 16: Real API Wiring for Dashboard Pages

**User Story:** As a developer, I want all dashboard pages to fetch live data from the API instead of using mock data, so that the UI reflects the actual database state.

#### Acceptance Criteria

1. THE Seasons page SHALL fetch season data from `/api/seasons` and SHALL support create, edit, and delete operations wired to the API.
2. THE Matches page SHALL fetch match data from `/api/matches` and SHALL support match status transitions wired to the API.
3. THE Players page SHALL fetch player data from `/api/players` and SHALL support create, edit, and delete operations wired to the API for Club Admins.
4. THE Coaches page SHALL fetch coach data from `/api/coaches` and SHALL support create, edit, and delete operations wired to the API for Club Admins.
5. THE Organizations page SHALL fetch organization data from `/api/organizations` and SHALL support approve/reject operations wired to the API for Super Admins.
6. WHEN any dashboard page fails to fetch data from the API, THE System SHALL display a user-friendly error state rather than silently falling back to stale mock data.

---

### Requirement 17: Organizations Page (Super Admin)

**User Story:** As a Super Admin, I want to view and manage all organization requests and approved organizations, so that I can control which organizations are active on the platform.

#### Acceptance Criteria

1. WHEN a Super Admin views the organizations page, THE System SHALL display all organizations with their name, country, city, status, and creation date.
2. THE Super_Admin SHALL be able to filter organizations by status (pending, approved, rejected, active, inactive).
3. WHEN a Super Admin approves an organization, THE System SHALL update the organization status to "approved", activate the associated user, generate a password setup token, and trigger a password setup email.
4. WHEN a Super Admin rejects an organization, THE System SHALL update the organization status to "rejected" and deactivate the associated user.
5. THE Super_Admin SHALL be able to view the applicant details (name, email, phone) for any pending organization request.
6. THE System SHALL enforce that only Super Admins can approve or reject organization requests.

---

### Requirement 19: User Management Edit Hierarchy

**User Story:** As an admin, I want to edit user information within my authorized scope, so that user data is managed with proper access control at each level of the hierarchy.

#### Acceptance Criteria

1. WHEN a Super Admin edits a user, THE System SHALL restrict editable targets to users with the `organization_admin` role only. Super Admins SHALL NOT edit league_admin, club_admin, match_event_admin, or other super_admin users.
2. WHEN an Organization Admin edits a user, THE System SHALL restrict editable targets to users with the `league_admin` or `match_event_admin` role that are scoped to the Organization Admin's organization only.
3. WHEN a League Admin edits a user, THE System SHALL restrict editable targets to users with the `club_admin` role whose assigned club belongs to a season in the League Admin's league only.
4. ANY authenticated user SHALL be able to edit their own `fullName` and `phone` fields via their profile page.
5. Super Admins and Organization Admins SHALL additionally be able to update the `status` field of users within their editable scope.
6. IF a caller attempts to edit a user outside their authorized scope, THE System SHALL return a 403 Forbidden response.
7. THE System SHALL NOT allow any admin to edit another admin of equal or higher privilege level.

---

### Requirement 20: User Activation on Password Setup

**User Story:** As a newly created user, I want my account to become active automatically when I set my password, so that I can log in immediately after completing the setup flow without requiring manual activation by an admin.

#### Acceptance Criteria

1. WHEN a user successfully sets their password via the `/api/auth/set-password` endpoint using a valid token, THE System SHALL update the user's `status` from `inactive` to `active` in the same database transaction.
2. WHEN the password is set and the user is activated, THE System SHALL clear the `passwordResetToken` and `passwordResetExpires` fields.
3. AFTER activation, THE System SHALL allow the user to log in immediately with their new password.
4. IF the token is expired or invalid, THE System SHALL NOT activate the user and SHALL return a descriptive error.

---

### Requirement 21: Organization-Scoped User Listing

**User Story:** As an Organization Admin, I want to see only the users associated with my organization, so that I have a clear view of my team without seeing unrelated users from other organizations.

#### Acceptance Criteria

1. WHEN an Organization Admin calls `GET /api/users`, THE System SHALL return only users who have at least one `UserRoleScope` record with `organizationId` matching the Organization Admin's organization.
2. WHEN a Super Admin calls `GET /api/users`, THE System SHALL return all users across all organizations.
3. THE System SHALL enforce that Organization Admins cannot access user records from other organizations via the users API.

**User Story:** As a user, I want to receive in-app notifications for relevant system events, so that I am informed of actions that require my attention or affect my work.

#### Acceptance Criteria

1. WHEN an organization request is submitted, THE System SHALL create a notification for all Super Admins.
2. WHEN an organization is approved or rejected, THE System SHALL create a notification for the Organization Admin of that organization.
3. WHEN a club registration is submitted, THE System SHALL create a notification for the Organization Admin of the relevant organization.
4. WHEN a club is approved or rejected, THE System SHALL create a notification for the Club Admin of that club.
5. WHEN a lineup is submitted by a Club Admin, THE System SHALL create a notification for the League Admin of the relevant season.
6. WHEN a match event is logged, THE System SHALL create a notification for the League Admin of the relevant season.
7. WHEN a user views a notification, THE System SHALL mark it as read and update the unread count in the topbar.
8. THE System SHALL enforce that users can only view notifications addressed to their own user account.

### Requirement 18: Notification Triggers

**User Story:** As a user, I want to receive in-app notifications for relevant system events, so that I am informed of actions that require my attention or affect my work.

#### Acceptance Criteria

1. WHEN an organization request is submitted, THE System SHALL create a notification for all Super Admins.
2. WHEN an organization is approved or rejected, THE System SHALL create a notification for the Organization Admin of that organization.
3. WHEN a club registration is submitted, THE System SHALL create a notification for the Organization Admin of the relevant organization.
4. WHEN a club is approved or rejected, THE System SHALL create a notification for the Club Admin of that club.
5. WHEN a lineup is submitted by a Club Admin, THE System SHALL create a notification for the League Admin of the relevant season.
6. WHEN a match event is logged, THE System SHALL create a notification for the League Admin of the relevant season.
7. WHEN a user views a notification, THE System SHALL mark it as read and update the unread count in the topbar.
8. THE System SHALL enforce that users can only view notifications addressed to their own user account.
