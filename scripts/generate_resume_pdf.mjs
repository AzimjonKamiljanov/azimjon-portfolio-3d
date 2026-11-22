import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const resumeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Azimjon Kamiljanov - AI & Full-Stack Developer Resume</title>
<style>
    @page {
        size: A4;
        margin: 10mm 14mm 10mm 14mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
        font-size: 9.5pt;
        line-height: 1.38;
    }
    .header {
        border-bottom: 2px solid #0f172a;
        padding-bottom: 6px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }
    .name-title h1 {
        font-size: 20pt;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.5px;
    }
    .name-title h2 {
        font-size: 11pt;
        font-weight: 600;
        color: #0284c7;
        margin-top: 1px;
    }
    .contact-info {
        text-align: right;
        font-size: 8.5pt;
        color: #334155;
        line-height: 1.4;
    }
    .contact-info a {
        color: #0284c7;
        text-decoration: none;
    }
    .section {
        margin-bottom: 8px;
    }
    .section-title {
        font-size: 10pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #0f172a;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 2px;
        margin-bottom: 4px;
    }
    .summary-text {
        font-size: 9pt;
        color: #334155;
        text-align: justify;
    }
    .education-item {
        display: flex;
        justify-content: space-between;
        font-size: 8.8pt;
        margin-bottom: 3px;
    }
    .education-school {
        font-weight: 700;
        color: #0f172a;
    }
    .education-degree {
        color: #334155;
    }
    .education-date {
        color: #64748b;
        font-size: 8.3pt;
        font-family: monospace;
    }
    .skills-grid {
        display: grid;
        grid-template-columns: 130px 1fr;
        row-gap: 2px;
        font-size: 8.6pt;
    }
    .skill-cat {
        font-weight: 700;
        color: #0f172a;
    }
    .skill-list {
        color: #334155;
    }
    .project-item {
        margin-bottom: 6px;
    }
    .project-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 1px;
    }
    .project-name {
        font-size: 9.3pt;
        font-weight: 700;
        color: #0f172a;
    }
    .project-role {
        font-weight: 600;
        color: #0284c7;
        font-size: 8.6pt;
    }
    .project-tech {
        font-size: 8pt;
        color: #64748b;
        font-family: monospace;
    }
    .project-desc {
        font-size: 8.6pt;
        color: #334155;
        padding-left: 12px;
    }
    .project-desc li {
        margin-bottom: 1px;
    }
</style>
</head>
<body>

<div class="header">
    <div class="name-title">
        <h1>Azimjon Kamiljanov</h1>
        <h2>AI & Full-Stack Developer (Student)</h2>
    </div>
    <div class="contact-info">
        <div>Tashkent, Uzbekistan</div>
        <div>Email: <a href="mailto:azimjonkomiljonov907@gmail.com">azimjonkomiljonov907@gmail.com</a></div>
        <div>Telegram: <a href="https://t.me/CyberAgentNexus">@CyberAgentNexus</a></div>
        <div>GitHub: <a href="https://github.com/AzimjonKamiljanov">github.com/AzimjonKamiljanov</a></div>
        <div>Portfolio: <a href="https://azimjon.dev">https://azimjon.dev</a></div>
    </div>
</div>

<div class="section">
    <div class="section-title">Education & Academic Studies</div>
    <div class="education-item">
        <div>
            <span class="education-school">PDP University</span> — 
            <span class="education-degree">Bachelor of Science in Artificial Intelligence (2nd-Year Student)</span>
        </div>
        <div class="education-date">2024 — Present</div>
    </div>
    <div class="education-item">
        <div>
            <span class="education-school">School 21 Tashkent</span> — 
            <span class="education-degree">Cybersecurity & Low-Level Systems Programming (Peer-to-Peer Curriculum)</span>
        </div>
        <div class="education-date">2024 — Present</div>
    </div>
</div>

<div class="section">
    <div class="section-title">Summary</div>
    <p class="summary-text">
        AI & Full-Stack Developer and computer science student with hands-on expertise in autonomous multi-agent systems, real-time WebRTC/VoIP pipelines, GPU-accelerated local inference (PyTorch, Whisper, Kokoro TTS), and 3D WebGL data visualizations. Creator of CyberAgent TITAN NEXUS, integrating full-duplex conversational voice telephony via Telegram with autonomous command orchestration. Focused on reliable systems engineering, algorithmic rigor, and clean user experience.
    </p>
</div>

