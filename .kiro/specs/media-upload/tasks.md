# Implementation Plan: Media Upload

## Overview

Implement Cloudinary-backed media upload for user profiles, organizations, leagues, clubs, stadiums, players, coaches, and matches. The browser uploads directly to Cloudinary; the server only persists the resulting URL and handles Cloudinary asset deletion on record removal.

## Tasks

- [x] 1. Install dependencies and configure environment
  - Run `npm install next-cloudinary cloudinary` to add client and server SDK packages
  - Add required env vars to `.env`: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and all nine `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_*` vars
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 2. Update Prisma schema and generate migration
  - [x] 2.1 Add `photoUrl String?` to the `User` model in `prisma/schema.prisma`
    - _Requirements: 10.1_
  - [x] 2.2 Add `ClubImage`, `StadiumImage`, `PlayerImage`, `CoachImage`, and `MatchMedia` models to `prisma/schema.prisma`
    - Each model: `id` (UUID PK), entity FK with `onDelete: Cascade`, `imageUrl`/`mediaUrl`, `caption?`, `sortOrder`, `createdAt`
    - `MatchMedia` additionally has `mediaType String` (`"image"` | `"video"`)
    - Add back-relations on `Club`, `Stadium`, `Player`, `Coach`, and `Match`
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_
  - [x] 2.3 Create and apply Prisma migration
    - Run `npx prisma migrate dev --name media-upload` to generate SQL and update the client
    - _Requirements: 10.1–10.6_

- [x] 3. Implement server-side media utilities
  - [x] 3.1 Create `lib/cloudinary.ts`
    - Configure `cloudinary` SDK from env vars; log a warning for any missing var
    - Export `isValidCloudinaryUrl(url: string): boolean` — returns `true` iff url starts with `https://res.cloudinary.com/`
    - Export `extractPublicId(url: string): string` — strips scheme, host, `/image/upload/vXXX/`, and file extension
    - Export `destroyAsset(publicId: string): Promise<void>` — calls `cloudinary.uploader.destroy`; logs warning on failure but does not throw
    - _Requirements: 9.3, 9.4, 1.5, 2.5, 3.5, 4.5_
  - [x] 3.2 Create `lib/media-limits.ts`
    - Export `MEDIA_LIMITS` constant: `{ club: 5, stadium: 20, player: 3, coach: 3, match: 20 }`
    - _Requirements: 4b.4, 5.4, 6.6, 7.6, 8.5_

- [x] 4. Write property-based tests for media utilities
  - [x] 4.1 Create `__tests__/media-upload.property.test.ts` with pure validation helpers
    - Implement `isValidImageMimeType`, `isValidVideoMimeType`, `isValidImageSize`, `isValidVideoSize` as local pure functions (mirrors client-side widget config)
    - _Requirements: 1.6, 1.7, 8.8, 8.9, 8.10_
  - [ ]* 4.2 Write property test for Property 1: URL validation rejects non-Cloudinary URLs
    - Generator: `fc.string()` filtered to not start with `https://res.cloudinary.com/`
    - Assert: `isValidCloudinaryUrl(s) === false`
    - **Property 1: URL validation rejects non-Cloudinary URLs**
    - **Validates: Requirements 1.5, 2.5, 3.5, 4.5**
  - [ ]* 4.3 Write property test for Property 2: Image MIME type validation
    - Generator: `fc.string()`
    - Assert: `isValidImageMimeType(s) === ["image/jpeg","image/png","image/webp"].includes(s)`
    - **Property 2: Image MIME type validation**
    - **Validates: Requirements 1.6, 2.6, 3.6, 4.6, 4b.6, 5.6, 6.8, 7.8, 8.7**
  - [ ]* 4.4 Write property test for Property 3: Image file size validation
    - Generator: `fc.integer({ min: 0, max: 20_000_000 })`
    - Assert: `isValidImageSize(n) === (n <= 5_242_880)`
    - **Property 3: Image file size validation**
    - **Validates: Requirements 1.7, 2.7, 3.7, 4.7, 4b.7, 5.7, 6.9, 7.9, 8.9**
  - [ ]* 4.5 Write property test for Property 4: Video MIME type validation
    - Generator: `fc.string()`
    - Assert: `isValidVideoMimeType(s) === (s === "video/mp4")`
    - **Property 4: Video MIME type validation**
    - **Validates: Requirements 8.8**
  - [ ]* 4.6 Write property test for Property 5: Video file size validation
    - Generator: `fc.integer({ min: 0, max: 200_000_000 })`
    - Assert: `isValidVideoSize(n) === (n <= 104_857_600)`
    - **Property 5: Video file size validation**
    - **Validates: Requirements 8.10**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add URL validation to existing single-URL PATCH routes
  - [x] 6.1 Update `app/api/users/me/route.ts` PATCH handler
    - Add `photoUrl` to the allowed fields
    - Before `prisma.user.update`, if `photoUrl` is present call `isValidCloudinaryUrl`; return 400 if invalid
    - _Requirements: 1.2, 1.3, 1.5_
  - [x] 6.2 Update `app/api/organizations/[id]/route.ts` PATCH handler
    - Before `prisma.organization.update`, if `logoUrl` is present validate with `isValidCloudinaryUrl`; return 400 if invalid
    - _Requirements: 2.2, 2.3, 2.5_
  - [x] 6.3 Update `app/api/leagues/[id]/route.ts` PATCH handler
    - Before `prisma.league.update`, if `logoUrl` is present validate with `isValidCloudinaryUrl`; return 400 if invalid
    - _Requirements: 3.2, 3.3, 3.5_
  - [x] 6.4 Update `app/api/clubs/[id]/route.ts` PATCH handler
    - Before `prisma.club.update`, if `logoUrl` is present validate with `isValidCloudinaryUrl`; return 400 if invalid
    - _Requirements: 4.2, 4.3, 4.5_
  - [x] 6.5 Update `app/api/players/[id]/route.ts` PATCH handler
    - Before `prisma.player.update`, if `photoUrl` is present validate with `isValidCloudinaryUrl`; return 400 if invalid
    - _Requirements: 6.2, 6.3_
  - [x] 6.6 Update `app/api/coaches/[id]/route.ts` PATCH handler
    - Before `prisma.coach.update`, if `photoUrl` is present validate with `isValidCloudinaryUrl`; return 400 if invalid
    - _Requirements: 7.2, 7.3_

