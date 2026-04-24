# Requirements Document

## Introduction

This feature adds media upload capabilities to the Ethiopian Football League Management System. Users can upload images and short video highlights for various entities — user profiles, organizations, leagues, clubs, stadiums, players, coaches, and matches. All media is stored on Cloudinary via unsigned client-side uploads using entity-specific upload presets. After a successful upload, the client sends the resulting Cloudinary public URL to the server API, which persists it to the database. When an entity is deleted, the system calls the Cloudinary Destroy API to remove associated media.

## Glossary

- **Media_Upload_Client**: The browser-side component that initiates uploads directly to Cloudinary using `next-cloudinary`.
- **Upload_Preset**: A Cloudinary unsigned upload preset scoped to a specific entity type (e.g., `user_profile`, `club_logo`, `match_media`).
- **Cloudinary_URL**: The public URL returned by Cloudinary after a successful upload, stored in the database.
- **Media_API**: The Next.js API route that receives a Cloudinary_URL from the client and persists it to the database.
- **Cloudinary_Destroy_API**: The Cloudinary server-side API used to delete a media asset by its public ID.
- **PlayerImage**: A supplementary image record linked to a Player beyond the primary `photoUrl`.
- **CoachImage**: A supplementary image record linked to a Coach beyond the primary `photoUrl`.
- **StadiumImage**: An image record in the stadium gallery linked to a Stadium.
- **MatchMedia**: A media record (image or short video) linked to a Match.
- **ClubImage**: A supplementary image record linked to a Club beyond the primary `logoUrl`.
- **Gallery**: An ordered collection of ClubImage, StadiumImage, or MatchMedia records for a given entity.

---

## Requirements

### Requirement 1: User Profile Photo Upload

**User Story:** As a user, I want to upload a profile photo, so that my account has a recognizable avatar across the system.

#### Acceptance Criteria

1. WHEN a user submits a valid image file via the profile photo upload widget, THE Media_Upload_Client SHALL upload the file directly to Cloudinary using the `user_profile` Upload_Preset.
2. WHEN Cloudinary returns a successful response, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `PATCH /api/users/me`.
3. WHEN the Media_API receives a valid Cloudinary_URL, THE Media_API SHALL persist the URL to the `photoUrl` field on the `User` record.
4. IF the Cloudinary upload fails, THEN THE Media_Upload_Client SHALL display an error message and SHALL NOT call the Media_API.
5. IF the Media_API receives a URL that does not begin with `https://res.cloudinary.com/`, THEN THE Media_API SHALL return a 400 error with a descriptive message.
6. THE Media_Upload_Client SHALL accept only files with MIME types `image/jpeg`, `image/png`, or `image/webp`.
7. THE Media_Upload_Client SHALL reject files larger than 5 MB before initiating the Cloudinary upload.

---

### Requirement 2: Organization Logo Upload

**User Story:** As an organization admin, I want to upload a logo for my organization, so that the organization is visually identifiable in the system.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid image file for an organization, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `org_logo` Upload_Preset.
2. WHEN Cloudinary returns a successful response, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `PATCH /api/organizations/[id]`.
3. WHEN the Media_API receives a valid Cloudinary_URL, THE Media_API SHALL persist the URL to the `logoUrl` field on the `Organization` record.
4. IF the Cloudinary upload fails, THEN THE Media_Upload_Client SHALL display an error message and SHALL NOT call the Media_API.
5. IF the Media_API receives a URL that does not begin with `https://res.cloudinary.com/`, THEN THE Media_API SHALL return a 400 error with a descriptive message.
6. THE Media_Upload_Client SHALL accept only files with MIME types `image/jpeg`, `image/png`, or `image/webp`.
7. THE Media_Upload_Client SHALL reject files larger than 5 MB before initiating the Cloudinary upload.

---

### Requirement 3: League Logo Upload

**User Story:** As a league admin, I want to upload a logo for my league, so that the league is visually identifiable in fixtures and standings.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid image file for a league, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `league_logo` Upload_Preset.
2. WHEN Cloudinary returns a successful response, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `PATCH /api/leagues/[id]`.
3. WHEN the Media_API receives a valid Cloudinary_URL, THE Media_API SHALL persist the URL to the `logoUrl` field on the `League` record.
4. IF the Cloudinary upload fails, THEN THE Media_Upload_Client SHALL display an error message and SHALL NOT call the Media_API.
5. IF the Media_API receives a URL that does not begin with `https://res.cloudinary.com/`, THEN THE Media_API SHALL return a 400 error with a descriptive message.
6. THE Media_Upload_Client SHALL accept only files with MIME types `image/jpeg`, `image/png`, or `image/webp`.
7. THE Media_Upload_Client SHALL reject files larger than 5 MB before initiating the Cloudinary upload.

---

### Requirement 4: Club Logo Upload