<div class="section">
    <div class="section-title">Technical Skills</div>
    <div class="skills-grid">
        <div class="skill-cat">AI & Agents:</div>
        <div class="skill-list">Python, PyTorch, CUDA, Whisper Large-v3-Turbo, Kokoro TTS, Gemini Flash, DeepSeek R1, Groq LPU, Agent Tooling.</div>
        
        <div class="skill-cat">VoIP & Real-time:</div>
        <div class="skill-list">WebRTC Duplex Audio, Telegram Hydrogram VoIP Engine, Low-latency Audio Buffering, Audio DSP.</div>

        <div class="skill-cat">Frontend & 3D:</div>
        <div class="skill-list">Three.js, WebGL, GLSL Shaders, JavaScript (ES6+), React, Vite, HTML5, CSS3, GSAP.</div>

        <div class="skill-cat">Backend & Security:</div>
        <div class="skill-list">Node.js, Express, FastAPI, PostgreSQL, Redis, REST APIs, Cryptography Labs, Linux Systems.</div>

        <div class="skill-cat">DevOps & Cloud:</div>
        <div class="skill-list">Docker, Cloudflare Workers, Git, GitHub Actions CI/CD, DevSecOps.</div>
    </div>
</div>

<div class="section">
    <div class="section-title">Key Projects & Systems</div>

    <div class="project-item">
        <div class="project-header">
            <div>
                <span class="project-name">CyberAgent TITAN NEXUS</span> — <span class="project-role">Creator & Developer</span>
            </div>
            <div class="project-tech">Python • PyTorch • WebRTC • Gemini Flash • CUDA</div>
        </div>
        <ul class="project-desc">
            <li>Built an autonomous multi-tool agent featuring live 1-on-1 full-duplex voice calls over Telegram VoIP via custom WebRTC streaming.</li>
            <li>Implemented a low-latency speech pipeline pairing PyTorch Whisper for speech recognition with Kokoro for neural speech synthesis.</li>
            <li>Created 180+ modular tools enabling system maintenance, container control, codebase navigation, and automated workflows.</li>
        </ul>
    </div>

    <div class="project-item">
        <div class="project-header">
            <div>
                <span class="project-name">3D Solar System Developer Portfolio</span> — <span class="project-role">Developer & Designer</span>
            </div>
            <div class="project-tech">Three.js • WebGL • GLSL • Vite • Cloudflare Workers</div>
        </div>
        <ul class="project-desc">
            <li>Engineered an interactive 3D WebGL solar system featuring 9 planets, concentric orbits, custom GLSL solar shaders, and 1,400+ instanced asteroids at 60 FPS.</li>
            <li>Implemented accessible fallback modes, trilingual localization (UZ/EN/RU), and Moon terminal direct contact form.</li>
        </ul>
    </div>

    <div class="project-item">
        <div class="project-header">
            <div>
                <span class="project-name">UstaPro Master CAD 3D</span> — <span class="project-role">Lead Developer</span>
            </div>
            <div class="project-tech">Three.js • Telegram Mini App • CAD Algorithms</div>
        </div>
        <ul class="project-desc">
            <li>Developed an interactive 3D construction calculation tool for roofs, ceilings, walls, and flooring with real-time bill-of-materials generation.</li>
            <li>Automated unit test coverage with 98 passing test suites and responsive Telegram WebApp integration.</li>
        </ul>
    </div>

    <div class="project-item">
        <div class="project-header">
            <div>
                <span class="project-name">CareTrack Clinic ERP</span> — <span class="project-role">Full-Stack Developer</span>
            </div>
            <div class="project-tech">Next.js • Node.js • PostgreSQL</div>
        </div>
        <ul class="project-desc">
            <li>Engineered a medical clinic management platform featuring electronic medical records (EMR), patient queues, and role-based access.</li>
        </ul>
    </div>
</div>

<div class="section">
    <div class="section-title">Languages</div>
    <p class="summary-text">
        <strong>Uzbek</strong> (Native) &bull; <strong>English</strong> (B1 &ndash; Intermediate) &bull; <strong>Russian</strong> (A1 &ndash; Elementary)
    </p>
</div>

</body>
</html>
`;

const htmlPath = path.resolve("/tmp/resume_azimjon.html");
const pdfPath = path.resolve(
  process.cwd(),
  "assets/Azimjon_Kamiljanov_Resume.pdf",
);
const publicPdfPath = path.resolve(
  process.cwd(),
  "public/assets/Azimjon_Kamiljanov_Resume.pdf",
);

fs.writeFileSync(htmlPath, resumeHtml, "utf8");

console.log(
  "Generating ATS-friendly 1-page A4 Resume PDF via Chrome headless...",
);

const chromeArgs = [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--print-to-pdf-no-header",
  `--print-to-pdf=${pdfPath}`,
  htmlPath,
];

const proc = spawn("google-chrome-stable", chromeArgs);

proc.on("close", (code) => {
  if (code === 0 && fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    fs.mkdirSync(path.dirname(publicPdfPath), { recursive: true });
    fs.copyFileSync(pdfPath, publicPdfPath);
    console.log(
      `✓ Resume PDF generated successfully! Size: ${stats.size} bytes at ${pdfPath}`,
    );
    console.log(`✓ Mirrored to ${publicPdfPath}`);
  } else {
    console.error(`Failed to generate PDF. Exit code: ${code}`);
    process.exit(1);
  }
});
