import fs from "fs";
import { translations } from "../src/i18n/translations.js";

const html = fs.readFileSync("index.html", "utf8");

// Third party tools and their authors
const OPEN_SOURCE_TOOLS = {
  star_graphify: "Open Source Community / Graphify",
  star_newapi: "Calcium-Ion & Open Source Community (New API)",
  star_agentzero: "Frantisek Urban & Contributors (Agent Zero)",
  star_aider_nv: "Paul Gauthier & Contributors (Aider)",
  star_openshell: "Open Source Community (OpenShell)",
  star_gsd: "Open Source Community (GSD Workflow)",
  star_claudemem: "Open Source Community (Claude-Mem)",
  star_headroom: "Open Source Community (Headroom Context Engine)",
  star_ralph: "Open Source Community (Ralph Agent Runner)",
  star_deepseek_harness: "DeepSeek & Open Source Community",
};

// Map of card categories from index.html
const cardCategoriesMap = {};
const cardLinksMap = {};
const cardRegex =
  /<div class="catalog-(?:planet-)?card" data-target="([^"]+)" data-categories="([^"]+)">([\s\S]*?)<\/div>\s*<\/div>/g;
let m;
while ((m = cardRegex.exec(html)) !== null) {
  const target = m[1];
  const categories = m[2].split(" ");
  const linkMatch = m[3].match(/href="([^"]+)"[^>]*>([^<]+)/);
  cardCategoriesMap[target] = categories;
  if (linkMatch) {
    cardLinksMap[target] = { url: linkMatch[1], label: linkMatch[2].trim() };
  }
}

// Reword helper for security toolkits
function rewordText(text) {
  if (!text) return "";
  return text
    .replace(
      /kiber-qurollar arsenali/gi,
      "kiberxavfsizlik va tahlil asboblari laboratoriyasi",
    )
    .replace(/kiber-qurol/gi, "xavfsizlik vositasi")
    .replace(/Qurollari/gi, "Vositalari")
    .replace(/Qurol/gi, "Vositasi va Manbasi")
    .replace(/cyber-weapons arsenal/gi, "security research lab & toolkit")
    .replace(/cyber-weapons/gi, "security tools")
    .replace(/кибер-оружия/gi, "инструментов безопасности")
    .replace(/кибер-оружие/gi, "инструменты кибербезопасности")
    .replace(
      /арсенал боевых кибер-инструментов/gi,
      "комплекс инструментов анализа защищенности",
    );
}

const projects = [];

// 1. Planets / Celestial objects in catalog
const celestialOrder = [
  "Earth",
  "Mars",
  "Venus",
  "Mercury",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
  "sun",
];

for (const id of celestialOrder) {
  const rawData = translations.celestial[id];
  if (!rawData) continue;

  const categories = cardCategoriesMap[id] || ["web"];
  const link = cardLinksMap[id] || {
    url: "https://github.com/AzimjonKamiljanov",
    label: "GitHub Profil",
  };

  projects.push({
    id,
    kind: "celestial",
    group: "my_projects",
    originalAuthor: null,
    categories,
    link: link.url,
    linkText: link.label,
    uz: {
      badge: rewordText(rawData.uz.badge),
      title: rewordText(rawData.uz.title),
      subtitle: rewordText(rawData.uz.subtitle),
      content: rewordText(rawData.uz.content),
      tags: rawData.uz.tags,
      actionText: rawData.uz.actionText,
      githubText: rawData.uz.githubText,
    },
    en: {
      badge: rewordText(rawData.en.badge),
      title: rewordText(rawData.en.title),
      subtitle: rewordText(rawData.en.subtitle),
      content: rewordText(rawData.en.content),
      tags: rawData.en.tags,
      actionText: rawData.en.actionText,
      githubText: rawData.en.githubText,
    },
    ru: {
      badge: rewordText(rawData.ru.badge),
      title: rewordText(rawData.ru.title),
      subtitle: rewordText(rawData.ru.subtitle),
      content: rewordText(rawData.ru.content),
      tags: rawData.ru.tags,
      actionText: rawData.ru.actionText,
      githubText: rawData.ru.githubText,
    },
  });
}

// 2. Star systems
const starOrder = [
  "star_legion_power",
  "star_titan_cyber",
  "star_graphify",
  "star_newapi",
  "star_agentzero",
  "star_aider_nv",
  "star_openshell",
  "star_btech",
  "star_gsd",
  "star_claudemem",
  "star_headroom",
  "star_ralph",
  "star_deepseek_harness",
  "star_titan_osint",
  "star_sentinel_shield",
  "star_solar_portfolio",
  "star_school21",
  "star_task_observer",
];

for (const id of starOrder) {
  const rawData = translations.stars[id];
  if (!rawData) continue;

  const categories = cardCategoriesMap[id] || ["systems"];
  const link = cardLinksMap[id] || {
    url: "https://github.com/AzimjonKamiljanov",
    label: "GitHub Profil",
  };
  const isOpenSource = !!OPEN_SOURCE_TOOLS[id];

  projects.push({
    id,
    kind: "star",
    group: isOpenSource ? "open_source_tools" : "my_projects",
    originalAuthor: OPEN_SOURCE_TOOLS[id] || null,
    categories,
    link: link.url,
    linkText: link.label,
    uz: {
      badge: rewordText(rawData.uz.badge),
      title: rewordText(rawData.uz.title),
      subtitle: rewordText(rawData.uz.subtitle),
      content: rewordText(rawData.uz.content),
      tags: rawData.uz.tags,
      actionText: rawData.uz.actionText,
      githubText: rawData.uz.githubText,
    },
    en: {
      badge: rewordText(rawData.en.badge),
      title: rewordText(rawData.en.title),
      subtitle: rewordText(rawData.en.subtitle),
      content: rewordText(rawData.en.content),
      tags: rawData.en.tags,
      actionText: rawData.en.actionText,
      githubText: rawData.en.githubText,
    },
    ru: {
      badge: rewordText(rawData.ru.badge),
      title: rewordText(rawData.ru.title),
      subtitle: rewordText(rawData.ru.subtitle),
      content: rewordText(rawData.ru.content),
      tags: rawData.ru.tags,
      actionText: rawData.ru.actionText,
      githubText: rawData.ru.githubText,
    },
  });
}

fs.writeFileSync(
  "src/data/projects.json",
  JSON.stringify(projects, null, 2),
  "utf8",
);
console.log(
  `✓ Successfully compiled ${projects.length} projects into src/data/projects.json`,
);
console.log(
  `  - My projects: ${projects.filter((p) => p.group === "my_projects").length}`,
);
console.log(
  `  - Tools & open-source: ${projects.filter((p) => p.group === "open_source_tools").length}`,
);