**User Story:** As a club admin, I want to upload a logo for my club, so that the club is visually identifiable in the league table and match cards.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid image file for a club, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `club_logo` Upload_Preset.
2. WHEN Cloudinary returns a successful response, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `PATCH /api/clubs/[id]`.
3. WHEN the Media_API receives a valid Cloudinary_URL, THE Media_API SHALL persist the URL to the `logoUrl` field on the `Club` record.
4. IF the Cloudinary upload fails, THEN THE Media_Upload_Client SHALL display an error message and SHALL NOT call the Media_API.
5. IF the Media_API receives a URL that does not begin with `https://res.cloudinary.com/`, THEN THE Media_API SHALL return a 400 error with a descriptive message.
6. THE Media_Upload_Client SHALL accept only files with MIME types `image/jpeg`, `image/png`, or `image/webp`.
7. THE Media_Upload_Client SHALL reject files larger than 5 MB before initiating the Cloudinary upload.

---

### Requirement 4b: Club Photo Gallery

**User Story:** As a club admin, I want to upload up to 5 photos for my club, so that the club detail page has rich visual content beyond just the logo.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid image file for a club gallery, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `club_gallery` Upload_Preset.
2. WHEN Cloudinary returns a successful response, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `POST /api/clubs/[id]/images`.
3. WHEN the Media_API receives a valid Cloudinary_URL, THE Media_API SHALL create a new `ClubImage` record linked to the club with the provided URL and a `sortOrder` value.
4. THE Media_API SHALL allow a maximum of 5 ClubImage records per club; IF a request would exceed this limit, THEN THE Media_API SHALL return a 422 error.
5. WHEN an authorized user requests deletion of a ClubImage, THE Media_API SHALL call the Cloudinary_Destroy_API to remove the asset and SHALL delete the `ClubImage` record from the database.
6. THE Media_Upload_Client SHALL accept only files with MIME types `image/jpeg`, `image/png`, or `image/webp`.
7. THE Media_Upload_Client SHALL reject files larger than 5 MB before initiating the Cloudinary upload.
8. WHEN a Club record is deleted, THE Media_API SHALL call the Cloudinary_Destroy_API for each associated ClubImage before deleting the Club record.

---

### Requirement 5: Stadium Image Gallery

**User Story:** As a league or club admin, I want to upload multiple images for a stadium, so that users can view the venue's appearance.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid image file for a stadium, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `stadium_gallery` Upload_Preset.
2. WHEN Cloudinary returns a successful response, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `POST /api/stadiums/[id]/images`.
3. WHEN the Media_API receives a valid Cloudinary_URL, THE Media_API SHALL create a new `StadiumImage` record linked to the stadium with the provided URL and a `sortOrder` value.
4. THE Media_API SHALL allow a maximum of 20 StadiumImage records per stadium; IF a request would exceed this limit, THEN THE Media_API SHALL return a 422 error.
5. WHEN an authorized user requests deletion of a StadiumImage, THE Media_API SHALL call the Cloudinary_Destroy_API to remove the asset and SHALL delete the `StadiumImage` record from the database.
6. THE Media_Upload_Client SHALL accept only files with MIME types `image/jpeg`, `image/png`, or `image/webp`.
7. THE Media_Upload_Client SHALL reject files larger than 5 MB before initiating the Cloudinary upload.
8. WHEN a Stadium record is deleted, THE Media_API SHALL call the Cloudinary_Destroy_API for each associated StadiumImage before deleting the Stadium record.

---

### Requirement 6: Player Media (Main Photo + Additional Images)

**User Story:** As a club admin, I want to upload a main profile photo and up to 3 additional images for a player, so that the player detail page has rich visual content.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid image file as the main photo for a player, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `player_photo` Upload_Preset.
2. WHEN Cloudinary returns a successful response for the main photo, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `PATCH /api/players/[id]` to update the `photoUrl` field.
3. WHEN an authorized user submits a valid image file as an additional player image, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `player_photo` Upload_Preset.
4. WHEN Cloudinary returns a successful response for an additional image, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `POST /api/players/[id]/images`.
5. WHEN the Media_API receives a valid Cloudinary_URL at `POST /api/players/[id]/images`, THE Media_API SHALL create a new `PlayerImage` record linked to the player.
6. THE Media_API SHALL allow a maximum of 3 PlayerImage records per player; IF a request would exceed this limit, THEN THE Media_API SHALL return a 422 error.
7. WHEN an authorized user requests deletion of a PlayerImage, THE Media_API SHALL call the Cloudinary_Destroy_API to remove the asset and SHALL delete the `PlayerImage` record from the database.
8. THE Media_Upload_Client SHALL accept only files with MIME types `image/jpeg`, `image/png`, or `image/webp`.
9. THE Media_Upload_Client SHALL reject files larger than 5 MB before initiating the Cloudinary upload.
10. WHEN a Player record is deleted, THE Media_API SHALL call the Cloudinary_Destroy_API for each associated PlayerImage before deleting the Player record.

---

### Requirement 7: Coach Media (Main Photo + Additional Images)

