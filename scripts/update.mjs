// Rebuilds README.md from FirstHire's list of open entry-level US jobs at H-1B sponsors.
// Runs every day in GitHub Actions (.github/workflows/update.yml); no dependencies, Node 20+.
import { readFile, writeFile } from "node:fs/promises";

const FEED = process.env.FEED || "https://getfirsthire.com/api/h1b-jobs.json";
const START = "<!-- JOBS:START -->";
const END = "<!-- JOBS:END -->";
const MAX_ROWS = 200;

const res = await fetch(FEED, { headers: { "User-Agent": "new-grad-h1b-jobs-updater" } });
if (!res.ok) throw new Error(`feed returned ${res.status}`);
const data = await res.json();
if (!Array.isArray(data.jobs)) throw new Error("feed has no jobs");

// Table cells can't hold pipes or line breaks
const cell = (s) => String(s ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
const age = (iso) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  return days <= 0 ? "Today" : `${days}d`;
};

function table(jobs) {
  if (!jobs.length) return "_No open roles right now. The list updates every day._\n";
  const rows = jobs.slice(0, MAX_ROWS).map((j) =>
    `| **${cell(j.company)}** | ${cell(j.title)} | ${cell(j.location)} | [${j.sponsor.entryFilings.toLocaleString("en-US")}](${j.sponsor.url}) | ${age(j.postedAt)} | [Apply](${j.url}) |`,
  );
  return ["| Company | Role | Location | Entry-level H-1B filings | Posted | Link |", "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n") + "\n";
}

const jobs = data.jobs;
const newGrad = jobs.filter((j) => !j.internship);
const interns = jobs.filter((j) => j.internship);
const updated = new Date(data.updatedAt).toUTCString().replace(/:\d\d GMT$/, " UTC");
const block = [
  START,
  `**${jobs.length} open roles** at ${new Set(jobs.map((j) => j.sponsor.name)).size} companies · updated ${updated}`,
  "",
  `## New grad & entry-level (${newGrad.length})`,
  "",
  table(newGrad),
  `## Internships (${interns.length})`,
  "",
  table(interns),
  data.h1bData ? `<sub>H-1B counts: certified Labor Condition Applications at the entry-level wage (Level I) for new hires, ${data.h1bData.label}, from the ${data.h1bData.source}. A filing record is not a promise to sponsor; confirm with the recruiter.</sub>` : "",
  END,
].join("\n");

const readme = await readFile("README.md", "utf8");
const i = readme.indexOf(START);
const k = readme.indexOf(END);
if (i < 0 || k < 0) throw new Error("README markers missing");
await writeFile("README.md", readme.slice(0, i) + block + readme.slice(k + END.length));
console.log(`README updated: ${newGrad.length} new grad, ${interns.length} internships`);
