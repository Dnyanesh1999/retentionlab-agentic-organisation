import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const GENERATOR_KEY = "retentionlab-demo-v1";
const GENERATOR_VERSION = "1.0.0";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function choice(random, values) {
  return values[Math.floor(random() * values.length)];
}

function between(random, minimum, maximum, decimals = 0) {
  const value = minimum + random() * (maximum - minimum);
  return Number(value.toFixed(decimals));
}

function daysFrom(anchor, offset) {
  const value = new Date(anchor);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString();
}

function dateOnly(timestamp) {
  return timestamp.slice(0, 10);
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function buildDemoDataset({ seed = 20260805, generatedAt = new Date().toISOString() } = {}) {
  const random = seededRandom(seed);
  const generationRunId = randomUUID();
  const accountNames = [
    "Northstar Loom",
    "Copper Finch",
    "Juniper Atlas",
    "Lantern Metric",
    "Marble Current",
    "Orbit & Pine",
    "Signal Harbour",
    "Willow Circuit",
  ];
  const sectors = ["Logistics", "Fintech", "Climate software", "Health operations", "Retail analytics"];
  const regions = ["Ireland", "United Kingdom", "DACH", "Nordics", "Benelux"];
  const productSignals = [];
  const billingEvents = [];
  const supportEvents = [];
  const consentPreferences = [];

  const accounts = accountNames.map((displayName, accountIndex) => {
    const id = randomUUID();
    const slug = slugify(displayName);
    const planTier = choice(random, ["Scale", "Growth", "Enterprise"]);
    const lifecycleStage = choice(random, ["adopted", "at_risk", "renewal"]);
    const seatsPurchased = Math.round(between(random, 30, 420));
    const activeUsers = Math.max(5, Math.round(seatsPurchased * between(random, 0.28, 0.93, 3)));
    const observedAt = daysFrom(generatedAt, -between(random, 1, 5));

    const signalDefinitions = [
      ["active_users", activeUsers, "count", Math.round(activeUsers * between(random, 1.04, 1.35, 3))],
      ["feature_adoption", between(random, 19, 91, 2), "percent", between(random, 24, 94, 2)],
      ["session_frequency", between(random, 0.8, 6.4, 2), "sessions_per_user", between(random, 1.1, 7, 2)],
      ["seat_utilisation", Number(((activeUsers / seatsPurchased) * 100).toFixed(2)), "percent", null],
    ];

    for (const [signalType, metricValue, unit, comparisonValue] of signalDefinitions) {
      productSignals.push({
        id: randomUUID(),
        account_id: id,
        evidence_key: `product:${slug}:${signalType}:${accountIndex + 1}`,
        signal_type: signalType,
        metric_value: metricValue,
        unit,
        comparison_value: comparisonValue,
        comparison_window: comparisonValue === null ? null : "previous_30_days",
        observed_at: observedAt,
        source_updated_at: generatedAt,
        metadata: { synthetic: true, aggregation: "account_level" },
      });
    }

    const paymentFailed = lifecycleStage === "at_risk" && random() > 0.35;
    billingEvents.push(
      {
        id: randomUUID(),
        account_id: id,
        evidence_key: `billing:${slug}:invoice:${accountIndex + 1}`,
        event_type: "invoice_issued",
        status: paymentFailed ? "open" : "paid",
        amount: between(random, 1800, 14500, 2),
        currency: "EUR",
        occurred_at: daysFrom(generatedAt, -28),
        source_updated_at: generatedAt,
      },
      {
        id: randomUUID(),
        account_id: id,
        evidence_key: `billing:${slug}:payment:${accountIndex + 1}`,
        event_type: paymentFailed ? "payment_failed" : "payment_succeeded",
        status: paymentFailed ? "failed" : "paid",
        amount: between(random, 1800, 14500, 2),
        currency: "EUR",
        occurred_at: daysFrom(generatedAt, -25),
        source_updated_at: generatedAt,
      },
    );

    for (let supportIndex = 0; supportIndex < 2; supportIndex += 1) {
      const resolved = supportIndex === 1 || random() > 0.56;
      const occurredAt = daysFrom(generatedAt, -(7 + accountIndex * 2 + supportIndex * 9));
      const category = choice(random, ["integration", "workflow", "billing", "performance", "access"]);
      supportEvents.push({
        id: randomUUID(),
        account_id: id,
        evidence_key: `support:${slug}:${accountIndex + 1}-${supportIndex + 1}`,
        category,
        severity: choice(random, resolved ? ["low", "medium", "high"] : ["medium", "high", "critical"]),
        status: resolved ? "resolved" : "open",
        sentiment_score: between(random, -0.9, resolved ? 0.5 : -0.1, 3),
        summary: `Synthetic ${category} case used to test evidence-grounded recovery decisions.`,
        occurred_at: occurredAt,
        resolved_at: resolved ? daysFrom(occurredAt, between(random, 1, 4)) : null,
        source_updated_at: generatedAt,
      });
    }

    const outreachAllowed = random() > 0.18;
    consentPreferences.push({
      account_id: id,
      evidence_key: `preference:${slug}:${accountIndex + 1}`,
      allow_product_email: outreachAllowed,
      allow_recovery_outreach: outreachAllowed,
      allow_usage_personalisation: random() > 0.3,
      preferred_channel: outreachAllowed ? choice(random, ["email", "in_app"]) : "none",
      lawful_basis: outreachAllowed ? "consent" : "contract",
      source_updated_at: generatedAt,
    });

    return {
      id,
      generation_run_id: generationRunId,
      slug,
      display_name: displayName,
      sector: choice(random, sectors),
      plan_tier: planTier,
      lifecycle_stage: lifecycleStage,
      seats_purchased: seatsPurchased,
      monthly_recurring_revenue: between(random, 1800, 14500, 2),
      contract_currency: "EUR",
      renewal_at: dateOnly(daysFrom(generatedAt, between(random, 18, 150))),
      region: choice(random, regions),
      synthetic: true,
      source_updated_at: generatedAt,
    };
  });

  const vendorStatusEvents = ["identity", "billing", "messaging", "analytics"].map((serviceName, index) => {
    const degraded = index === Math.floor(random() * 4);
    const startedAt = daysFrom(generatedAt, -(index + 1));
    return {
      id: randomUUID(),
      generation_run_id: generationRunId,
      evidence_key: `vendor:${serviceName}:${index + 1}`,
      vendor_key: `fictional-${serviceName}-provider`,
      service_name: serviceName,
      status: degraded ? "degraded" : "operational",
      incident_key: degraded ? `SYN-${seed}-${index + 1}` : null,
      summary: degraded
        ? `Synthetic ${serviceName} latency event for recovery-planning scenarios.`
        : `Synthetic ${serviceName} service operating normally.`,
      started_at: startedAt,
      resolved_at: null,
      source_updated_at: generatedAt,
    };
  });

  const rowCounts = {
    accounts: accounts.length,
    product_signals: productSignals.length,
    billing_events: billingEvents.length,
    support_events: supportEvents.length,
    consent_preferences: consentPreferences.length,
    vendor_status_events: vendorStatusEvents.length,
  };

  return {
    run: {
      id: generationRunId,
      generator_key: GENERATOR_KEY,
      generator_version: GENERATOR_VERSION,
      seed,
      status: "loading",
      generated_at: generatedAt,
    },
    accounts,
    productSignals,
    billingEvents,
    supportEvents,
    consentPreferences,
    vendorStatusEvents,
    rowCounts,
  };
}

async function writeRows({ supabaseUrl, secretKey, table, method = "POST", rows, query = "" }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: secretKey,
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: rows === undefined ? undefined : JSON.stringify(rows),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    throw new Error(`${method} ${table} failed (${response.status}): ${detail}`);
  }
}

