import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const projects = JSON.parse(
  fs.readFileSync(path.join(rootDir, "src/data/projects.json"), "utf8"),
);
const profile = JSON.parse(
  fs.readFileSync(path.join(rootDir, "src/data/profile.json"), "utf8"),
);

export function generateAccessibleFallbackHtml() {
  const myProjects = projects.filter((p) => p.group === "my_projects");
  const toolsAndOpenSource = projects.filter(
    (p) => p.group === "tools_and_opensource",
  );

  function renderItem(p) {
    const title = p.uz.title;
    const subtitle = p.uz.subtitle;
    const content = p.uz.content;
    const tags = (p.uz.tags || []).join(", ");
    const author = p.originalAuthor
      ? `<p><em>Muallif: ${p.originalAuthor}</em></p>`
      : "";
    const link = p.link
      ? `<p><a href="${p.link}" target="_blank" rel="noopener noreferrer">${p.linkText || "Loyiha havolasi"}</a></p>`
      : "";

    return `
            <article class="fallback-project-card" style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #334155; border-radius: 8px;">
                <h3>${title}</h3>
                <p><strong>${subtitle}</strong></p>
                ${author}
                <p>${content}</p>
                <p><small>Teglar: ${tags}</small></p>
                ${link}
            </article>
        `;
  }

  return `
        <div id="accessible-fallback" class="accessible-fallback" role="region" aria-label="Accessible Portfolio Summary">
            <h2>Azimjon Kamiljanov — Portfolio (Matnli Rejim / Accessible Fallback)</h2>
            <p><strong>Unvon:</strong> ${profile.title.uz} (${profile.title.en})</p>
            <p><strong>Joylashuv:</strong> ${profile.location}</p>
            <p><strong>Tavsif:</strong> ${profile.bio.uz}</p>

            <section id="education-section">
                <h3>Ta'lim</h3>
                <ul>
                    ${profile.education.map((e) => `<li><strong>${e.institution}</strong> — ${e.degree.uz} (${e.period})</li>`).join("")}
                </ul>
            </section>

            <section id="contact-section">
                <h3>Aloqa Kanallari</h3>
                <ul>
                    <li>Telegram: <a href="${profile.links.telegramPersonal}">@KamiljanovAzimjon</a></li>
                    <li>Telegram Kanal / VoIP Bot: <a href="${profile.links.telegram}">@CyberAgentNexus</a></li>
                    <li>GitHub: <a href="${profile.links.github}">github.com/AzimjonKamiljanov</a></li>
                    <li>Veb-sayt: <a href="${profile.links.website}">azimjon.dev</a></li>
                </ul>
            </section>

            <section id="projects-section">
                <h3>Mualliflik Loyihalari (${myProjects.length})</h3>
                ${myProjects.map(renderItem).join("")}
            </section>

            <section id="tools-section">
                <h3>Ishlatiladigan Vositalar & Ochiq Kodli Tizimlar (${toolsAndOpenSource.length})</h3>
                ${toolsAndOpenSource.map(renderItem).join("")}
            </section>
        </div>
    `.trim();
}

if (process.argv[1] === __filename) {
  const html = generateAccessibleFallbackHtml();
  console.log(`Generated accessible fallback HTML (${html.length} bytes).`);
}
