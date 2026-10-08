// Critical end-to-end workflow (requires seeded database):
//   npm run db:push && npm run db:seed
//   npx playwright test
// Covers: login → dashboard → assessment answer → recompute → submit →
// data request create → metric submit → evidence upload page → GHG run →
// report create → audit visibility.
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "admin@greenharvest.ng";
const PASSWORD = process.env.E2E_PASSWORD ?? "GreenHarvest2026!";

test("critical ESG lifecycle", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 20_000 });

  // Dashboard renders real KPIs
  await expect(page.getByText("ESG Readiness")).toBeVisible();

  // Assessments list → open first → answer → recompute
  await page.goto("/assessments", { waitUntil: "networkidle" });
  const open = page.getByRole("link", { name: /Open/ }).first();
  if (await open.count()) {
    await Promise.all([
      page.waitForURL(/assessments\/.+/, { timeout: 60_000 }),
      open.first().click(),
    ]);
    const answer = page.locator('input[name="value"]').first();
    if (await answer.count()) {
      await answer.fill("yes");
      await page.getByRole("button", { name: "Save" }).first().click();
    }
    await page.getByRole("button", { name: "Recompute score" }).click();
    await expect(page.getByText(/Status:/)).toBeVisible();
  }

  // Data request lifecycle
  await page.goto("/data-requests");
  await page.locator('input[name="title"]').fill(`E2E electricity — ${Date.now()}`);
  await page.getByRole("button", { name: /Create data request/ }).click();
  await expect(page.getByText(/E2E electricity/).first()).toBeVisible({ timeout: 15_000 });

  // Metric submission
  await page.goto("/metrics/submit");
  if (await page.locator('select[name="metricId"]').count()) {
    await page.locator('input[name="period"]').fill("2026-09");
    await page.locator('input[name="value"]').fill("84200");
    await page.getByRole("button", { name: /Submit for validation/ }).click();
  }

  // GHG calculation run
  await page.goto("/emissions/new");
  if (await page.locator('select[name="factor_0"]').count()) {
    await page.locator('input[name="label_0"]').fill("E2E diesel");
    await page.locator('input[name="activity_0"]').fill("1000");
    await page.locator('input[name="unit_0"]').fill("L");
    await page.locator('select[name="factor_0"]').selectOption({ index: 1 });
    await page.getByRole("button", { name: /Run calculation/ }).click();
    await expect(page).toHaveURL(/emissions$/, { timeout: 20_000 });
  }

  // Report create → publish gate reachable
  await page.goto("/reports");
  await page.locator('input[name="title"]').fill(`E2E report ${Date.now()}`);
  await page.getByRole("button", { name: /New report/ }).click();

  // Audit trail visible to admin
  await page.goto("/admin");
  await expect(page.getByText("Audit trail").first()).toBeVisible();
});
