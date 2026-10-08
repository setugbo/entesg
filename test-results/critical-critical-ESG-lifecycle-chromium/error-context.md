# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical.spec.ts >> critical ESG lifecycle
- Location: tests\e2e\critical.spec.ts:12:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Recompute score' })

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - alert [ref=f1e2]: IFRS S1/S2 Readiness — Q3 2026 (preview)
  - generic [ref=f1e3]:
    - complementary [ref=f1e4]:
      - generic [ref=f1e5]:
        - generic [ref=f1e6]: eE
        - generic [ref=f1e7]:
          - paragraph [ref=f1e8]: entESG
          - paragraph [ref=f1e9]: Enterprise ESG Platform
      - navigation [ref=f1e10]:
        - generic [ref=f1e11]:
          - paragraph [ref=f1e12]: Overview
          - generic [ref=f1e13]:
            - link "Dashboard" [ref=f1e14] [cursor=pointer]:
              - /url: /dashboard
            - link "Tasks & Approvals" [ref=f1e20] [cursor=pointer]:
              - /url: /tasks
            - link "Notifications" [ref=f1e23] [cursor=pointer]:
              - /url: /notifications
        - generic [ref=f1e27]:
          - paragraph [ref=f1e28]: Assess & Plan
          - generic [ref=f1e29]:
            - link "Assessments" [ref=f1e30] [cursor=pointer]:
              - /url: /assessments
            - link "Frameworks" [ref=f1e35] [cursor=pointer]:
              - /url: /frameworks
            - link "Requirements" [ref=f1e38] [cursor=pointer]:
              - /url: /requirements
            - link "Disclosures" [ref=f1e42] [cursor=pointer]:
              - /url: /disclosures
            - link "Materiality" [ref=f1e47] [cursor=pointer]:
              - /url: /materiality
        - generic [ref=f1e51]:
          - paragraph [ref=f1e52]: Collect & Validate
          - generic [ref=f1e53]:
            - link "Metrics" [ref=f1e54] [cursor=pointer]:
              - /url: /metrics
            - link "Data Requests" [ref=f1e59] [cursor=pointer]:
              - /url: /data-requests
            - link "Evidence" [ref=f1e63] [cursor=pointer]:
              - /url: /evidence
            - link "Data Lineage" [ref=f1e68] [cursor=pointer]:
              - /url: /lineage
        - generic [ref=f1e71]:
          - paragraph [ref=f1e72]: Environmental
          - generic [ref=f1e73]:
            - link "GHG & Emissions" [ref=f1e74] [cursor=pointer]:
              - /url: /emissions
            - link "Energy" [ref=f1e77] [cursor=pointer]:
              - /url: /energy
            - link "Water" [ref=f1e80] [cursor=pointer]:
              - /url: /water
            - link "Waste" [ref=f1e84] [cursor=pointer]:
              - /url: /waste
        - generic [ref=f1e89]:
          - paragraph [ref=f1e90]: Social & Governance
          - generic [ref=f1e91]:
            - link "Social" [ref=f1e92] [cursor=pointer]:
              - /url: /social
            - link "Governance" [ref=f1e98] [cursor=pointer]:
              - /url: /governance
            - link "Risks" [ref=f1e102] [cursor=pointer]:
              - /url: /risks
            - link "Opportunities" [ref=f1e105] [cursor=pointer]:
              - /url: /opportunities
            - link "Controls" [ref=f1e111] [cursor=pointer]:
              - /url: /controls
        - generic [ref=f1e115]:
          - paragraph [ref=f1e116]: Strategy & Disclosure
          - generic [ref=f1e117]:
            - link "Targets" [ref=f1e118] [cursor=pointer]:
              - /url: /targets
            - link "Net Zero" [ref=f1e123] [cursor=pointer]:
              - /url: /net-zero
            - link "CapEx Alignment" [ref=f1e129] [cursor=pointer]:
              - /url: /capex
            - link "Reports" [ref=f1e133] [cursor=pointer]:
              - /url: /reports
            - link "Assurance" [ref=f1e137] [cursor=pointer]:
              - /url: /assurance
        - generic [ref=f1e141]:
          - paragraph [ref=f1e142]: Manage
          - generic [ref=f1e143]:
            - link "Organisation" [ref=f1e144] [cursor=pointer]:
              - /url: /organisations
            - link "Consultant" [ref=f1e149] [cursor=pointer]:
              - /url: /consultant
            - link "Admin & Audit" [ref=f1e154] [cursor=pointer]:
              - /url: /admin
            - link "Settings" [ref=f1e158] [cursor=pointer]:
              - /url: /settings
      - generic [ref=f1e162]: Readiness ≠ legal compliance.Requires SME validation.
    - generic [ref=f1e163]:
      - banner [ref=f1e164]:
        - generic [ref=f1e165]: GreenHarvest Foods Nigeria Ltd.Lagos · Ogun · Abuja
        - button "Adaeze Okafor · ORGANISATION_ADMIN — Sign out" [ref=f1e168]
      - navigation [ref=f1e169]:
        - link "Dashboard" [ref=f1e170] [cursor=pointer]:
          - /url: /dashboard
        - link "Tasks & Approvals" [ref=f1e171] [cursor=pointer]:
          - /url: /tasks
        - link "Notifications" [ref=f1e172] [cursor=pointer]:
          - /url: /notifications
        - link "Assessments" [ref=f1e173] [cursor=pointer]:
          - /url: /assessments
        - link "Frameworks" [ref=f1e174] [cursor=pointer]:
          - /url: /frameworks
        - link "Requirements" [ref=f1e175] [cursor=pointer]:
          - /url: /requirements
        - link "Disclosures" [ref=f1e176] [cursor=pointer]:
          - /url: /disclosures
        - link "Materiality" [ref=f1e177] [cursor=pointer]:
          - /url: /materiality
      - main [ref=f1e178]:
        - generic [ref=f1e180]:
          - heading "IFRS S1/S2 Readiness — Q3 2026 (preview)" [level=1] [ref=f1e181]
          - paragraph [ref=f1e182]: Connect DATABASE_URL to run the live assessment workflow end-to-end.
        - table [ref=f1e185]:
          - rowgroup [ref=f1e186]:
            - row [ref=f1e187]:
              - columnheader "Question" [ref=f1e188]
              - columnheader "Type" [ref=f1e189]
              - columnheader "Evidence" [ref=f1e190]
          - rowgroup [ref=f1e191]:
            - row [ref=f1e192]:
              - cell "GOV-01 — Board oversight defined?" [ref=f1e193]
              - cell "yes/no" [ref=f1e194]
              - cell "required" [ref=f1e195]
            - row [ref=f1e196]:
              - cell "MET-01 — Scope 1 by source?" [ref=f1e197]
              - cell "metric" [ref=f1e198]
              - cell "required" [ref=f1e199]
            - row [ref=f1e200]:
              - cell "EVI-01 — Attach supporting file" [ref=f1e201]
              - cell "evidence" [ref=f1e202]
              - cell "required" [ref=f1e203]
