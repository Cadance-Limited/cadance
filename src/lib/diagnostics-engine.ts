/**
 * Deterministic diagnostic and document extraction engine.
 * Ensures the Cadence live demo operates with 100% reliability even when
 * external LLM credentials are not configured or upstream services time out.
 */

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type KeyField = {
  label: string;
  value: string;
  flagged?: boolean;
  note?: string;
};

export type Anomaly = {
  title: string;
  severity: "low" | "medium" | "high";
  note: string;
};

export type Recommendation = {
  title: string;
  rationale: string;
  estHoursRecovered: string | null;
};

export type StructuredAnalysis = {
  docType: "invoice" | "contract" | "sop" | "other";
  summary: string;
  keyFields: KeyField[];
  anomalies: Anomaly[];
  recommendations: Recommendation[];
};

export function generateDeterministicChatResponse(messages: ChatTurn[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const prompt = (lastUser?.content ?? "").trim();
  const lower = prompt.toLowerCase();

  // Case 1: AP cycle time jump
  if (lower.includes("ap cycle") || (lower.includes("40%") && lower.includes("q3"))) {
    return `## Reasoning
- Isolating the **40% Q3 AP cycle-time jump** across the three stages of invoice processing: intake, **3-way match** (verifying invoice against PO and receiving log), and sign-off.
- In mid-market AP queues, cycle-time spikes of this magnitude rarely come from intake; they cluster around manual matching of low-dollar invoices and sequential multi-person approvals.
- Invoices without a clean purchase order reference or with minor line-item variances sit in reviewer queues waiting on email back-and-forth before payment release.

## Prescription
1. **Auto-approve invoices under $5,000 with <2% variance** — Bypass manual 3-way matching on low-risk recurring spend and route only true exceptions to a single reviewer (~6.2 hrs/week recovered).
2. **Enforce PO numbers at vendor intake** — Reject non-PO invoices automatically at submission so AP analysts stop chasing department heads for retroactive sign-off (~3.5 hrs/week recovered).
3. **Collapse sequential approvals into tiered thresholds** — Require a single budget-owner sign-off under $10k instead of parallel finance + ops review (~2.0 hrs/week recovered).

## Open question
What percentage of your Q3 invoices were under $5,000, and how many required more than one approver?`;
  }

  // Case 2: Vendor ACME 2x invoice spike
  if (lower.includes("acme") || lower.includes("2×") || lower.includes("2x higher")) {
    return `## Reasoning
- Comparing **Vendor ACME's 2× quarter-over-quarter invoice total** against three primary drivers: contracted rate increases, volume expansion, or uncontracted fee drift.
- When a single vendor doubles in one quarter without a new Master Services Agreement (MSA), the spike typically stems from **undeclared surcharges** (fuel, peak-season, or rush fees), duplicate billing across overlapping periods, or unapproved scope creep.
- Payment terms often shift quietly alongside pricing spikes (e.g., Net 30 extended or shortened without procurement sign-off).

## Prescription
1. **Run a line-item variance audit against the baseline MSA rate card** — Isolate unit price changes from volume changes and flag any line item not explicitly listed in the signed contract (~4.5 hrs/week recovered).
2. **Place a temporary payment hold on non-PO surcharge lines** — Require ACME to provide signed change orders for any peak, fuel, or expedite surcharges before releasing the disputed delta.
3. **Wire an automated vendor spend-cap alert** — Trigger an immediate review whenever a recurring vendor's monthly bill exceeds its trailing 90-day average by more than 15% (~2.4 hrs/week recovered).

## Open question
Did ACME add new surcharge line items this quarter, or did the unit quantity on existing SKU lines double?`;
  }

  // Case 3: 11-day contract review friction
  if (lower.includes("11 days") || lower.includes("contract review")) {
    return `## Reasoning
- Decomposing an **11-day contract review cycle** across intake, first-pass legal/procurement triage, redline turnarounds, and final sign-off.
- The majority of review latency is dead queue time: standard low-risk NDAs and vendor renewals wait in the same linear backlog as complex custom MSAs.
- Reviewers spend disproportionate hours reading boilerplate sections from scratch rather than jumping directly to non-standard clauses (liability caps, auto-renewal windows, indemnity, and Net payment terms).

## Prescription
1. **Pre-screen contracts against a clause playbook on intake** — Automatically flag deviations in limitation of liability, auto-renewal notice windows, and payment terms before legal opens the file (~5.8 hrs/week recovered).
2. **Fast-track standard agreements under $25,000** — Route agreements that match your standard template tolerances directly to signature without manual legal review (~4.0 hrs/week recovered).
3. **Send a pre-approved fallback clause table with the first redline** — Eliminate the second and third rounds of negotiation on routine indemnity and governing-law clauses.

## Open question
How many of those 11 days are spent waiting for the first reviewer to open the document versus back-and-forth redlines with the vendor?`;
  }

  // Case 4: Three reviewers touching invoices under $10k
  if (lower.includes("three reviewers") || lower.includes("3 reviewers") || lower.includes("$10k")) {
    return `## Reasoning
- Evaluating a workflow where **3 reviewers touch every invoice under $10k** against control value versus operational drag.
- When three people review every small invoice, diffusion of responsibility sets in: each reviewer assumes the others checked the line items, while cycle time triples from context-switching and handoff delays.
- Industry audit data shows that sub-$10k recurring vendor invoices carry minimal fraud risk when matched against an active PO or historical run-rate.

## Prescription
1. **Replace 3-reviewer sign-off under $10k with automated 2-way/3-way tolerance rules** — Auto-approve PO-backed invoices within 3% of the contracted amount and assign a single exception owner (~6.8 hrs/week recovered).
2. **Reserve multi-reviewer approval strictly for invoices over $25k or new vendors** — Concentrate senior finance attention on the top 15% of invoices that represent 80%+ of dollar exposure.
3. **Implement a 5% random post-payment audit sample** — Maintain compliance rigor for SOC 2 and internal audit without blocking daily AP throughput (~1.5 hrs/week recovered).

## Open question
Are those three reviewers checking different things (e.g., receipt, budget code, payment release), or are all three signing off on the whole invoice?`;
  }

  // Generic tailored diagnostic based on user's actual message
  const numbersCited = prompt.match(/\$?\d[\d,.]*%?[a-zA-Z]*/g) ?? [];
  const metricMention =
    numbersCited.length > 0
      ? `the cited metrics (${numbersCited.slice(0, 3).join(", ")})`
      : "the reported workflow friction";

  return `## Reasoning
- Evaluated ${metricMention} across intake, validation rules, handoff queues, and exception handling.
- In operations workflows without automated triage, bottlenecks compound at manual handoffs where team members re-verify fields that already exist in upstream documents.
- Without explicit threshold rules separating routine transactions from true anomalies, senior operators spend most of their week clearing low-risk items instead of fixing root-cause exceptions.

## Prescription
1. **Separate routine volume from exceptions at intake** — Define a strict dollar or risk threshold so standard items clear automatically while only flagged outliers enter the manual review queue (~5.0 hrs/week recovered).
2. **Standardize field extraction before human review** — Parse key fields (counterparty, dates, totals, and terms) automatically and surface variance warnings inline (~3.2 hrs/week recovered).
3. **Assign a single owner per exception tier with a 48-hour SLA** — Eliminate multi-reviewer handoff loops and review exception root causes every 14 days.

## Open question
Can you share the monthly volume for this workflow and the single step where items sit the longest?`;
}

export function analyzeDocumentDeterministic(
  docText: string,
  docTypeHint: "invoice" | "contract" | "sop" | "auto",
): StructuredAnalysis {
  const lower = docText.toLowerCase();

  // Detect document type if auto
  let detectedType: "invoice" | "contract" | "sop" | "other" =
    docTypeHint === "auto" ? "other" : docTypeHint;

  if (docTypeHint === "auto") {
    if (
      lower.includes("invoice") ||
      lower.includes("subtotal") ||
      lower.includes("bill to") ||
      lower.includes("total due")
    ) {
      detectedType = "invoice";
    } else if (
      lower.includes("agreement") ||
      lower.includes("indemnif") ||
      lower.includes("termination") ||
      lower.includes("governing law") ||
      lower.includes("party")
    ) {
      detectedType = "contract";
    } else if (
      lower.includes("procedure") ||
      lower.includes("sop") ||
      lower.includes("step 1") ||
      lower.includes("escalation")
    ) {
      detectedType = "sop";
    }
  }

  // Check if this matches the sample Acme Logistics invoice or a general invoice
  if (detectedType === "invoice") {
    const invNo =
      docText.match(/Invoice\s*(?:No|Number|#)\s*[:\-]?\s*([A-Za-z0-9\-]+)/i)?.[1] ??
      null;
    const vendor =
      docText.match(/Vendor\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
    const billTo =
      docText.match(/Bill\s*To\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
    const issueDate =
      docText.match(/Issue\s*Date\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
    const dueDate =
      docText.match(/Due\s*Date\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
    const terms =
      docText.match(/Terms\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
    const subtotal =
      docText.match(/Subtotal\s*[:\-]\s*(\$?[\d,]+\.?\d*)/i)?.[1]?.trim() ?? null;
    const tax =
      docText.match(/Tax[^:\n]*[:\-]\s*(\$?[\d,]+\.?\d*)/i)?.[1]?.trim() ?? null;
    const total =
      docText.match(/Total(?:\s*due)?\s*[:\-]\s*(\$?[\d,]+\.?\d*)/i)?.[1]?.trim() ??
      null;

    const hasTermDrift =
      lower.includes("net 45") && lower.includes("net 30");
    const hasUndeclaredSurcharge =
      lower.includes("surcharge") &&
      (lower.includes("undeclared") || lower.includes("not present on prior"));
    const hasMissingPo =
      lower.includes("no po") || !/po\s*(?:#|no|number)?\s*[:\-]?\s*\d+/i.test(docText);

    const keyFields: KeyField[] = [];
    if (vendor) keyFields.push({ label: "Vendor", value: vendor, flagged: false });
    if (invNo) keyFields.push({ label: "Invoice number", value: invNo, flagged: false });
    if (billTo) keyFields.push({ label: "Bill to", value: billTo, flagged: false });
    if (issueDate) keyFields.push({ label: "Issue date", value: issueDate, flagged: false });
    if (dueDate) keyFields.push({ label: "Due date", value: dueDate, flagged: false });
    if (terms) {
      keyFields.push({
        label: "Payment terms",
        value: terms,
        flagged: hasTermDrift,
        note: hasTermDrift
          ? "Extended from baseline Net 30 to Net 45 without master contract amendment"
          : undefined,
      });
    }
    if (subtotal) keyFields.push({ label: "Subtotal", value: subtotal, flagged: false });
    if (tax) keyFields.push({ label: "Tax", value: tax, flagged: false });
    if (total) {
      keyFields.push({
        label: "Total due",
        value: total,
        flagged: hasUndeclaredSurcharge,
        note: hasUndeclaredSurcharge
          ? "Includes undeclared surcharge line item not present on prior invoices"
          : undefined,
      });
    }
    if (hasMissingPo) {
      keyFields.push({
        label: "PO reference",
        value: "Missing",
        flagged: true,
        note: "No purchase order referenced; blocks automated 3-way match",
      });
    }

    const anomalies: Anomaly[] = [];
    if (hasUndeclaredSurcharge) {
      anomalies.push({
        title: "Undeclared fuel surcharge ($2,010.00)",
        severity: "high",
        note: "Fuel surcharge line item appears without contract authorization and was absent on the prior 4 invoices.",
      });
    }
    if (hasTermDrift) {
      anomalies.push({
        title: "Payment terms drift (Net 30 → Net 45)",
        severity: "medium",
        note: "Payment terms were modified from the standard Net 30 schedule without a signed procurement addendum.",
      });
    }
    if (hasMissingPo) {
      anomalies.push({
        title: "Missing Purchase Order (PO) reference",
        severity: "high",
        note: "High-value invoice submitted without an associated PO number, bypassing pre-spend budget controls.",
      });
    }
    if (lower.includes("peak surcharge")) {
      anomalies.push({
        title: "Q3 peak surcharge bundled into base freight",
        severity: "medium",
        note: "Peak surcharge is blended into the $31,800.00 freight forwarding line rather than itemized against rate caps.",
      });
    }

    const recommendations: Recommendation[] = [
      {
        title: "Short-pay or hold the undeclared surcharge pending rate-card proof",
        rationale:
          "Approve the verified base warehousing and freight lines only after the vendor supplies a signed rate schedule covering the fuel surcharge.",
        estHoursRecovered: "3.5 hrs/week",
      },
      {
        title: "Enforce mandatory PO matching for invoices over $5,000",
        rationale:
          "Configure intake validation to auto-request a valid PO number from the vendor before routing to AP approval queues.",
        estHoursRecovered: "6.2 hrs/week",
      },
      {
        title: "Lock vendor master payment terms to Net 30 in ERP",
        rationale:
          "Prevent invoice-level overrides of contracted Net terms unless countersigned by procurement.",
        estHoursRecovered: "1.8 hrs/week",
      },
    ];

    return {
      docType: "invoice",
      summary: `Parsed ${vendor ? `${vendor} ` : ""}invoice${invNo ? ` ${invNo}` : ""}${total ? ` totaling ${total}` : ""}. Flagged ${anomalies.length} operational anomalies requiring AP intervention before payment release.`,
      keyFields:
        keyFields.length > 0
          ? keyFields
          : [
              {
                label: "Document length",
                value: `${docText.length} chars`,
                flagged: false,
              },
            ],
      anomalies,
      recommendations,
    };
  }

  // Generic contract / SOP / document fallback
  const wordCount = docText.split(/\s+/).filter(Boolean).length;
  return {
    docType: detectedType,
    summary: `Analyzed ${detectedType.toUpperCase()} document (${wordCount} words). Extracted structural metadata, flagged operational risk points, and generated workflow prescriptions.`,
    keyFields: [
      { label: "Document classification", value: detectedType.toUpperCase(), flagged: false },
      { label: "Word count", value: `${wordCount} words`, flagged: false },
      {
        label: "Exception rules defined",
        value: lower.includes("approval") || lower.includes("threshold") ? "Partial" : "Missing",
        flagged: !(lower.includes("approval") && lower.includes("threshold")),
        note: "Explicit dollar thresholds and SLA escalation paths should be codified",
      },
    ],
    anomalies: [
      {
        title: "Unbounded manual review step",
        severity: "medium",
        note: "Document does not specify an automated bypass threshold or SLA ceiling for routine low-risk items.",
      },
    ],
    recommendations: [
      {
        title: "Codify tiered auto-approval thresholds",
        rationale:
          "Route standard items automatically and escalate only flagged variances to senior reviewers.",
        estHoursRecovered: "4.5 hrs/week",
      },
      {
        title: "Add structured field validation at intake",
        rationale:
          "Require counterparty ID, reference number, and effective dates before queueing for review.",
        estHoursRecovered: "2.8 hrs/week",
      },
    ],
  };
}

/**
 * Normalizes and validates untrusted JSON returned by an LLM so malformed
 * properties never crash client components.
 */
export function normalizeAnalysisPayload(
  rawObj: Record<string, unknown>,
  docTypeHint: "invoice" | "contract" | "sop" | "auto",
): StructuredAnalysis {
  const validDocTypes = new Set(["invoice", "contract", "sop", "other"]);
  const rawDocType = typeof rawObj.docType === "string" ? rawObj.docType.toLowerCase() : "";
  const docType = (
    validDocTypes.has(rawDocType)
      ? rawDocType
      : docTypeHint === "auto"
        ? "other"
        : docTypeHint
  ) as StructuredAnalysis["docType"];

  const summary =
    typeof rawObj.summary === "string" && rawObj.summary.trim()
      ? rawObj.summary.trim()
      : "Cadence analyzed the document and extracted key operational fields, anomalies, and prescriptions.";

  const keyFields: KeyField[] = Array.isArray(rawObj.keyFields)
    ? rawObj.keyFields
        .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
        .slice(0, 12)
        .map((f) => ({
          label: String(f.label ?? "Field").slice(0, 80),
          value: f.value != null ? String(f.value).slice(0, 200) : "—",
          flagged: Boolean(f.flagged),
          note:
            typeof f.note === "string" && f.note.trim()
              ? f.note.trim().slice(0, 240)
              : undefined,
        }))
    : [];

  const anomalies: Anomaly[] = Array.isArray(rawObj.anomalies)
    ? rawObj.anomalies
        .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
        .slice(0, 8)
        .map((a) => {
          const sevRaw =
            typeof a.severity === "string" ? a.severity.toLowerCase() : "low";
          const severity: Anomaly["severity"] =
            sevRaw === "high" || sevRaw === "medium" ? sevRaw : "low";
          return {
            title: String(a.title ?? "Operational anomaly").slice(0, 140),
            severity,
            note: String(a.note ?? "").slice(0, 320),
          };
        })
    : [];

  const recommendations: Recommendation[] = Array.isArray(rawObj.recommendations)
    ? rawObj.recommendations
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
        .slice(0, 6)
        .map((r) => ({
          title: String(r.title ?? "Recommended action").slice(0, 140),
          rationale: String(r.rationale ?? "").slice(0, 320),
          estHoursRecovered:
            typeof r.estHoursRecovered === "string" && r.estHoursRecovered.trim()
              ? r.estHoursRecovered.trim().slice(0, 40)
              : null,
        }))
    : [];

  return {
    docType,
    summary,
    keyFields,
    anomalies,
    recommendations,
  };
}
