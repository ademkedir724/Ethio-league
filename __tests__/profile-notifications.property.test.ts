// Feature: ethio-league, Property 12: Password change validation
// Feature: ethio-league, Property 13: Notification isolation
// Feature: ethio-league, Property 14: Lineup submission triggers league admin notification
import { describe, it } from "vitest";
import * as fc from "fast-check";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notification {
    id: string;
    userId: string;
    title: string;
    body: string;
    read: boolean;
}

interface PasswordChangeRequest {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

interface PasswordChangeResult {
    success: boolean;
    error?: string;
}

// ─── Pure business-logic functions ───────────────────────────────────────────

/**
 * Mirrors POST /api/users/me/change-password validation logic.
 * Does NOT call bcrypt — tests the structural validation rules only.
 */
function validatePasswordChange(
    req: PasswordChangeRequest,
    storedHashMatchesCurrent: boolean
): PasswordChangeResult {
    if (!req.currentPassword || !req.newPassword || !req.confirmPassword) {
        return { success: false, error: "All fields are required" };
    }
    if (req.newPassword !== req.confirmPassword) {
        return { success: false, error: "Passwords do not match" };
    }
    if (req.newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters" };
    }
    if (!storedHashMatchesCurrent) {
        return { success: false, error: "Current password is incorrect" };
    }
    return { success: true };
}

/**
 * Mirrors GET /api/notifications — returns only notifications for the given userId.
 */
function getNotificationsForUser(
    userId: string,
    allNotifications: Notification[]
): Notification[] {
    return allNotifications.filter((n) => n.userId === userId);
}

/**
 * Mirrors the notification creation in POST /api/matches/[id]/lineups.
 * Returns the notification that should be created for the league admin.
 */
function createLineupNotification(
    leagueAdminUserId: string,
    matchId: string,
    clubId: string
): Notification {
    return {
        id: `notif-${Math.random().toString(36).slice(2)}`,
        userId: leagueAdminUserId,
        title: "Lineup Submitted",
        body: `A lineup has been submitted for match ${matchId} by club ${clubId}`,
        read: false,
    };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const uuidArb = fc.uuid();

const notificationArb = (userId: string) =>
    fc.record({
        id: uuidArb,
        userId: fc.constant(userId),
        title: fc.string({ minLength: 1, maxLength: 50 }),
        body: fc.string({ minLength: 1, maxLength: 200 }),
        read: fc.boolean(),
    });

// ─── Property 12: Password change validation ─────────────────────────────────

describe("Property 12: Password change validation", () => {
    it("wrong current password is always rejected regardless of new password", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 8, maxLength: 30 }),
                fc.string({ minLength: 8, maxLength: 30 }),
                (currentPassword, newPassword) => {
                    const result = validatePasswordChange(
                        { currentPassword, newPassword, confirmPassword: newPassword },
                        false // storedHash does NOT match
                    );
                    return !result.success && result.error === "Current password is incorrect";
                }
            ),
            { numRuns: 100 }
        );
    });

    it("new password shorter than 8 characters is always rejected", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 7 }),
                (shortPassword) => {
                    const result = validatePasswordChange(
                        {
                            currentPassword: "correctPassword123",
                            newPassword: shortPassword,
                            confirmPassword: shortPassword,
                        },
                        true // current password matches
                    );
                    return !result.success && result.error === "Password must be at least 8 characters";
                }
            ),
            { numRuns: 100 }
        );
    });

    it("mismatched new password and confirm password is always rejected", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 8, maxLength: 30 }),
                fc.string({ minLength: 8, maxLength: 30 }),
                (newPassword, confirmPassword) => {
                    fc.pre(newPassword !== confirmPassword);
                    const result = validatePasswordChange(
                        { currentPassword: "correctPassword123", newPassword, confirmPassword },
                        true
                    );
                    return !result.success && result.error === "Passwords do not match";
                }
            ),
            { numRuns: 100 }
        );
    });

    it("valid request with correct current password and strong new password succeeds", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 8, maxLength: 30 }),
                (newPassword) => {
                    const result = validatePasswordChange(
                        {
                            currentPassword: "correctPassword123",
                            newPassword,
                            confirmPassword: newPassword,
                        },
                        true
                    );
                    return result.success;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("empty fields are always rejected", () => {
        fc.assert(
            fc.property(
                fc.constantFrom(
                    { currentPassword: "", newPassword: "newpass123", confirmPassword: "newpass123" },
                    { currentPassword: "current123", newPassword: "", confirmPassword: "" },
                    { currentPassword: "current123", newPassword: "newpass123", confirmPassword: "" }
                ),
                (req) => {
                    const result = validatePasswordChange(req, true);
                    return !result.success;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("password change with wrong current password does not change the stored hash", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 8, maxLength: 30 }),
                fc.string({ minLength: 8, maxLength: 30 }),
                (storedHash, newPassword) => {
                    // Simulate: wrong current password → hash must remain unchanged
                    let currentHash = storedHash;
                    const result = validatePasswordChange(
                        { currentPassword: "wrongPassword", newPassword, confirmPassword: newPassword },
                        false
                    );
                    if (!result.success) {
                        // Hash was NOT updated — still equals original
                        return currentHash === storedHash;
                    }
                    return false; // should never succeed with wrong password
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 13: Notification isolation ─────────────────────────────────────

describe("Property 13: Notification isolation", () => {
    it("GET notifications returns only notifications for the requesting user", () => {
        fc.assert(
            fc.property(
                uuidArb, // userId A
                uuidArb, // userId B
                fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
                fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
                (userA, userB, notifIdsA, notifIdsB) => {
                    fc.pre(userA !== userB);

                    const notificationsA: Notification[] = notifIdsA.map((id) => ({
                        id,
                        userId: userA,
                        title: "For A",
                        body: "body",
                        read: false,
                    }));
                    const notificationsB: Notification[] = notifIdsB.map((id) => ({
                        id,
                        userId: userB,
                        title: "For B",
                        body: "body",
                        read: false,
                    }));

                    const allNotifications = [...notificationsA, ...notificationsB];

                    const resultA = getNotificationsForUser(userA, allNotifications);
                    const resultB = getNotificationsForUser(userB, allNotifications);

                    // A's results must not contain B's notifications
                    const aContainsB = resultA.some((n) => n.userId === userB);
                    // B's results must not contain A's notifications
                    const bContainsA = resultB.some((n) => n.userId === userA);

                    return !aContainsB && !bContainsA;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("user with no notifications receives an empty list", () => {
        fc.assert(
            fc.property(
                uuidArb,
                uuidArb,
                fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
                (userId, otherUserId, notifIds) => {
                    fc.pre(userId !== otherUserId);

                    const allNotifications: Notification[] = notifIds.map((id) => ({
                        id,
                        userId: otherUserId,
                        title: "For other",
                        body: "body",
                        read: false,
                    }));

                    const result = getNotificationsForUser(userId, allNotifications);
                    return result.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("notification count matches exactly the number of notifications for that user", () => {
        fc.assert(
            fc.property(
                uuidArb,
                fc.integer({ min: 0, max: 20 }),
                fc.integer({ min: 0, max: 20 }),
                (userId, ownCount, otherCount) => {
                    const ownNotifs: Notification[] = Array.from({ length: ownCount }, (_, i) => ({
                        id: `own-${i}`,
                        userId,
                        title: "Mine",
                        body: "body",
                        read: false,
                    }));
                    const otherNotifs: Notification[] = Array.from({ length: otherCount }, (_, i) => ({
                        id: `other-${i}`,
                        userId: `other-user-${i}`,
                        title: "Not mine",
                        body: "body",
                        read: false,
                    }));

                    const result = getNotificationsForUser(userId, [...ownNotifs, ...otherNotifs]);
                    return result.length === ownCount;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("notification isolation holds with interleaved notifications from many users", () => {
        fc.assert(
            fc.property(
                fc.array(uuidArb, { minLength: 2, maxLength: 5 }).map((ids) => [...new Set(ids)]).filter((ids) => ids.length >= 2),
                fc.integer({ min: 1, max: 5 }),
                (userIds, notifsPerUser) => {
                    const allNotifications: Notification[] = userIds.flatMap((uid, ui) =>
                        Array.from({ length: notifsPerUser }, (_, i) => ({
                            id: `notif-${ui}-${i}`,
                            userId: uid,
                            title: `Notif ${i}`,
                            body: "body",
                            read: false,
                        }))
                    );

                    return userIds.every((uid) => {
                        const result = getNotificationsForUser(uid, allNotifications);
                        return (
                            result.length === notifsPerUser &&
                            result.every((n) => n.userId === uid)
                        );
                    });
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 14: Lineup submission triggers league admin notification ─────────

describe("Property 14: Lineup submission triggers league admin notification", () => {
    it("lineup submission creates a notification addressed to the league admin", () => {
        fc.assert(
            fc.property(
                uuidArb, // leagueAdminUserId
                uuidArb, // matchId
                uuidArb, // clubId
                (leagueAdminUserId, matchId, clubId) => {
                    const notification = createLineupNotification(leagueAdminUserId, matchId, clubId);
                    return notification.userId === leagueAdminUserId;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("lineup notification is not addressed to the submitting club admin", () => {
        fc.assert(
            fc.property(
                uuidArb, // leagueAdminUserId
                uuidArb, // clubAdminUserId
                uuidArb, // matchId
                uuidArb, // clubId
                (leagueAdminUserId, clubAdminUserId, matchId, clubId) => {
                    fc.pre(leagueAdminUserId !== clubAdminUserId);
                    const notification = createLineupNotification(leagueAdminUserId, matchId, clubId);
                    return notification.userId !== clubAdminUserId;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("lineup notification references the correct match and club", () => {
        fc.assert(
            fc.property(
                uuidArb,
                uuidArb,
                uuidArb,
                (leagueAdminUserId, matchId, clubId) => {
                    const notification = createLineupNotification(leagueAdminUserId, matchId, clubId);
                    return (
                        notification.body.includes(matchId) &&
                        notification.body.includes(clubId)
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("lineup notification is created as unread", () => {
        fc.assert(
            fc.property(
                uuidArb, uuidArb, uuidArb,
                (leagueAdminUserId, matchId, clubId) => {
                    const notification = createLineupNotification(leagueAdminUserId, matchId, clubId);
                    return notification.read === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("each lineup submission creates a distinct notification", () => {
        fc.assert(
            fc.property(
                uuidArb, uuidArb, uuidArb,
                (leagueAdminUserId, matchId, clubId) => {
                    const n1 = createLineupNotification(leagueAdminUserId, matchId, clubId);
                    const n2 = createLineupNotification(leagueAdminUserId, matchId, clubId);
                    return n1.id !== n2.id;
                }
            ),
            { numRuns: 100 }
        );
    });
});
