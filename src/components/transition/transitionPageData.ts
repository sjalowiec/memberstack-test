export const pageTitle = "The New Knit It Now is Coming";

export const description =
  "The new Knit It Now is coming August 1. Your membership continues - here's what's changing and what stays the same.";

export type SaveChecklistItem = {
  lead: string;
  note?: string;
  link?: { href: string; text: string; before: string; after: string };
};

export const staysSameItems = [
  "Your membership will continue - nothing about your membership is going away.",
  "Your email address and account stay the same.",
  "You'll continue to have access to everything included with the membership you've purchased.",
  "No extra cost is required because of the new site.",
  "If you join before August 1, your membership will continue on the new site.",
];

export const saveChecklistItems: SaveChecklistItem[] = [
  {
    lead: "Download any saved patterns you want to keep before August 1.",
    note: "Your saved patterns were created on the current site and won't be available after August 1.",
  },
  {
    lead: "Save any PDFs or downloads you'd like to keep for future reference before August 1.",
  },
  {
    lead: "Finish any courses you're currently working through before August 1, as course progress won't carry over to the new site.",
  },
];

export const whatsNewItems = [
  "Easier navigation",
  "Faster site",
  "Improved pattern builders",
  "Skill Builders for focused practice",
  "Better tools and references",
  "Improved Search",
];

export type FaqEntry = {
  question: string;
  answer: string;
  contactLink?: boolean;
};

export type FaqGroup = {
  title: string;
  items: FaqEntry[];
  summary?: string;
};

export const faqGroups: FaqGroup[] = [
  {
    title: "Membership & Access",
    items: [
      {
        question: "Will my membership continue?",
        answer:
          "Yes. If you are currently a monthly member, your membership will continue on the new Knit It Now - same account, same access.",
      },
      {
        question: "Do I need to do anything?",
        answer:
          "No. There is nothing you need to do to keep your membership active. Your account will carry over on August 1. Annual renewals will continue as normal.",
      },
      {
        question: "Can I still join before August 1?",
        answer:
          "Yes. When you join now, you'll have access to the current site right away, and your membership will continue on the new site on August 1.",
      },
    ],
    summary:
      "Your membership isn't going away. If you're an active Basic or Premium member, you'll continue to enjoy the benefits of your membership on the new site.",
  },
  {
    title: "Your Patterns, Downloads & Courses",
    items: [
      {
        question: "Will my saved patterns transfer?",
        answer:
          "Saved patterns from the current site won't carry over automatically. They were created on the current site, so if you have patterns you want to keep, please download or print them before August 1.",
      },
      {
        question: "What about PDFs and downloads?",
        answer:
          "PDFs, worksheets, and other downloads won't move over on their own. If there's anything you'd like to keep, saving it to your computer before August 1 is the easiest way to hold onto it.",
      },
      {
        question: "Will my course progress transfer?",
        answer:
          "Course progress from the current site won't carry over. If you're partway through a course you'd like to finish, you may want to complete it before August 1 - but only if that's important to you.",
      },
    ],
  },
  {
    title: "Why We're Making This Change",
    items: [
      {
        question: "Why is Knit It Now changing?",
        answer:
          "The current website has served machine knitters for many years, but it's time for a faster, easier, more modern version. The new site is designed to help you find what you need more quickly and spend more time knitting.",
      },
      {
        question: "What if I have questions or need help?",
        answer: "Please contact us and we'll help.",
        contactLink: true,
      },
    ],
  },
];
