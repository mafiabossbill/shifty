/**
 * Design check: the part of the design standard a script can verify
 * (docs/factory/docs/UI_UX_STANDARD.md, "Checked by script").
 *
 *   npm run design:check          report every finding; exit 1 when there are errors
 *   tests/design.test.ts          the same check inside `npm test`, so the Stop hook and CI enforce it
 *
 * It reads class names and styles in src/. It cannot judge hierarchy, wording or layout: those are
 * reviewed against the checklist with screenshots (docs/factory/checklists/design-review.md).
 *
 * An intentional exception needs a reason on the same line or the line above:
 *   // design-ok: <why this one place breaks the rule>
 * or, for a whole file, within its first 12 lines:
 *   // design-ok-file: <why this file is outside the system>
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Level = "error" | "warning";
export type Finding = { rule: string; level: Level; file: string; line: number; found: string; fix: string };
export type Report = { findings: Finding[]; allowed: number; files: number };

type Rule = {
  id: string;
  level: Level;
  /** Matched against each line; every match is one finding. Must be global. */
  pattern: RegExp;
  fix: string;
  /** Which files the rule reads (default: components and pages, not stylesheets). */
  files?: (file: string) => boolean;
  /** Matches that are fine after all. */
  unless?: (match: string, line: string) => boolean;
};

const isCode = (file: string) => /\.(tsx|ts|jsx|js|mdx)$/.test(file);
const isStyle = (file: string) => file.endsWith(".css");
const isTokenSheet = (file: string) => file.endsWith("globals.css");

/** A class name starts here: not in the middle of another word. Variants (`md:`, `dark:`) may precede it. */
const START = "(?<![\\w-])";
/** Tailwind palette families. Only the neutral scale and the status scales are part of the system. */
const OFF_PALETTE = "slate|gray|zinc|stone|orange|yellow|lime|green|teal|cyan|sky|indigo|purple|fuchsia|pink|rose";
const COLOR_PROPS = "bg|text|border|ring|outline|fill|stroke|decoration|divide|from|via|to|shadow|accent|caret|placeholder";
const SPACING = "p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y";

const TYPE_SCALE = "text-micro (phone tab bar), text-caption, text-body, text-title, text-prose, text-heading, text-display";
/** Spacing steps on the scale (×4px): tight inside a group, wider between groups, never a value in between. */
const SPACING_STEPS = new Set(["0", "px", "0.5", "1", "1.5", "2", "3", "4", "6", "8", "12", "16", "20", "24"]);