- [x] 7. Implement club gallery API routes
  - [x] 7.1 Create `app/api/clubs/[id]/images/route.ts` — POST handler
    - Auth: `super_admin`, `organization_admin`, `club_admin`
    - Validate `url` with `isValidCloudinaryUrl`; return 400 if invalid
    - Count existing `ClubImage` records; return 422 if `>= MEDIA_LIMITS.club`
    - Create `ClubImage` with `sortOrder = count + 1`; return 201
    - _Requirements: 4b.2, 4b.3, 4b.4_
  - [x] 7.2 Create `app/api/clubs/[id]/images/[imageId]/route.ts` — DELETE handler
    - Auth: `super_admin`, `organization_admin`, `club_admin`
    - Fetch `ClubImage`; return 404 if not found
    - Call `destroyAsset(extractPublicId(record.imageUrl))`
    - Delete DB record; return 200
    - _Requirements: 4b.5_

- [x] 8. Implement stadium gallery API routes
  - [x] 8.1 Create `app/api/stadiums/[id]/images/route.ts` — POST handler
    - Auth: `super_admin`, `organization_admin`, `league_admin`, `club_admin`
    - Validate URL, enforce `MEDIA_LIMITS.stadium` cap, create `StadiumImage`; return 201
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 8.2 Create `app/api/stadiums/[id]/images/[imageId]/route.ts` — DELETE handler
    - Fetch `StadiumImage`, call `destroyAsset`, delete record; return 200
    - _Requirements: 5.5_

- [x] 9. Implement player gallery API routes
  - [x] 9.1 Create `app/api/players/[id]/images/route.ts` — POST handler
    - Auth: `super_admin`, `organization_admin`, `league_admin`, `club_admin`
    - Validate URL, enforce `MEDIA_LIMITS.player` cap, create `PlayerImage`; return 201
    - _Requirements: 6.4, 6.5, 6.6_
  - [x] 9.2 Create `app/api/players/[id]/images/[imageId]/route.ts` — DELETE handler
    - Fetch `PlayerImage`, call `destroyAsset`, delete record; return 200
    - _Requirements: 6.7_

- [x] 10. Implement coach gallery API routes
  - [x] 10.1 Create `app/api/coaches/[id]/images/route.ts` — POST handler
    - Auth: `super_admin`, `organization_admin`, `league_admin`, `club_admin`
    - Validate URL, enforce `MEDIA_LIMITS.coach` cap, create `CoachImage`; return 201
    - _Requirements: 7.4, 7.5, 7.6_
  - [x] 10.2 Create `app/api/coaches/[id]/images/[imageId]/route.ts` — DELETE handler
    - Fetch `CoachImage`, call `destroyAsset`, delete record; return 200
    - _Requirements: 7.7_

- [x] 11. Implement match media API routes
  - [x] 11.1 Create `app/api/matches/[id]/media/route.ts` — POST handler
    - Auth: `super_admin`, `league_admin`, `match_event_admin`
    - Body: `{ url: string, mediaType: "image" | "video" }`
    - Validate URL, enforce `MEDIA_LIMITS.match` cap, create `MatchMedia`; return 201
    - _Requirements: 8.3, 8.4, 8.5_
  - [x] 11.2 Create `app/api/matches/[id]/media/[mediaId]/route.ts` — DELETE handler
    - Fetch `MatchMedia`, call `destroyAsset`, delete record; return 200
    - _Requirements: 8.6_

- [x] 12. Add Cloudinary cascade cleanup to entity DELETE routes
  - [x] 12.1 Update `DELETE /api/clubs/[id]`
    - Before `prisma.club.delete`, fetch all `ClubImage` records for the club and call `destroyAsset` for each
    - _Requirements: 4b.8_
  - [x] 12.2 Update `DELETE /api/players/[id]`
    - Before `prisma.player.delete`, fetch all `PlayerImage` records and call `destroyAsset` for each
    - _Requirements: 6.10_
  - [x] 12.3 Update `DELETE /api/coaches/[id]`
    - Before `prisma.coach.delete`, fetch all `CoachImage` records and call `destroyAsset` for each
    - _Requirements: 7.10_
  - [x] 12.4 Update `DELETE /api/matches/[id]`
    - Before `prisma.match.delete`, fetch all `MatchMedia` records and call `destroyAsset` for each
    - _Requirements: 8.11_
  - [x] 12.5 Add stadium DELETE route at `app/api/stadiums/[id]/route.ts` (or update if it exists)
    - Before deleting, fetch all `StadiumImage` records and call `destroyAsset` for each
    - _Requirements: 5.8_

- [x] 13. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- `destroyAsset` swallows Cloudinary errors (logs warning) so DB deletes are never blocked
- Property tests cover pure validation functions; API round-trip properties (6–10) can be added as follow-up integration tests with mocked Prisma
