import { joinWatsonDisplayParts } from "./displayFormat";
import { type MemberCourseDisplay } from "./memberCourses";
import { type MemberMembershipDisplay } from "./memberMembership";
import { type MemberOrderDisplay } from "./memberOrders";
import { type CustomerMemberstackSummary } from "./customerMemberstack";
import { type LegacyMemberDetailRow } from "./memberDetail";
import { type WatsonNoteDisplay } from "./watsonNotes";

export type CustomerTimelineEventType =
  | "account_created"
  | "membership_started"
  | "membership_changed"
  | "course_enrolled"
  | "store_order"
  | "note_added";

export interface CustomerTimelineEvent {
  eventType: CustomerTimelineEventType;
  eventTypeLabel: string;
  dateDisplay: string;
  dateSort: string;
  description: string;
  source: string;
}

export const CUSTOMER_TIMELINE_EVENT_LABELS: Record<CustomerTimelineEventType, string> = {
  account_created: "Account created",
  membership_started: "Membership started",
  membership_changed: "Membership changed",
  course_enrolled: "Course enrolled",
  store_order: "Store order",
  note_added: "Note added",
};

function pushEvent(
  events: CustomerTimelineEvent[],
  event: CustomerTimelineEvent | null,
): void {
  if (!event || !event.dateSort) {
    return;
  }
  events.push(event);
}

export function buildAccountCreatedTimelineEvent(
  member: LegacyMemberDetailRow | null,
  memberstack: CustomerMemberstackSummary,
): CustomerTimelineEvent | null {
  if (member?.datejoined) {
    const date =
      member.datejoined instanceof Date
        ? member.datejoined
        : new Date(String(member.datejoined));
    if (!Number.isNaN(date.getTime())) {
      return {
        eventType: "account_created",
        eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.account_created,
        dateDisplay: date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        dateSort: date.toISOString(),
        description: "Legacy KIN member account created",
        source: "legacy_members",
      };
    }
  }

  if (memberstack.accountCreatedAtSort) {
    return {
      eventType: "account_created",
      eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.account_created,
      dateDisplay: memberstack.accountCreatedAt ?? memberstack.accountCreatedAtSort,
      dateSort: memberstack.accountCreatedAtSort,
      description: "Memberstack account created",
      source: "Memberstack API",
    };
  }

  return null;
}

export function buildMembershipTimelineEvents(
  memberships: MemberMembershipDisplay[],
): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = [];

  for (const record of memberships) {
    if (!record.startDateSort) {
      continue;
    }

    const parts = ["Legacy membership payment"];
    if (record.amount) {
      parts.push(record.amount);
    }
    if (record.subscriptionRateId) {
      parts.push(`rate ${record.subscriptionRateId}`);
    }

    pushEvent(events, {
      eventType: "membership_started",
      eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.membership_started,
      dateDisplay: record.startDate ?? record.startDateSort,
      dateSort: record.startDateSort,
      description: joinWatsonDisplayParts(parts),
      source: "legacy_subscriptions",
    });

    if (record.expirationDateSort) {
      pushEvent(events, {
        eventType: "membership_changed",
        eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.membership_changed,
        dateDisplay: record.expirationDate ?? record.expirationDateSort,
        dateSort: record.expirationDateSort,
        description: "Legacy membership expiration date",
        source: "legacy_subscriptions",
      });
    }

    if (record.cancelDateSort) {
      pushEvent(events, {
        eventType: "membership_changed",
        eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.membership_changed,
        dateDisplay: record.cancelDate ?? record.cancelDateSort,
        dateSort: record.cancelDateSort,
        description: "Legacy membership canceled",
        source: "legacy_subscriptions",
      });
    }
  }

  return events;
}

