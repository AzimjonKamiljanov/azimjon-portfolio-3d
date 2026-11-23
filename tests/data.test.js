import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Data Integrity & Fact Verification Tests", () => {
  const projects = JSON.parse(
    fs.readFileSync("src/data/projects.json", "utf8"),
  );
  const profile = JSON.parse(fs.readFileSync("src/data/profile.json", "utf8"));

  const OWNER = "https://github.com/AzimjonKamiljanov";

  it("lists one entry per celestial body and nothing else", () => {
    // The Sun plus nine planets. The catalogue used to carry 28 entries,
    // eighteen of which were bodies that do not exist in the scene.
    expect(projects.length).toBe(10);
    expect(projects.map((p) => p.id)).toEqual([
      "sun",
      "Mercury",
      "Venus",
      "Earth",
      "Mars",
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune",
      "Pluto",
    ]);
  });

  it("every project links to a repository under the owner's account", () => {
    // Ten of the old entries were other people's open-source tools, listed in
    // a portfolio. A link outside this account is the signal for that, so the
    // check is on the URL rather than on a flag someone has to remember to set.
    projects.forEach((project) => {
      expect(project.link, `${project.id} has no link`).toBeTruthy();
      expect(
        project.link.startsWith(OWNER),
        `${project.id}: ${project.link}`,
      ).toBe(true);
    });
  });

  it("claims no third-party authorship", () => {
    projects.forEach((project) => {
      expect(project.originalAuthor, `${project.id}`).toBeNull();
      expect(project.group).toBe("my_projects");
    });
  });

  it("each project has complete trilingual metadata (uz, en, ru)", () => {
    projects.forEach((project) => {
      expect(project.id).toBeTruthy();
      expect(project.categories.length).toBeGreaterThan(0);
      ["uz", "en", "ru"].forEach((lang) => {
        expect(project[lang]).toBeDefined();
        expect(project[lang].title).toBeTruthy();
        expect(project[lang].subtitle).toBeTruthy();
        expect(project[lang].content).toBeTruthy();
        expect(project[lang].tags.length).toBeGreaterThan(0);
      });
    });
  });

  it("describes projects without marketing superlatives", () => {
    // The old copy called a student's side project a "flagship" and a
    // "super-agent", and gave one an enterprise stack it does not use. A
    // portfolio that overstates is worth less than one that does not.
    const banned =
      /flagman|flagship|titan nexus|super-agent|hyper-?real|world.class|cutting.edge/i;

    projects.forEach((project) => {
      ["uz", "en", "ru"].forEach((lang) => {
        const text = [
          project[lang].badge,
          project[lang].title,
          project[lang].subtitle,
          project[lang].content,
        ].join(" ");
        expect(
          banned.test(text),
          `${project.id}.${lang}: ${text.slice(0, 80)}`,
        ).toBe(false);
      });
    });
  });

  it("profile reflects truthful student status and language proficiency", () => {
    expect(profile.name).toBe("Azimjon Kamiljanov");
    expect(profile.title.en).toBe("AI & Full-Stack Developer (Student)");
    expect(profile.title.uz).toBe("AI & Full-Stack Dasturchi (Talaba)");

    // Education checks
    const institutions = profile.education.map((e) => e.institution);
    expect(institutions).toContain("PDP University");
    expect(institutions).toContain("School 21 Tashkent");

    // Languages checks
    const uzbek = profile.languages.find((l) => l.name === "Uzbek");
    const english = profile.languages.find((l) => l.name === "English");
    const russian = profile.languages.find((l) => l.name === "Russian");

    expect(uzbek.cefr).toBe("Native");
    expect(english.cefr).toBe("B1");
    expect(russian.cefr).toBe("A1");
  });

  it("no sensationalized weapon terms exist in projects dataset", () => {
    const serialized = JSON.stringify(projects).toLowerCase();
    expect(serialized).not.toContain("kiber-qurol");
    expect(serialized).not.toContain("cyber-weapons");
  });

  it("fails if more than 3 items share one link (A1 regression test)", () => {
    const linkCounts = {};
    projects.forEach((p) => {
      if (p.link) {
        linkCounts[p.link] = (linkCounts[p.link] || 0) + 1;
      }
    });
    const counts = Object.values(linkCounts);
    const maxShared = counts.length > 0 ? Math.max(...counts) : 0;
    expect(maxShared).toBeLessThanOrEqual(3);
  });

  it("contains no Lead AI or Senior Full-Stack in src/ (A2)", () => {
    function checkDir(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = `${dir}/${file.name}`;
        if (file.isDirectory()) {
          checkDir(fullPath);
        } else if (file.name.endsWith(".js") || file.name.endsWith(".json")) {
          const content = fs.readFileSync(fullPath, "utf8");
          expect(content).not.toMatch(/Lead AI/i);
          expect(content).not.toMatch(/Senior Full-Stack/i);
        }
      }
    }
    checkDir("src");
    const indexHtml = fs.readFileSync("index.html", "utf8");
    expect(indexHtml).not.toMatch(/Lead AI/i);
    expect(indexHtml).not.toMatch(/Senior Full-Stack/i);
  });
});