export const RULES: Rule[] = [
  {
    id: "type-scale",
    level: "error",
    pattern: new RegExp(`${START}text-(?:\\[\\d[\\d.]*(?:px|rem|em|pt)\\]|xs|sm|base|lg|xl|[2-9]xl)(?![\\w-])`, "g"),
    fix: `Font sizes come from the type scale only: ${TYPE_SCALE}.`,
  },
  {
    id: "type-scale",
    level: "error",
    pattern: /font-size\s*:|fontSize\s*:/g,
    fix: `Set sizes with the type-scale classes (${TYPE_SCALE}), not a hand-written font size.`,
    files: (file) => isCode(file) || (isStyle(file) && !isTokenSheet(file)),
  },
  {
    id: "font-weight",
    level: "error",
    pattern: new RegExp(`${START}font-(?:thin|extralight|light|medium|bold|extrabold|black)(?![\\w-])`, "g"),
    fix: "Two weights only: font-normal for text, font-semibold for what must stand out. Rank the rest with colour and size.",
  },
  {
    id: "font-family",
    level: "error",
    pattern: new RegExp(`${START}font-(?:serif|\\[[^\\]]+\\])`, "g"),
    fix: "One typeface (font-sans); font-mono only for code and identifiers.",
  },
  {
    id: "spacing-scale",
    level: "error",
    pattern: new RegExp(`${START}-?(?:${SPACING})-\\[[^\\]]+\\]`, "g"),
    fix: "Spacing comes from the scale (0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 20, 24). Space shows grouping: less inside a group than between groups.",
    unless: (match) => /\[(?:var|calc|env|max|min|clamp)\(/.test(match),
  },
  {
    id: "spacing-scale",
    level: "error",
    pattern: new RegExp(`${START}-?(?:${SPACING})-(?:\\d+(?:\\.\\d+)?|px)(?![\\w.-])`, "g"),
    fix: "Off the spacing scale. Use the step below or above (0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 20, 24): neighbouring steps differ enough to see.",
    unless: (match) => SPACING_STEPS.has(match.slice(match.lastIndexOf("-") + 1)),
  },
  {
    id: "no-gradient",
    level: "error",
    pattern: new RegExp(`${START}bg-(?:gradient|linear|radial|conic)[\\w-]*|(?:linear|radial|conic)-gradient\\(`, "g"),
    fix: "Flat surfaces. Depth comes from the three elevation levels and from a lighter or darker surface, not from gradients or glows.",
    files: (file) => isCode(file) || isStyle(file),
  },
  {
    id: "elevation-scale",
    level: "error",
    // A bare `shadow` counts only where a class name can stand (inside a quoted list), not as a word in code.
    pattern: new RegExp(`${START}(?:shadow-[\\w\\[\\]./%()_,#-]+|shadow(?=["'\`\\s])(?<=["'\`\\s:]shadow)|drop-shadow[\\w-]*|blur-(?:2xl|3xl))(?![\\w-])`, "g"),
    fix: "Three elevations only: shadow-raised (a control on the page), shadow-overlay (menu, popover, toast), shadow-modal (dialog, sheet). Most things sit flat.",
    unless: (match) => /^shadow-(?:raised|overlay|modal|none)$/.test(match),
  },
  {
    id: "elevation-scale",
    level: "error",
    pattern: /box-shadow\s*:|boxShadow\s*:/g,
    fix: "Use the elevation classes (shadow-raised, shadow-overlay, shadow-modal), not a hand-written shadow.",
    files: (file) => isCode(file) || (isStyle(file) && !isTokenSheet(file)),
  },
  {
    id: "radius-scale",
    level: "error",
    pattern: new RegExp(`${START}rounded(?:-[trblse]{1,2})?-(?:2xl|3xl|4xl|\\[[^\\]]+\\])`, "g"),
    fix: "One corner policy: rounded-sm, rounded-md, rounded-lg (rounded-xl for sheets, rounded-full for avatars and dots).",
  },
  {
    id: "color-tokens",
    level: "error",
    pattern: /(?<![\w&/#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g,
    fix: "Colours are tokens in globals.css. Use the semantic classes (bg-background, text-muted-foreground, border-border) or the neutral and status scales.",
    files: (file) => isCode(file) || (isStyle(file) && !isTokenSheet(file)),
  },
  {
    id: "color-tokens",
    level: "error",
    pattern: new RegExp(`${START}(?:${COLOR_PROPS})-\\[(?:#|rgb|hsl|oklch|color:)[^\\]]*\\]`, "g"),
    fix: "No one-off colours. Add a token in globals.css if the system is missing one.",
  },
  {
    id: "palette",
    level: "error",
    pattern: new RegExp(`${START}(?:${COLOR_PROPS})-(?:${OFF_PALETTE})-\\d{2,3}(?:/\\d+)?(?![\\w-])`, "g"),
    fix: "Only the neutral scale and the status scales exist (blue, amber, red, emerald, violet). Colour carries meaning; it never decorates.",
  },
  {
    id: "faint-text",
    level: "error",
    pattern: new RegExp(`${START}text-(?:foreground|muted-foreground|primary|neutral-\\d{3})/(?:[1-6]?\\d)(?![\\w-])`, "g"),
    fix: "Faded text fails contrast (4.5:1). Secondary text is text-muted-foreground; never lower it with opacity.",
  },
  {
    id: "faint-text",
    level: "error",
    pattern: new RegExp(`${START}text-neutral-(?:50|100|200|300|400)(?![\\w/-])`, "g"),
    fix: "Too light to read (under 4.5:1). Secondary text is text-muted-foreground.",
  },
  {
    id: "uppercase",
    level: "error",
    pattern: new RegExp(`${START}(?:uppercase|tracking-(?:wide|wider|widest|\\[[^\\]]+\\]))(?![\\w-])`, "g"),
    fix: "Sentence case, at the font's own letter spacing. Small capital-letter labels are slower to read and are the first sign of a generated interface.",
  },
  {
    id: "motion",
    level: "error",
    pattern: new RegExp(`${START}(?:animate-(?:bounce|ping)|duration-(?:[4-9]\\d\\d|\\d{4,}))(?![\\w-])`, "g"),
    fix: "Motion explains a change in 300ms or less and then stops. Nothing bounces, pings or drifts.",
  },
  {
    id: "centered-text",
    level: "warning",
    pattern: new RegExp(`${START}text-(?:center|justify)(?![\\w-])`, "g"),
    fix: "Left-align text. Centre only a heading or a block of one or two lines (an empty state); never justify.",
  },
  {
    id: "emoji",
    level: "warning",
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}]/gu,
    fix: "Icons come from the icon set. Emoji only inside copy, where the product's voice calls for it.",
    files: (file) => /\.(tsx|jsx)$/.test(file),
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (isCode(full) || isStyle(full)) out.push(full);
  }
  return out;
}

export function checkDesign(root: string = process.cwd(), dir = "src"): Report {
  const findings: Finding[] = [];
  let allowed = 0;
  const files = walk(path.join(root, dir));
  for (const file of files) {
    const rel = path.relative(root, file);
    const lines = readFileSync(file, "utf8").split("\n");
    const wholeFile = lines.slice(0, 12).some((line) => /design-ok-file:\s*\S/.test(line));
    lines.forEach((line, index) => {
      const excused = wholeFile || /design-ok:\s*\S/.test(line) || (index > 0 && /design-ok:\s*\S/.test(lines[index - 1]));
      for (const rule of RULES) {
        if (!(rule.files ?? isCode)(file)) continue;
        for (const match of line.matchAll(rule.pattern)) {
          if (rule.unless?.(match[0], line)) continue;
          if (excused) {
            allowed++;
            continue;
          }
          findings.push({ rule: rule.id, level: rule.level, file: rel, line: index + 1, found: match[0], fix: rule.fix });
        }
      }
    });
  }
  return { findings, allowed, files: files.length };
}

export function formatReport(report: Report): string {
  const out: string[] = [];
  for (const level of ["error", "warning"] as const) {
    const byRule = new Map<string, Finding[]>();
    for (const f of report.findings.filter((x) => x.level === level)) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);
    for (const [rule, list] of byRule) {
      out.push(`${level === "error" ? "FAIL" : "WARN"}  ${rule} (${list.length})  ${list[0].fix}`);
      for (const f of list.slice(0, 12)) out.push(`      ${f.file}:${f.line}  ${f.found}`);
      if (list.length > 12) out.push(`      … and ${list.length - 12} more`);
    }
  }
  const errors = report.findings.filter((f) => f.level === "error").length;
  const warnings = report.findings.length - errors;
  out.push(`design-check: ${report.files} files, ${errors} error(s), ${warnings} warning(s), ${report.allowed} documented exception(s).`);
  return out.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes("--help")) {
    console.log("npm run design:check [-- --dir src]   Checks the mechanical design rules; exit 1 on errors. Exceptions: // design-ok: <reason>");
    process.exit(0);
  }
  const at = process.argv.indexOf("--dir");
  const report = checkDesign(process.cwd(), at > -1 ? process.argv[at + 1] : "src");
  console.log(formatReport(report));
  process.exit(report.findings.some((f) => f.level === "error") ? 1 : 0);
}
