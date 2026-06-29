import { getCourseLandingBySlug } from "../legacy_kin/courseLanding";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "./validateEmailAddress";
import {
  sendCourseReadyNotificationEmail,
  type SendCourseReadyNotificationResult,
} from "./sendCourseReadyNotificationEmail";

export type CourseReadyNotificationRequestBody = {
  email?: unknown;
  customerEmail?: unknown;
  courseSlug?: unknown;
  courseTitle?: unknown;
};

export type CourseReadyNotificationHandlerResult =
  | { ok: true; status: 200 }
  | { ok: false; status: 400 | 404 | 500 | 502; error: string };

type HandlerOptions = {
  sendEmail?: typeof sendCourseReadyNotificationEmail;
};

const GENERIC_FAILURE =
  "We couldn't submit your request right now. Please try again in a moment.";

export async function handleCourseReadyNotificationRequest(
  body: CourseReadyNotificationRequestBody,
  options: HandlerOptions = {},
): Promise<CourseReadyNotificationHandlerResult> {
  const sendEmail = options.sendEmail ?? sendCourseReadyNotificationEmail;
  const customerEmail = normalizeEmailAddress(body.email ?? body.customerEmail);
  const courseSlug =
    typeof body.courseSlug === "string" ? body.courseSlug.trim() : "";

  if (!isValidEmailAddress(customerEmail)) {
    return {
      ok: false,
      status: 400,
      error: "Please enter a valid email address.",
    };
  }

  if (!courseSlug) {
    return { ok: false, status: 404, error: "Course not found." };
  }

  const landing = getCourseLandingBySlug(courseSlug);
  if (!landing) {
    return { ok: false, status: 404, error: "Course not found." };
  }

  const result: SendCourseReadyNotificationResult = await sendEmail({
    courseSlug: landing.slug,
    courseTitle: landing.title,
    customerEmail,
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.reason === "config" ? 500 : 502,
      error: GENERIC_FAILURE,
    };
  }

  return { ok: true, status: 200 };
}
