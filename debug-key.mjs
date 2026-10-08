import { chromium } from "playwright";

const BASE = "http://localhost:5175";
const shots = "/private/tmp/claude-501/-Users-ephraimnetshikweta-Downloads-app/0bf895dc-7a53-4847-b34a-3ccdd31d00ae/scratchpad";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => errors.push(`[${msg.type()}] ${msg.text()}`));

await page.goto(`${BASE}/platform`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Platform access");

const input = page.getByLabel("Platform key");
await input.click();
await page.keyboard.type("dev-platform-key", { delay: 30 });

const typedValue = await input.inputValue();
console.log("Value actually in the input field:", JSON.stringify(typedValue));
console.log("Value length:", typedValue.length, "expected length:", "dev-platform-key".length);

await page.screenshot({ path: `${shots}/debug1-before-submit.png` });

await page.getByRole("button", { name: "Continue" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${shots}/debug2-after-submit.png` });

const bodyText = await page.textContent("body");
console.log("Contains 'Invalid platform key':", bodyText.includes("Invalid platform key"));
console.log("Contains 'Organizations' (success):", bodyText.includes("Organizations"));

console.log("All console/page messages:", errors);
await browser.close();
