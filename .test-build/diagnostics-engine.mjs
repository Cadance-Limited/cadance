/**
 * Deterministic diagnostic and document extraction engine + strict schema validator.
 *
 * NON-HALLUCINATION POLICY:
 * - Never invents hours recovered, anomaly rates, financial savings, or industry benchmarks.
 * - Never claims to have parsed records that were not supplied in the user input.
 * - Explicitly identifies assumptions and distinguishes supplied evidence from inferred conditions.
 * - Clearly signals when running in deterministic rule-based fallback mode vs. live AI mode.
 */
export function generateDeterministicChatResponse(messages) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const prompt = (lastUser?.content ?? "").trim();
    const lower = prompt.toLowerCase();
    const citedNumbers = prompt.match(/\$?\d[\d,.]*%?(?:\s*(?:days?|hrs?|hours?|weeks?|months?|k|m))?/gi) ?? [];
    const evidenceClause = citedNumbers.length > 0
        ? `Supplied figures in your prompt: ${citedNumbers.slice(0, 4).map((s) => `\`${s.trim()}\``).join(", ")}.`
        : "No quantitative dataset or document records were attached to this prompt.";
    if (lower.includes("ap cycle") || (lower.includes("40%") && lower.includes("q3"))) {
        return `## Reasoning
- **Supplied evidence**: ${evidenceClause}
- **Detected condition**: A reported Q3 accounts-payable cycle-time increase requires isolating intake latency, **3-way match** verification (matching invoice, purchase order, and receiving log), and approval queue wait time.
- **Assumption & limitation**: Because underlying AP ledger rows were not uploaded, Cadence cannot verify which vendor tier or approval stage caused the delay without your queue breakdown.

## Prescription
1. **Segment Q3 invoices by dollar band and PO status** — Compare approval timestamps on PO-backed vs. non-PO invoices to see where cycle time expanded.
2. **Audit exception-queue holds** — Identify whether invoices stalled waiting on missing receiving confirmation or manual line-item variance checks.
3. **Define an explicit auto-match tolerance rule** — Route recurring PO-backed invoices within your approved variance threshold directly to payment batching.

## Open question
What share of your Q3 invoices lacked an upfront PO number or required multiple sequential sign-offs?`;
    }
    if (lower.includes("acme") || lower.includes("2×") || lower.includes("2x higher")) {
        return `## Reasoning
- **Supplied evidence**: ${evidenceClause}
- **Detected condition**: A reported quarter-over-quarter doubling in a vendor's billed total stems from one of three verifiable sources: unit-rate changes, billed quantity growth, or newly added surcharge/fee lines.
- **Assumption & limitation**: No historical ACME invoices or Master Services Agreement (MSA) rate cards were provided in this session, so line-level variance must be confirmed against the source PDFs.

## Prescription
1. **Compare current line items against the signed rate schedule** — Separate contracted unit-price changes from uncontracted surcharges (such as fuel, peak, or rush fees).
2. **Check for duplicate billing periods or missing PO references** — Verify that invoice date ranges do not overlap with prior paid statements.
3. **Hold disputed surcharge lines pending vendor documentation** — Release only the verified base amount until written rate authorization is attached.

## Open question
Can you paste the current ACME invoice into the Document Intelligence tab so we can inspect the exact line items and payment terms?`;
    }
    if (lower.includes("11 days") || lower.includes("contract review")) {
        return `## Reasoning
- **Supplied evidence**: ${evidenceClause}
- **Detected condition**: An extended contract review cycle typically reflects either queue backlog before first-pass review or repeated redline turns on non-standard clauses (liability caps, indemnity, payment terms, and auto-renewal notice windows).
- **Assumption & limitation**: Without timestamp logs by review stage, we cannot attribute how much of the cycle is passive queue wait vs. active legal negotiation.

## Prescription
1. **Separate standard low-risk agreements from custom MSAs at intake** — Route unmodified templates through a fast-track sign-off lane instead of a single FIFO legal backlog.
2. **Pre-screen incoming drafts against a clause checklist** — Flag deviations in Net payment terms, limitation of liability, and termination windows before legal opens the document.
3. **Attach pre-approved fallback language on the first redline turn** — Reduce multi-round email back-and-forth on routine commercial terms.

## Open question
How much of your review timeline is spent waiting for initial triage versus negotiating redlines with the counterparty?`;
    }
    if (lower.includes("three reviewers") || lower.includes("3 reviewers") || lower.includes("$10k")) {
        return `## Reasoning
- **Supplied evidence**: ${evidenceClause}
- **Detected condition**: Requiring three sequential or parallel reviewers on every invoice under $10k introduces handoff latency and duplicated verification on routine transactions.
- **Assumption & limitation**: We do not have your historical exception rate on sub-$10k invoices, so any threshold change should be validated against your internal audit policy.

