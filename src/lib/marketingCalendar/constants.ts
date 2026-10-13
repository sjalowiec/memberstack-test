/** Existing KIN marketing calendar. Never create another calendar. */
export const KIN_MARKETING_CALENDAR_ID =
  "c_744aeac0ecd3e2eb9cdd902edfa634763c07472b6960a0a632a1c5e7ec7957c2@group.calendar.google.com";

export const KIN_MARKETING_CALENDAR_NAME = "KIN marketing";

/** Import boundary on the marketing calendar's planning clock. */
export const IMPORT_START_DATE = "2026-10-01";
export const IMPORT_TIME_ZONE = "America/Los_Angeles";

/** Google Calendar event color IDs. Orange (6) and yellow (5) stay manual. */
export const EVENT_COLOR = {
  draft: "9",
  scheduled: "7",
  sending: "7",
  paused: "8",
  stopped: "8",
  disabled: "8",
  completed: "10",
} as const;

export const SYNC_SOURCE = "activecampaign";
export const SYNC_MARKER = "kin-marketing";
export const PROP_SOURCE = "kinSource";
export const PROP_SYNC = "kinSync";
export const PROP_CAMPAIGN_ID = "kinCampaignId";
export const PROP_EVENT_AT = "kinEventAt";

export const MANUAL_SECRET_HEADER = "x-marketing-calendar-secret";