export async function publishDemoDataset({ supabaseUrl, secretKey, dataset }) {
  let runCreated = false;
  try {
    await writeRows({ supabaseUrl, secretKey, table: "demo_generation_runs", rows: dataset.run });
    runCreated = true;
    await writeRows({ supabaseUrl, secretKey, table: "accounts", rows: dataset.accounts });
    await writeRows({ supabaseUrl, secretKey, table: "product_signals", rows: dataset.productSignals });
    await writeRows({ supabaseUrl, secretKey, table: "billing_events", rows: dataset.billingEvents });
    await writeRows({ supabaseUrl, secretKey, table: "support_events", rows: dataset.supportEvents });
    await writeRows({ supabaseUrl, secretKey, table: "consent_preferences", rows: dataset.consentPreferences });
    await writeRows({ supabaseUrl, secretKey, table: "vendor_status_events", rows: dataset.vendorStatusEvents });
    await writeRows({
      supabaseUrl,
      secretKey,
      table: "demo_generation_runs",
      method: "PATCH",
      query: `?id=eq.${dataset.run.id}`,
      rows: { status: "ready", completed_at: new Date().toISOString(), row_counts: dataset.rowCounts },
    });
    await writeRows({
      supabaseUrl,
      secretKey,
      table: "demo_generation_runs",
      method: "DELETE",
      query: `?generator_key=eq.${GENERATOR_KEY}&status=eq.ready&id=neq.${dataset.run.id}`,
    });
  } catch (error) {
    if (runCreated) {
      await writeRows({
        supabaseUrl,
        secretKey,
        table: "demo_generation_runs",
        method: "PATCH",
        query: `?id=eq.${dataset.run.id}`,
        rows: {
          status: "failed",
          completed_at: new Date().toISOString(),
          failure_reason: error instanceof Error ? error.message.slice(0, 400) : "Unknown publishing error",
        },
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required server-side environment variables.");
  }

  const seed = Number(process.env.DEMO_DATA_SEED ?? 20260805);
  if (!Number.isSafeInteger(seed)) {
    throw new Error("DEMO_DATA_SEED must be a safe integer.");
  }

  const dataset = buildDemoDataset({ seed });
  await publishDemoDataset({ supabaseUrl: supabaseUrl.replace(/\/$/, ""), secretKey, dataset });
  process.stdout.write(`Published ${dataset.accounts.length} fictional accounts in run ${dataset.run.id}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