## Prescription
1. **Map what each of the three reviewers actually verifies** — Determine whether they check distinct controls (receipt, budget code, treasury release) or duplicate the same review.
2. **Replace redundant sign-offs on PO-matched invoices with a single owner** — When an invoice matches an approved PO and receiving log within tolerance, require only one exception approver.
3. **Retain multi-reviewer sign-off for high-value or non-PO spend** — Focus senior review capacity on unbudgeted or high-dollar commitments.

## Open question
Are all three reviewers verifying the same fields, or does each reviewer own a separate compliance check?`;
    }
    return `## Reasoning
- **Supplied evidence**: ${evidenceClause}
- **Detected condition**: Operational friction in document-heavy workflows usually concentrates at manual data re-entry, unstandardized intake fields, or multi-step approval queues lacking clear dollar thresholds.
- **Assumption & limitation**: Because only a short text prompt was provided, this diagnosis outlines structural verification steps rather than citing measured savings.

## Prescription
1. **Measure queue wait time vs. active touch time** — Log timestamps at intake, first review, exception hold, and final approval to locate the primary bottleneck.
2. **Standardize required intake fields** — Enforce counterparty ID, reference/PO number, and effective dates before routing items to reviewers.
3. **Separate routine transactions from exceptions** — Define explicit rules for items that can follow a fast-track path versus outliers requiring senior review.