export function buildMemberstackConnectionTimelineEvents(
  memberstack: CustomerMemberstackSummary,
): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = [];

  for (const connection of memberstack.connections) {
    if (!connection.startDateSort) {
      continue;
    }

    const descriptionParts = [connection.planName ?? "Plan connection"];
    if (connection.billingInterval) {
      descriptionParts.push(connection.billingInterval);
    }
    if (connection.status) {
      descriptionParts.push(connection.status);
    }

    pushEvent(events, {
      eventType: "membership_started",
      eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.membership_started,
      dateDisplay: connection.startDate ?? connection.startDateSort,
      dateSort: connection.startDateSort,
      description: joinWatsonDisplayParts(descriptionParts),
      source: "Memberstack API",
    });

    if (connection.canceledAtSort) {
      pushEvent(events, {
        eventType: "membership_changed",
        eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.membership_changed,
        dateDisplay: connection.canceledAt ?? connection.canceledAtSort,
        dateSort: connection.canceledAtSort,
        description: `${connection.planName ?? "Plan"} canceled`,
        source: "Memberstack API",
      });
    }
  }

  return events;
}

export function buildCourseTimelineEvents(courses: MemberCourseDisplay[]): CustomerTimelineEvent[] {
  return courses
    .filter((course) => course.dateAddedSort)
    .map((course) => ({
      eventType: "course_enrolled" as const,
      eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.course_enrolled,
      dateDisplay: course.dateAdded ?? course.dateAddedSort,
      dateSort: course.dateAddedSort,
      description: joinWatsonDisplayParts([
        course.courseName ?? `Course ${course.courseId}`,
        course.accessStatus,
      ]),
      source: "legacy_course_member_library",
    }));
}

export function buildOrderTimelineEvents(orders: MemberOrderDisplay[]): CustomerTimelineEvent[] {
  return orders
    .filter((order) => order.orderDateSort)
    .map((order) => ({
      eventType: "store_order" as const,
      eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.store_order,
      dateDisplay: order.orderDate ?? order.orderDateSort,
      dateSort: order.orderDateSort,
      description: joinWatsonDisplayParts([
        order.orderTotal ?? "Order",
        order.orderStatus,
        order.transactionId ? `Txn ${order.transactionId}` : null,
      ]),
      source: "legacy_store_transactions",
    }));
}

export function buildNoteTimelineEvents(notes: WatsonNoteDisplay[]): CustomerTimelineEvent[] {
  return notes
    .filter((note) => note.createdAtSort)
    .map((note) => ({
      eventType: "note_added" as const,
      eventTypeLabel: CUSTOMER_TIMELINE_EVENT_LABELS.note_added,
      dateDisplay: note.createdAt,
      dateSort: note.createdAtSort,
      description: `${note.category} note by ${note.createdBy}`,
      source: "watson_notes",
    }));
}

export function sortCustomerTimelineEventsNewestFirst(
  events: CustomerTimelineEvent[],
): CustomerTimelineEvent[] {
  return [...events].sort((left, right) => {
    const dateCompare = right.dateSort.localeCompare(left.dateSort);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return right.description.localeCompare(left.description);
  });
}

export function buildCustomerTimeline(input: {
  member: LegacyMemberDetailRow | null;
  memberstack: CustomerMemberstackSummary;
  memberships: MemberMembershipDisplay[];
  courses: MemberCourseDisplay[];
  orders: MemberOrderDisplay[];
  notes: WatsonNoteDisplay[];
}): CustomerTimelineEvent[] {
  const events: CustomerTimelineEvent[] = [];

  pushEvent(events, buildAccountCreatedTimelineEvent(input.member, input.memberstack));
  events.push(...buildMembershipTimelineEvents(input.memberships));
  events.push(...buildMemberstackConnectionTimelineEvents(input.memberstack));
  events.push(...buildCourseTimelineEvents(input.courses));
  events.push(...buildOrderTimelineEvents(input.orders));
  events.push(...buildNoteTimelineEvents(input.notes));

  return sortCustomerTimelineEventsNewestFirst(events);
}
