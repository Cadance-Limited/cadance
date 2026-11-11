const tiers = [
  {
    name: "Discovery Sprint",
    price: "$500",
    description: "1-week diagnostic + automation blueprint.",
    features: [
      "Operational audit",
      "Bottleneck mapping",
      "Custom n8n workflow blueprint",
      "Loom walkthrough of the fix"
    ],
    cta: "Book Sprint",
    highlighted: false,
  },
  {
    name: "Implementation",
    price: "$2,500",
    description: "Full workflow build + deployment to production.",
    features: [
      "Everything in Discovery",
      "Custom n8n workflow built",
      "API integrations (HubSpot, OpenAI, etc.)",
      "Team handover & documentation"
    ],
    cta: "Start Build",
    highlighted: true, // Makes this tier pop with the emerald accent
  },
  {
    name: "Operate & Improve",
    price: "$1,200/mo",
    description: "Ongoing maintenance + 1 new workflow per month.",
    features: [
      "24/7 monitoring & error handling",
      "API update management",
      "1 new workflow build per month",
      "Dedicated Slack Connect channel"
    ],
    cta: "Retain Services",
    highlighted: false,
  }
];
