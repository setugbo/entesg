import { test } from "@playwright/test";

test("screenshots", async ({ page }) => {
  await page.goto("https://entesg.vercel.app/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "shot-landing.png" });
  await page.goto("https://entesg.vercel.app/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: "shot-login.png" });
  await page.locator('input[name="email"]').fill("admin@greenharvest.ng");
  await page.locator('input[name="password"]').fill("GreenHarvest2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard/, { timeout: 60_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "shot-dashboard.png", fullPage: true });
  await page.goto("https://entesg.vercel.app/assessments", { waitUntil: "networkidle" });
  await page.screenshot({ path: "shot-assess.png" });
});
