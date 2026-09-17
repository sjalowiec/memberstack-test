/**
 * Pure Account-page email-updates display mapping.
 */

import {
  ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL,
  ACCOUNT_EMAIL_SUBSCRIPTION_CONSENT,
  ACCOUNT_EMAIL_SUBSCRIPTION_HEADING,
  ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES,
  canResubscribeFromState,
  type AccountEmailSubscriptionState,
} from "./accountEmailSubscriptionShared";

export type AccountEmailSubscriptionView = {
  heading: string;
  statusMessage: string;
  extraMessage: string | null;
  showButton: boolean;
  buttonLabel: string;
  consentText: string | null;
  errorMessage: string | null;
};

export function resolveAccountEmailSubscriptionView(input: {
  state: AccountEmailSubscriptionState;
  justSubscribed?: boolean;
  errorMessage?: string | null;
}): AccountEmailSubscriptionView {
  if (input.justSubscribed) {
    return {
      heading: ACCOUNT_EMAIL_SUBSCRIPTION_HEADING,
      statusMessage: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.nowSubscribed,
      extraMessage: null,
      showButton: false,
      buttonLabel: ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL,
      consentText: null,
      errorMessage: null,
    };
  }

  if (input.state === "unavailable") {
    return {
      heading: ACCOUNT_EMAIL_SUBSCRIPTION_HEADING,
      statusMessage: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unavailable,
      extraMessage: null,
      showButton: false,
      buttonLabel: ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL,
      consentText: null,
      errorMessage: input.errorMessage ?? null,
    };
  }

  if (input.state === "active") {
    return {
      heading: ACCOUNT_EMAIL_SUBSCRIPTION_HEADING,
      statusMessage: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.receiving,
      extraMessage: null,
      showButton: false,
      buttonLabel: ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL,
      consentText: null,
      errorMessage: null,
    };
  }

  if (input.state === "bounced") {
    return {
      heading: ACCOUNT_EMAIL_SUBSCRIPTION_HEADING,
      statusMessage: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.notReceiving,
      extraMessage: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.bounced,
      showButton: false,
      buttonLabel: ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL,
      consentText: null,
      errorMessage: null,
    };
  }

  if (input.state === "unconfirmed") {
    return {
      heading: ACCOUNT_EMAIL_SUBSCRIPTION_HEADING,
      statusMessage: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.notReceiving,
      extraMessage: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unconfirmed,
      showButton: canResubscribeFromState(input.state),
      buttonLabel: ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL,
      consentText: ACCOUNT_EMAIL_SUBSCRIPTION_CONSENT,
      errorMessage: input.errorMessage ?? null,
    };
  }

  const showButton = canResubscribeFromState(input.state);
  return {
    heading: ACCOUNT_EMAIL_SUBSCRIPTION_HEADING,
    statusMessage: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.notReceiving,
    extraMessage: null,
    showButton,
    buttonLabel: ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL,
    consentText: showButton ? ACCOUNT_EMAIL_SUBSCRIPTION_CONSENT : null,
    errorMessage: input.errorMessage ?? null,
  };
}
