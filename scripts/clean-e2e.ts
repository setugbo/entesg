// Removes rows created by the Playwright E2E spec (E2E-prefixed titles, 2026-09 probe data).
// Usage: npm run e2e:clean   (requires DATABASE_URL)
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15, idle_timeout: 5 });
  try {
    console.log("requests:", (await sql`delete from data_requests where title like 'E2E%'`).count);
    console.log("reports:", (await sql`delete from reports where title like 'E2E%'`).count);
    console.log("metric_values:", (await sql`delete from metric_values where period = '2026-09'`).count);
    console.log("runs:", (await sql`delete from calculation_runs where period = '2026-09'`).count);
    console.log("sections:", (await sql`delete from questionnaire_sections where title like 'E2E%'`).count);
    console.log("control_tests:", (await sql`delete from control_tests where notes like 'E2E%'`).count);
  } finally {
    await sql.end();
  }
  console.log("clean");
}

main();
