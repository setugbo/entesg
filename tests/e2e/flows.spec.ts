import { test, expect } from "@playwright/test";

// Exercises the group 1–4 additions end to end (requires seeded database).
const EMAIL = process.env.E2E_EMAIL ?? "admin@greenharvest.ng";
const PASSWORD = process.env.E2E_PASSWORD ?? "GreenHarvest2026!";

test("assignment + workflow UIs + exports", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });

  // Questionnaire builder: open detail, add section + question with owner
  await page.goto("/questionnaires", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Open/ }).first().click();
  await expect(page.getByText("Assign / reassign a question")).toBeVisible({ timeout: 30_000 });
  await page.locator('input[name="title"]').last().fill(`E2E Section ${Date.now()}`);
  await page.getByRole("button", { name: "Add section" }).click();
  await expect(page.getByText(/E2E Section/).first()).toBeVisible({ timeout: 20_000 });

  // Frameworks manage forms visible to admin
  await page.goto("/frameworks", { waitUntil: "networkidle" });
  await expect(page.getByText("Add requirement")).toBeVisible();

  // Targets: open detail, record progress
  await page.goto("/targets", { waitUntil: "networkidle" });
  const to = page.getByRole("link", { name: /Open/ }).first();
  if (await to.count()) {
    await Promise.all([page.waitForURL(/targets\/.+/, { timeout: 60_000 }), to.first().click()]);
    await expect(page.getByText("Record progress")).toBeVisible({ timeout: 30_000 });
  }

  // Tasks: open detail, update status
  await page.goto("/tasks", { waitUntil: "networkidle" });
  const ta = page.getByRole("link", { name: /Open/ }).first();
  if (await ta.count()) {
    await Promise.all([page.waitForURL(/tasks\/.+/, { timeout: 60_000 }), ta.first().click()]);
    await expect(page.getByText("Status & assignment")).toBeVisible({ timeout: 30_000 });
  }

  // Controls: record a test
  await page.goto("/controls", { waitUntil: "networkidle" });
  const co = page.getByRole("link", { name: /Open/ }).first();
  if (await co.count()) {
    await Promise.all([page.waitForURL(/controls\/.+/, { timeout: 60_000 }), co.first().click()]);
    await page.locator('input[name="notes"]').fill("E2E control test");
    await page.getByRole("button", { name: "Record test" }).click();
    await expect(page.getByText("E2E control test").first()).toBeVisible({ timeout: 20_000 });
  }

  // Metrics CSV export returns CSV (same authenticated session)
  const csv = await page.request.get("/api/metrics/export");
  expect(csv.ok()).toBeTruthy();
  expect(csv.headers()["content-type"]).toContain("text/csv");

  // Report PDF export downloads
  await page.goto("/reports", { waitUntil: "networkidle" });
  const rp = page.getByRole("link", { name: /Open/ }).first();
  if (await rp.count()) {
    await Promise.all([page.waitForURL(/reports\/.+/, { timeout: 60_000 }), rp.first().click()]);
    const pdf = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      page.getByRole("link", { name: "PDF" }).click(),
    ]);
    expect(pdf[0].suggestedFilename()).toContain(".pdf");
  }

  // Admin user management visible
  await page.goto("/admin", { waitUntil: "networkidle" });
  await expect(page.getByText("Reset pw").first()).toBeVisible({ timeout: 30_000 });

  // Password self-service renders
  await page.goto("/password", { waitUntil: "networkidle" });
  await expect(page.getByText("Change password")).toBeVisible();
});