**User Story:** As a club admin, I want to upload a main profile photo and up to 3 additional images for a coach, so that the coach detail page has rich visual content.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid image file as the main photo for a coach, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `coach_photo` Upload_Preset.
2. WHEN Cloudinary returns a successful response for the main photo, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `PATCH /api/coaches/[id]` to update the `photoUrl` field.
3. WHEN an authorized user submits a valid image file as an additional coach image, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `coach_photo` Upload_Preset.
4. WHEN Cloudinary returns a successful response for an additional image, THE Media_Upload_Client SHALL send the Cloudinary_URL to the Media_API endpoint `POST /api/coaches/[id]/images`.
5. WHEN the Media_API receives a valid Cloudinary_URL at `POST /api/coaches/[id]/images`, THE Media_API SHALL create a new `CoachImage` record linked to the coach.
6. THE Media_API SHALL allow a maximum of 3 CoachImage records per coach; IF a request would exceed this limit, THEN THE Media_API SHALL return a 422 error.
7. WHEN an authorized user requests deletion of a CoachImage, THE Media_API SHALL call the Cloudinary_Destroy_API to remove the asset and SHALL delete the `CoachImage` record from the database.
8. THE Media_Upload_Client SHALL accept only files with MIME types `image/jpeg`, `image/png`, or `image/webp`.
9. THE Media_Upload_Client SHALL reject files larger than 5 MB before initiating the Cloudinary upload.
10. WHEN a Coach record is deleted, THE Media_API SHALL call the Cloudinary_Destroy_API for each associated CoachImage before deleting the Coach record.

---

### Requirement 8: Match Media (Images + Video Highlights)

**User Story:** As a match event admin, I want to upload images and short video highlights for a match, so that fans can view post-match media on the match detail page.

#### Acceptance Criteria

1. WHEN an authorized user submits a valid image file for a match, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `match_media` Upload_Preset.
2. WHEN an authorized user submits a valid video file for a match, THE Media_Upload_Client SHALL upload the file to Cloudinary using the `match_media` Upload_Preset.
3. WHEN Cloudinary returns a successful response, THE Media_Upload_Client SHALL send the Cloudinary_URL and media type (`image` or `video`) to the Media_API endpoint `POST /api/matches/[id]/media`.
4. WHEN the Media_API receives a valid Cloudinary_URL, THE Media_API SHALL create a new `MatchMedia` record linked to the match with the provided URL, media type, and a `sortOrder` value.
5. THE Media_API SHALL allow a maximum of 20 MatchMedia records per match; IF a request would exceed this limit, THEN THE Media_API SHALL return a 422 error.
6. WHEN an authorized user requests deletion of a MatchMedia record, THE Media_API SHALL call the Cloudinary_Destroy_API to remove the asset and SHALL delete the `MatchMedia` record from the database.
7. THE Media_Upload_Client SHALL accept image files with MIME types `image/jpeg`, `image/png`, or `image/webp`.
8. THE Media_Upload_Client SHALL accept video files with MIME type `video/mp4` only.
9. THE Media_Upload_Client SHALL reject image files larger than 5 MB before initiating the Cloudinary upload.
10. THE Media_Upload_Client SHALL reject video files larger than 100 MB before initiating the Cloudinary upload.
11. WHEN a Match record is deleted, THE Media_API SHALL call the Cloudinary_Destroy_API for each associated MatchMedia record before deleting the Match record.

---

### Requirement 9: Cloudinary Configuration

**User Story:** As a developer, I want Cloudinary credentials and upload presets to be configurable via environment variables, so that the system can be deployed to different environments without code changes.

#### Acceptance Criteria

1. THE System SHALL read the Cloudinary cloud name from the environment variable `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
2. THE System SHALL read each Upload_Preset name from a corresponding environment variable (e.g., `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_USER_PROFILE`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_CLUB_LOGO`, etc.).
3. THE System SHALL read the Cloudinary API key from `CLOUDINARY_API_KEY` and the API secret from `CLOUDINARY_API_SECRET` for server-side Cloudinary_Destroy_API calls.
4. IF any required Cloudinary environment variable is missing at server startup, THEN THE System SHALL log a descriptive warning message identifying the missing variable.

---

### Requirement 10: Schema Changes

**User Story:** As a developer, I want the database schema to support all new media relations, so that media records can be persisted and queried efficiently.

#### Acceptance Criteria

1. THE System SHALL add a `photoUrl String?` field to the `User` model.
2. THE System SHALL add a `StadiumImage` model with fields: `id`, `stadiumId`, `imageUrl`, `caption`, `sortOrder`, `createdAt`, linked to `Stadium` via a foreign key with cascade delete.
3. THE System SHALL add a `PlayerImage` model with fields: `id`, `playerId`, `imageUrl`, `caption`, `sortOrder`, `createdAt`, linked to `Player` via a foreign key with cascade delete.
4. THE System SHALL add a `CoachImage` model with fields: `id`, `coachId`, `imageUrl`, `caption`, `sortOrder`, `createdAt`, linked to `Coach` via a foreign key with cascade delete.
5. THE System SHALL add a `MatchMedia` model with fields: `id`, `matchId`, `mediaUrl`, `mediaType` (enum: `image` | `video`), `caption`, `sortOrder`, `createdAt`, linked to `Match` via a foreign key with cascade delete.
6. THE System SHALL add a `ClubImage` model with fields: `id`, `clubId`, `imageUrl`, `caption`, `sortOrder`, `createdAt`, linked to `Club` via a foreign key with cascade delete.
