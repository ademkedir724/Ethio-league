// Feature: ethio-league, Property 11: Scope enforcement — 403 on out-of-scope access
import { describe, it } from "vitest";
import * as fc from "fast-check";
import {
    assertOrgScope,
    assertSeasonScope,
    assertClubScope,
    assertMEASeasonScope,
} from "@/lib/scope-guard";
import {
    makeSuperAdmin,
    makeOrgAdmin,
    makeLeagueAdmin,
    makeClubAdmin,
    makeMEA,
} from "./helpers/mock-auth";

const uuidArb = fc.uuid();

describe("Property 11: Scope enforcement — 403 on out-of-scope access", () => {
    it("super_admin always passes all scope checks", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, uuidArb, (orgId, seasonId, clubId) => {
                const admin = makeSuperAdmin();
                return (
                    assertOrgScope(admin, orgId) &&
                    assertSeasonScope(admin, seasonId) &&
                    assertClubScope(admin, clubId) &&
                    assertMEASeasonScope(admin, seasonId)
                );
            }),
            { numRuns: 100 }
        );
    });

    it("org_admin passes assertOrgScope for their org, fails for others", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, (myOrgId, otherOrgId) => {
                fc.pre(myOrgId !== otherOrgId);
                const admin = makeOrgAdmin(myOrgId);
                return assertOrgScope(admin, myOrgId) && !assertOrgScope(admin, otherOrgId);
            }),
            { numRuns: 100 }
        );
    });

    it("league_admin passes assertSeasonScope for their season, fails for others", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, (mySeasonId, otherSeasonId) => {
                fc.pre(mySeasonId !== otherSeasonId);
                const admin = makeLeagueAdmin(mySeasonId);
                return (
                    assertSeasonScope(admin, mySeasonId) &&
                    !assertSeasonScope(admin, otherSeasonId)
                );
            }),
            { numRuns: 100 }
        );
    });

    it("club_admin passes assertClubScope for their club, fails for others", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, (myClubId, otherClubId) => {
                fc.pre(myClubId !== otherClubId);
                const admin = makeClubAdmin(myClubId);
                return (
                    assertClubScope(admin, myClubId) &&
                    !assertClubScope(admin, otherClubId)
                );
            }),
            { numRuns: 100 }
        );
    });

    it("MEA passes assertMEASeasonScope for their season, fails for others", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, (mySeasonId, otherSeasonId) => {
                fc.pre(mySeasonId !== otherSeasonId);
                const mea = makeMEA(mySeasonId);
                return (
                    assertMEASeasonScope(mea, mySeasonId) &&
                    !assertMEASeasonScope(mea, otherSeasonId)
                );
            }),
            { numRuns: 100 }
        );
    });

    it("league_admin passes assertMEASeasonScope for any season (bypass)", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, (mySeasonId, anySeasonId) => {
                const admin = makeLeagueAdmin(mySeasonId);
                return assertMEASeasonScope(admin, anySeasonId);
            }),
            { numRuns: 100 }
        );
    });

    it("org_admin fails assertSeasonScope and assertClubScope", () => {
        fc.assert(
            fc.property(uuidArb, uuidArb, uuidArb, (orgId, seasonId, clubId) => {
                const admin = makeOrgAdmin(orgId);
                return !assertSeasonScope(admin, seasonId) && !assertClubScope(admin, clubId);
            }),
            { numRuns: 100 }
        );
    });
});
