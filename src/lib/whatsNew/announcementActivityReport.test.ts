import { describe, expect, it, vi } from "vitest";

import {
  WHATS_NEW_POPUP_SCAN_ANNOUNCEMENT_ID,
  WHATS_NEW_POPUP_SCAN_MEMBER_ID,
  isExcludedWhatsNewAnnouncementActivity,
  sourcePageHasSqlProbeMarker,
  whatsNewSqlProbePathPattern,
} from "./announcementActivityReport";
import { listWhatsNewAnnouncementActivityCounts } from "./store";

const SCAN_MEMBER = WHATS_NEW_POPUP_SCAN_MEMBER_ID;
const SCAN_ANNOUNCEMENT = WHATS_NEW_POPUP_SCAN_ANNOUNCEMENT_ID;

describe("What's New pop-up activity reporting filter", () => {
  it("uses the probe markers recorded on the scan, not a general odd-URL rule", () => {
    expect(whatsNewSqlProbePathPattern()).toBe("pg_sleep|waitfor|dbms_pipe|xor\\(");
    expect(sourcePageHasSqlProbeMarker("/aboutRcwoM5Cp' OR 859=(SELECT 859 FROM PG_SLEEP(15))--")).toBe(
      true,
    );
    expect(sourcePageHasSqlProbeMarker("/courses-1 waitfor delay '0:0:15' --")).toBe(true);
    expect(
      sourcePageHasSqlProbeMarker(
        "/help-hub/work-with-sue'||DBMS_PIPE.RECEIVE_MESSAGE(CHR(98)||CHR(98)||CHR(98),15)||'",
      ),
    ).toBe(true);
    expect(
      sourcePageHasSqlProbeMarker("/help-hub/work-with-sue0'XOR(if(now()=sysdate(),sleep(15),0))XOR'Z"),
    ).toBe(true);
    expect(sourcePageHasSqlProbeMarker("/help-hub/work-with-sue")).toBe(false);
    expect(sourcePageHasSqlProbeMarker("/about'\"")).toBe(false);
  });

  it("excludes that account only on that announcement, and excludes probe paths once", () => {
    expect(
      isExcludedWhatsNewAnnouncementActivity({
        memberId: SCAN_MEMBER,
        cardId: SCAN_ANNOUNCEMENT,
        sourcePage: "/about",
      }),
    ).toBe(true);
    expect(
      isExcludedWhatsNewAnnouncementActivity({
        memberId: SCAN_MEMBER,
        cardId: SCAN_ANNOUNCEMENT,
        sourcePage: "/courses0'XOR(if(now()=sysdate(),sleep(15),0))XOR'Z",
      }),
    ).toBe(true);
    expect(
      isExcludedWhatsNewAnnouncementActivity({
        memberId: SCAN_MEMBER,
        cardId: "another-announcement",
        sourcePage: "/about",
      }),
    ).toBe(false);
    expect(
      isExcludedWhatsNewAnnouncementActivity({
        memberId: "mem_other_unpaid",
        cardId: SCAN_ANNOUNCEMENT,
        sourcePage: "/courses",
      }),
    ).toBe(false);
    expect(
      isExcludedWhatsNewAnnouncementActivity({
        memberId: null,
        cardId: SCAN_ANNOUNCEMENT,
        sourcePage: "/about0'XOR(if(now()=sysdate(),sleep(15),0))XOR'Z",
      }),
    ).toBe(true);
    expect(
      isExcludedWhatsNewAnnouncementActivity({
        memberId: null,
        cardId: SCAN_ANNOUNCEMENT,
        sourcePage: "/videos/611/",
      }),
    ).toBe(false);
  });

  it("applies the same account, announcement, and probe pattern to the count query", async () => {
    const queryFn = vi.fn().mockResolvedValue([]);
    await listWhatsNewAnnouncementActivityCounts("production", queryFn);
    const sql = String(queryFn.mock.calls[0]?.[0]);
    const params = queryFn.mock.calls[0]?.[1];
    expect(sql).toContain("member_id IS DISTINCT FROM $2");
    expect(sql).toContain("card_id IS DISTINCT FROM $3");
    expect(sql).toContain("!~*");
    expect(sql).not.toContain("DELETE");
    expect(params).toEqual(["production", SCAN_MEMBER, SCAN_ANNOUNCEMENT, whatsNewSqlProbePathPattern()]);
  });
});
