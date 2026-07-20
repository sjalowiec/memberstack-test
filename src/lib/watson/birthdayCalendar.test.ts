import { describe, expect, it } from "vitest";

import {
  birthdayDayInYear,
  buildBirthdayMonthView,
  cardStatusKey,
  compareBirthdayMembersByName,
} from "./birthdayCalendar";
import type { BirthdayCardStatusRecord } from "./birthdayCardsStore";
import type { BirthdayMember } from "./birthdayMemberSource";

function member(overrides: Partial<BirthdayMember> & Pick<BirthdayMember, "memberId" | "displayName" | "birthMonth" | "birthDay">): BirthdayMember {
  return {
    firstName: overrides.firstName ?? overrides.displayName.split(" ")[0] ?? null,
    lastName:
      overrides.lastName ?? (overrides.displayName.split(" ").slice(1).join(" ") || null),
    birthdayLabel: "label",
    memberSinceDisplay: null,
    planDisplay: null,
    mailingAddressDisplay: null,
    mailingCountry: null,
    hasMailingAddress: false,
    profileHref: `/watson/customers/legacy/${overrides.memberId}`,
    notesHref: `/watson/customers/legacy/${overrides.memberId}#customer-notes`,
    ...overrides,
  };
}

describe("birthdayCalendar", () => {
  it("places birthdays on the correct month/day regardless of birth year", () => {
    const view = buildBirthdayMonthView({
      year: 2026,
      month: 3,
      members: [
        member({
          memberId: "A",
          displayName: "Ann Adams",
          birthMonth: 3,
          birthDay: 15,
        }),
      ],
      now: new Date(2026, 2, 1),
    });

    const day15 = view.weeks.flat().find((day) => day.inCurrentMonth && day.day === 15);
    expect(day15?.entries).toHaveLength(1);
    expect(day15?.entries[0]?.displayName).toBe("Ann Adams");
    expect(day15?.entries[0]?.occurrenceYear).toBe(2026);
  });

  it("renders multiple birthdays on one day sorted alphabetically", () => {
    const view = buildBirthdayMonthView({
      year: 2026,
      month: 7,
      members: [
        member({
          memberId: "3",
          displayName: "Zoe Zebra",
          firstName: "Zoe",
          lastName: "Zebra",
          birthMonth: 7,
          birthDay: 20,
        }),
        member({
          memberId: "1",
          displayName: "Amy Adams",
          firstName: "Amy",
          lastName: "Adams",
          birthMonth: 7,
          birthDay: 20,
        }),
        member({
          memberId: "2",
          displayName: "Beth Adams",
          firstName: "Beth",
          lastName: "Adams",
          birthMonth: 7,
          birthDay: 20,
        }),
      ],
      now: new Date(2026, 6, 1),
    });

    const day20 = view.weeks.flat().find((day) => day.inCurrentMonth && day.day === 20);
    expect(day20?.entries.map((entry) => entry.displayName)).toEqual([
      "Amy Adams",
      "Beth Adams",
      "Zoe Zebra",
    ]);
  });

  it("uses the displayed calendar year for card status, so 2026 sent does not mark 2027", () => {
    const members = [
      member({
        memberId: "M1",
        displayName: "Pat Lee",
        firstName: "Pat",
        lastName: "Lee",
        birthMonth: 1,
        birthDay: 5,
      }),
    ];
    const statuses: BirthdayCardStatusRecord[] = [
      {
        memberId: "M1",
        birthdayYear: 2026,
        status: "sent",
        sentAt: "2026-01-05T12:00:00.000Z",
        updatedAt: "2026-01-05T12:00:00.000Z",
      },
    ];

    const dec2026 = buildBirthdayMonthView({
      year: 2026,
      month: 12,
      members: [
        member({
          memberId: "M2",
          displayName: "Dec Person",
          firstName: "Dec",
          lastName: "Person",
          birthMonth: 12,
          birthDay: 10,
        }),
      ],
      cardStatuses: [
        {
          memberId: "M2",
          birthdayYear: 2026,
          status: "sent",
          sentAt: "2026-12-10T12:00:00.000Z",
          updatedAt: "2026-12-10T12:00:00.000Z",
        },
      ],
      now: new Date(2026, 11, 1),
    });
    const decEntry = dec2026.weeks.flat().flatMap((d) => d.entries)[0];
    expect(decEntry?.occurrenceYear).toBe(2026);
    expect(decEntry?.cardStatus).toBe("sent");

    const jan2027 = buildBirthdayMonthView({
      year: 2027,
      month: 1,
      members,
      cardStatuses: statuses,
      now: new Date(2027, 0, 1),
    });
    const janEntry = jan2027.weeks.flat().flatMap((d) => d.entries)[0];
    expect(janEntry?.occurrenceYear).toBe(2027);
    expect(janEntry?.cardStatus).toBe("not_sent");
    expect(cardStatusKey("M1", 2026)).not.toBe(cardStatusKey("M1", 2027));
  });

  it("updates calendar entry state when a card is marked sent or undone", () => {
    const members = [
      member({
        memberId: "M-toggle",
        displayName: "Tina Toggle",
        firstName: "Tina",
        lastName: "Toggle",
        birthMonth: 8,
        birthDay: 12,
      }),
    ];

    const before = buildBirthdayMonthView({
      year: 2026,
      month: 8,
      members,
      now: new Date(2026, 7, 1),
    });
    expect(before.weeks.flat().flatMap((d) => d.entries)[0]?.cardStatus).toBe("not_sent");

    const afterSent = buildBirthdayMonthView({
      year: 2026,
      month: 8,
      members,
      cardStatuses: [
        {
          memberId: "M-toggle",
          birthdayYear: 2026,
          status: "sent",
          sentAt: "2026-08-12T12:00:00.000Z",
          updatedAt: "2026-08-12T12:00:00.000Z",
        },
      ],
      now: new Date(2026, 7, 1),
    });
    expect(afterSent.weeks.flat().flatMap((d) => d.entries)[0]?.cardStatus).toBe("sent");

    const afterUndo = buildBirthdayMonthView({
      year: 2026,
      month: 8,
      members,
      cardStatuses: [],
      now: new Date(2026, 7, 1),
    });
    expect(afterUndo.weeks.flat().flatMap((d) => d.entries)[0]?.cardStatus).toBe("not_sent");
  });

  it("marks sent styling from year-specific status and supports empty months", () => {
    const view = buildBirthdayMonthView({
      year: 2026,
      month: 4,
      members: [
        member({
          memberId: "S1",
          displayName: "Sam Sent",
          firstName: "Sam",
          lastName: "Sent",
          birthMonth: 4,
          birthDay: 2,
        }),
        member({
          memberId: "N1",
          displayName: "Ned Needs",
          firstName: "Ned",
          lastName: "Needs",
          birthMonth: 4,
          birthDay: 3,
        }),
      ],
      cardStatuses: [
        {
          memberId: "S1",
          birthdayYear: 2026,
          status: "sent",
          sentAt: "2026-04-02T10:00:00.000Z",
          updatedAt: "2026-04-02T10:00:00.000Z",
        },
      ],
      now: new Date(2026, 3, 1),
    });

    const entries = view.weeks.flat().flatMap((day) => day.entries);
    expect(entries.find((e) => e.memberId === "S1")?.cardStatus).toBe("sent");
    expect(entries.find((e) => e.memberId === "N1")?.cardStatus).toBe("not_sent");

    const empty = buildBirthdayMonthView({
      year: 2026,
      month: 11,
      members: [
        member({
          memberId: "X",
          displayName: "Only July",
          birthMonth: 7,
          birthDay: 1,
        }),
      ],
      now: new Date(2026, 10, 1),
    });
    expect(empty.entryCount).toBe(0);
  });

  it("places Feb 29 birthdays on Feb 28 in non-leap years", () => {
    expect(birthdayDayInYear(2, 29, 2026)).toBe(28);
    expect(birthdayDayInYear(2, 29, 2028)).toBe(29);
  });

  it("sorts names alphabetically by last then first", () => {
    const sorted = [
      member({
        memberId: "2",
        displayName: "Zoe Adams",
        firstName: "Zoe",
        lastName: "Adams",
        birthMonth: 1,
        birthDay: 1,
      }),
      member({
        memberId: "1",
        displayName: "Amy Adams",
        firstName: "Amy",
        lastName: "Adams",
        birthMonth: 1,
        birthDay: 1,
      }),
    ].sort(compareBirthdayMembersByName);

    expect(sorted.map((m) => m.displayName)).toEqual(["Amy Adams", "Zoe Adams"]);
  });
});