```

# Test source

```ts
  1  | // Critical end-to-end workflow (requires seeded database):
  2  | //   npm run db:push && npm run db:seed
  3  | //   npx playwright test
  4  | // Covers: login → dashboard → assessment answer → recompute → submit →
  5  | // data request create → metric submit → evidence upload page → GHG run →
  6  | // report create → audit visibility.
  7  | import { test, expect } from "@playwright/test";
  8  | 
  9  | const EMAIL = process.env.E2E_EMAIL ?? "admin@greenharvest.ng";
  10 | const PASSWORD = process.env.E2E_PASSWORD ?? "GreenHarvest2026!";
  11 | 
  12 | test("critical ESG lifecycle", async ({ page }) => {
  13 |   await page.goto("/login");
  14 |   await page.locator('input[name="email"]').fill(EMAIL);
  15 |   await page.locator('input[name="password"]').fill(PASSWORD);
  16 |   await page.getByRole("button", { name: "Sign in" }).click();
  17 |   await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 });
  18 | 
  19 |   // Dashboard renders real KPIs
  20 |   await expect(page.getByText("ESG Readiness")).toBeVisible();
  21 | 
  22 |   // Assessments list → open first → answer → recompute
  23 |   await page.goto("/assessments");
  24 |   const open = page.getByRole("link", { name: /Open/ }).first();
  25 |   if (await open.count()) {
  26 |     await open.first().click();
  27 |     const answer = page.locator('input[name="value"]').first();
  28 |     if (await answer.count()) {
  29 |       await answer.fill("yes");
  30 |       await page.getByRole("button", { name: "Save" }).first().click();
  31 |     }
> 32 |     await page.getByRole("button", { name: "Recompute score" }).click();
     |                                                                 ^ Error: locator.click: Test timeout of 60000ms exceeded.
  33 |     await expect(page.getByText(/Status:/)).toBeVisible();
  34 |   }
  35 | 
  36 |   // Data request lifecycle
  37 |   await page.goto("/data-requests");
  38 |   await page.locator('input[name="title"]').fill(`E2E electricity — ${Date.now()}`);
  39 |   await page.getByRole("button", { name: /Create data request/ }).click();
  40 |   await expect(page.getByText(/E2E electricity/).first()).toBeVisible({ timeout: 15_000 });
  41 | 
  42 |   // Metric submission
  43 |   await page.goto("/metrics/submit");
  44 |   if (await page.locator('select[name="metricId"]').count()) {
  45 |     await page.locator('input[name="period"]').fill("2026-09");
  46 |     await page.locator('input[name="value"]').fill("84200");
  47 |     await page.getByRole("button", { name: /Submit for validation/ }).click();
  48 |   }
  49 | 
  50 |   // GHG calculation run
  51 |   await page.goto("/emissions/new");
  52 |   if (await page.locator('select[name="factor_0"]').count()) {
  53 |     await page.locator('input[name="label_0"]').fill("E2E diesel");
  54 |     await page.locator('input[name="activity_0"]').fill("1000");
  55 |     await page.locator('input[name="unit_0"]').fill("L");
  56 |     await page.locator('select[name="factor_0"]').selectOption({ index: 1 });
  57 |     await page.getByRole("button", { name: /Run calculation/ }).click();
  58 |     await expect(page).toHaveURL(/emissions$/, { timeout: 20_000 });
  59 |   }
  60 | 
  61 |   // Report create → publish gate reachable
  62 |   await page.goto("/reports");
  63 |   await page.locator('input[name="title"]').fill(`E2E report ${Date.now()}`);
  64 |   await page.getByRole("button", { name: /New report/ }).click();
  65 | 
  66 |   // Audit trail visible to admin
  67 |   await page.goto("/admin");
  68 |   await expect(page.getByText("Audit trail").first()).toBeVisible();
  69 | });
  70 | 
```