## Open question
Which specific document type (invoices, contracts, or SOPs) and stage of the workflow is causing the most rework right now?`;
}
function parseCurrencyValue(raw) {
    if (!raw)
        return null;
    const cleaned = raw.replace(/[^0-9.-]/g, "");
    if (!cleaned)
        return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
}
export function analyzeDocumentDeterministic(docText, docTypeHint) {
    const lower = docText.toLowerCase();
    const wordCount = docText.split(/\s+/).filter(Boolean).length;
    let detectedType = docTypeHint === "auto" ? "other" : docTypeHint;
    if (docTypeHint === "auto") {
        if (lower.includes("invoice") ||
            lower.includes("subtotal") ||
            lower.includes("bill to") ||
            lower.includes("total due")) {
            detectedType = "invoice";
        }
        else if (lower.includes("agreement") ||
            lower.includes("indemnif") ||
            lower.includes("termination") ||
            lower.includes("governing law") ||
            lower.includes("liability")) {
            detectedType = "contract";
        }
        else if (lower.includes("procedure") ||
            lower.includes("sop") ||
            lower.includes("step 1") ||
            lower.includes("escalation")) {
            detectedType = "sop";
        }
    }
    if (detectedType === "invoice") {
        const invNo = docText.match(/Invoice\s*(?:No|Number|#)\s*[:\-]?\s*([A-Za-z0-9\-]+)/i)?.[1] ??
            null;
        const vendor = docText.match(/Vendor\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
        const billTo = docText.match(/Bill\s*To\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
        const issueDate = docText.match(/Issue\s*Date\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
        const dueDate = docText.match(/Due\s*Date\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
        const terms = docText.match(/Terms\s*[:\-]\s*([^\n\r]+)/i)?.[1]?.trim() ?? null;
        const subtotalStr = docText.match(/Subtotal\s*[:\-]\s*(\$?[\d,]+\.?\d*)/i)?.[1]?.trim() ?? null;
        const taxStr = docText.match(/Tax[^:\n]*[:\-]\s*(\$?[\d,]+\.?\d*)/i)?.[1]?.trim() ?? null;
        const totalStr = docText.match(/Total(?:\s*due)?\s*[:\-]\s*(\$?[\d,]+\.?\d*)/i)?.[1]?.trim() ??
            null;
        const hasTermDrift = lower.includes("net 45") && lower.includes("net 30");
        const hasUndeclaredSurcharge = lower.includes("surcharge") &&
            (lower.includes("undeclared") || lower.includes("not present on prior"));
        const explicitNoPo = lower.includes("no po referenced") || lower.includes("no po");
        const poMatch = docText.match(/\bPO\s*(?:#|No|Number)?\s*[:\-]\s*([A-Za-z0-9\-]+)/i);
        const hasMissingPo = explicitNoPo || !poMatch;
        // Programmatic arithmetic verification when subtotal, tax, and total are present
        const subtotalNum = parseCurrencyValue(subtotalStr);
        const taxNum = parseCurrencyValue(taxStr);
        const totalNum = parseCurrencyValue(totalStr);
        let mathMismatchNote = null;
        if (subtotalNum !== null && taxNum !== null && totalNum !== null) {
            const expectedTotal = Math.round((subtotalNum + taxNum) * 100) / 100;
            const actualTotal = Math.round(totalNum * 100) / 100;
            if (Math.abs(expectedTotal - actualTotal) > 0.02) {
                mathMismatchNote = `Subtotal (${subtotalStr}) + Tax (${taxStr}) equals ${expectedTotal.toFixed(2)}, which does not match stated Total (${totalStr}).`;
            }
        }
        const keyFields = [];
        if (vendor)
            keyFields.push({ label: "Vendor", value: vendor, flagged: false });
        if (invNo)
            keyFields.push({ label: "Invoice number", value: invNo, flagged: false });
        if (billTo)
            keyFields.push({ label: "Bill to", value: billTo, flagged: false });
        if (issueDate)
            keyFields.push({ label: "Issue date", value: issueDate, flagged: false });
        if (dueDate)
            keyFields.push({ label: "Due date", value: dueDate, flagged: false });
        if (terms) {
            keyFields.push({
                label: "Payment terms",
                value: terms,
                flagged: hasTermDrift,
                note: hasTermDrift
                    ? "Document notes payment terms shifted from Net 30 to Net 45"
                    : undefined,
            });
        }
        if (subtotalStr)
            keyFields.push({ label: "Subtotal", value: subtotalStr, flagged: false });
        if (taxStr)
            keyFields.push({ label: "Tax", value: taxStr, flagged: false });
        if (totalStr) {
            keyFields.push({
                label: "Total due",
                value: totalStr,
                flagged: Boolean(hasUndeclaredSurcharge || mathMismatchNote),
                note: mathMismatchNote ??
                    (hasUndeclaredSurcharge
                        ? "Includes surcharge line item flagged in document notes"
                        : undefined),
            });
        }
        if (hasMissingPo) {
            keyFields.push({
                label: "PO reference",
                value: "Not found in document",
                flagged: true,
                note: "No Purchase Order number detected for 3-way match verification",
            });
        }
        else if (poMatch?.[1]) {
            keyFields.push({
                label: "PO reference",
                value: poMatch[1],
                flagged: false,
            });
        }
        const anomalies = [];
        if (mathMismatchNote) {
            anomalies.push({
                title: "Invoice total arithmetic discrepancy",
                severity: "high",
                note: mathMismatchNote,
            });
        }
        if (hasUndeclaredSurcharge) {
            anomalies.push({
                title: "Uncontracted or undeclared surcharge line item",
                severity: "high",
                note: "Document contains a surcharge line item explicitly noted as undeclared or absent from prior invoices.",
            });
        }
        if (hasTermDrift) {
            anomalies.push({
                title: "Payment terms modification (Net 30 to Net 45)",
                severity: "medium",
                note: "Document text indicates Net terms were changed from Net 30 to Net 45; verify whether procurement approved this change.",
            });
        }
        if (hasMissingPo) {
            anomalies.push({
                title: "Missing Purchase Order (PO) reference",
                severity: "high",
                note: "No PO identifier is present in the supplied text, preventing automated 3-way match against an approved purchase order.",
            });
        }
        const recommendations = [];
        if (hasUndeclaredSurcharge || mathMismatchNote) {
            recommendations.push({
                title: "Hold disputed or unverified line items pending vendor documentation",
                rationale: "Request written rate-card authorization or a corrected invoice from the vendor before approving the full billed amount.",
                estHoursRecovered: null,
            });
        }
        if (hasMissingPo) {
            recommendations.push({
                title: "Require a valid PO reference before routing to approval",
                rationale: "Obtain a purchase order number or department-head sign-off so the invoice can be matched against authorized spend.",
                estHoursRecovered: null,
            });
        }
        if (hasTermDrift) {
            recommendations.push({
                title: "Verify payment terms against the master vendor record",
                rationale: "Confirm whether the Net terms change in the document matches an executed contract amendment.",
                estHoursRecovered: null,
            });
        }
        if (recommendations.length === 0) {
            recommendations.push({
                title: "Verify extracted fields against your Purchase Order and receiving log",
                rationale: "Complete standard 3-way match verification before scheduling payment release.",
                estHoursRecovered: null,
            });
        }
        return {
            docType: "invoice",
            summary: `Parsed supplied invoice text (${wordCount} words)${vendor ? ` from ${vendor}` : ""}${invNo ? ` (${invNo})` : ""}${totalStr ? ` with stated total ${totalStr}` : ""}. Surfaced ${anomalies.length} condition(s) directly from the provided text.`,
            keyFields: keyFields.length > 0
                ? keyFields
                : [
                    {
                        label: "Word count",
                        value: `${wordCount} words`,
                        flagged: false,
                    },
                ],
            anomalies,
            recommendations,
        };
    }
    // Deterministic parsing for Contract, SOP, or general business text
    const hasLiabilityMention = lower.includes("liability") || lower.includes("indemnif");
    const hasAutoRenew = lower.includes("auto-renew") || lower.includes("automatic renewal");
    const hasSlaMention = lower.includes("sla") || lower.includes("service level");
    const keyFields = [
        { label: "Detected type", value: detectedType.toUpperCase(), flagged: false },
        { label: "Supplied word count", value: `${wordCount} words`, flagged: false },
        {
            label: "Liability / indemnity clauses",
            value: hasLiabilityMention ? "Present in text" : "Not detected in text",
            flagged: !hasLiabilityMention && detectedType === "contract",
            note: !hasLiabilityMention && detectedType === "contract"
                ? "No explicit limitation of liability or indemnity keywords found in the supplied excerpt"
                : undefined,
        },
    ];
    const anomalies = [];
    if (hasAutoRenew) {
        anomalies.push({
            title: "Automatic renewal clause detected",
            severity: "medium",
            note: "The supplied text references automatic renewal; verify the required notice window prior to renewal.",
        });
    }
    if (wordCount < 25) {
        anomalies.push({
            title: "Short document excerpt provided",
            severity: "low",
            note: `Only ${wordCount} words were supplied. Provide the full document text to extract complete terms and clauses.`,
        });
    }
    const recommendations = [
        {
            title: "Review extracted clauses against your internal approval checklist",
            rationale: hasSlaMention || hasLiabilityMention
                ? "Verify that the stated liability, SLA, and commercial terms align with your organization's standard tolerances."
                : "Confirm key dates, counterparties, and escalation owners before final sign-off.",
            estHoursRecovered: null,
        },
    ];
    return {
        docType: detectedType,
        summary: `Analyzed supplied ${detectedType.toUpperCase()} text (${wordCount} words) using deterministic rule extraction. Only fields and clauses explicitly present in the input are reported.`,
        keyFields,
        anomalies,
        recommendations,
    };
}
/**
 * Strictly validates and normalizes untrusted JSON returned by an LLM.
 * Strips unexpected properties, enforces array/string bounds, and guarantees valid enum values.
 */
export function normalizeAnalysisPayload(rawObj, docTypeHint) {
    const validDocTypes = new Set(["invoice", "contract", "sop", "other"]);
    const rawDocType = typeof rawObj.docType === "string" ? rawObj.docType.trim().toLowerCase() : "";
    const docType = (validDocTypes.has(rawDocType)
        ? rawDocType
        : docTypeHint === "auto"
            ? "other"
            : docTypeHint);
    const summary = typeof rawObj.summary === "string" && rawObj.summary.trim()
        ? rawObj.summary.trim().slice(0, 600)
        : "Cadence analyzed the supplied document and extracted the fields and conditions below.";
    const keyFields = Array.isArray(rawObj.keyFields)
        ? rawObj.keyFields
            .filter((f) => !!f && typeof f === "object" && !Array.isArray(f))
            .slice(0, 12)
            .map((f) => ({
            label: String(f.label ?? "Field").trim().slice(0, 80) || "Field",
            value: f.value != null ? String(f.value).trim().slice(0, 200) || "—" : "—",
            flagged: Boolean(f.flagged),
            note: typeof f.note === "string" && f.note.trim()
                ? f.note.trim().slice(0, 240)
                : undefined,
        }))
        : [];
    const anomalies = Array.isArray(rawObj.anomalies)
        ? rawObj.anomalies
            .filter((a) => !!a && typeof a === "object" && !Array.isArray(a))
            .slice(0, 8)
            .map((a) => {
            const sevRaw = typeof a.severity === "string" ? a.severity.trim().toLowerCase() : "low";
            const severity = sevRaw === "high" || sevRaw === "medium" ? sevRaw : "low";
            return {
                title: String(a.title ?? "Detected condition").trim().slice(0, 140) || "Detected condition",
                severity,
                note: String(a.note ?? "").trim().slice(0, 320),
            };
        })
        : [];
    const recommendations = Array.isArray(rawObj.recommendations)
        ? rawObj.recommendations
            .filter((r) => !!r && typeof r === "object" && !Array.isArray(r))
            .slice(0, 6)
            .map((r) => ({
            title: String(r.title ?? "Recommended action").trim().slice(0, 140) || "Recommended action",
            rationale: String(r.rationale ?? "").trim().slice(0, 320),
            estHoursRecovered: typeof r.estHoursRecovered === "string" && r.estHoursRecovered.trim()
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
