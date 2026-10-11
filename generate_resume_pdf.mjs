import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const resumeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Azimjon Kamiljanov - Lead AI Systems Architect Resume</title>
<style>
    @page {
        size: A4;
        margin: 14mm 16mm 14mm 16mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #1e293b;
        background: #ffffff;
        font-size: 10.2pt;
        line-height: 1.45;
    }
    .header {
        border-bottom: 2px solid #0f172a;
        padding-bottom: 10px;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
    }
    .name-title h1 {
        font-size: 22pt;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.5px;
    }
    .name-title h2 {
        font-size: 11.5pt;
        font-weight: 600;
        color: #2563eb;
        margin-top: 2px;
        letter-spacing: 0.2px;
    }
    .contact-info {
        text-align: right;
        font-size: 8.8pt;
        color: #475569;
        line-height: 1.5;
    }
    .contact-info a {
        color: #2563eb;
        text-decoration: none;
        font-weight: 500;
    }
    .section {
        margin-bottom: 12px;
    }
    .section-title {
        font-size: 11pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #0f172a;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 3px;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .summary-text {
        font-size: 9.3pt;
        color: #334155;
        text-align: justify;
    }
    .skills-grid {
        display: grid;
        grid-template-columns: 140px 1fr;
        row-gap: 4px;
        font-size: 9pt;
    }
    .skill-cat {
        font-weight: 700;
        color: #1e293b;
    }
    .skill-list {
        color: #334155;
    }
    .project-item {
        margin-bottom: 8px;
    }
    .project-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 2px;
    }
    .project-name {
        font-size: 10pt;
        font-weight: 700;
        color: #0f172a;
    }
    .project-role {
        font-weight: 600;
        color: #2563eb;
        font-size: 9pt;
    }
    .project-tech {
        font-size: 8.2pt;
        color: #64748b;
        font-family: monospace;
    }
    .project-desc {
        font-size: 9pt;
        color: #334155;
        padding-left: 12px;
    }
    .project-desc li {
        margin-bottom: 2px;
    }
    .rig-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 8.5pt;
        color: #334155;
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
    }
    .rig-item strong {
        color: #0f172a;
    }
</style>
</head>
<body>

<div class="header">
    <div class="name-title">
        <h1>Azimjon Kamiljanov</h1>
        <h2>Lead AI Systems Architect • Senior Full-Stack Engineer</h2>
    </div>
    <div class="contact-info">
        <div>📍 Tashkent, Uzbekistan</div>
        <div>📧 <a href="mailto:azimjonkomiljonov907@gmail.com">azimjonkomiljonov907@gmail.com</a></div>
        <div>💬 Telegram: <a href="https://t.me/KamiljanovAzimjon">@KamiljanovAzimjon</a></div>
        <div>🐙 GitHub: <a href="https://github.com/AzimjonKamiljanov">github.com/AzimjonKamiljanov</a></div>
    </div>
</div>

<div class="section">
    <div class="section-title">Professional Summary</div>
    <p class="summary-text">
        Senior AI Systems Architect and Full-Stack Engineer specializing in autonomous multi-agent ecosystems, real-time WebRTC/VoIP duplex audio pipelines, GPU-accelerated neural inference, and high-performance 3D WebGL applications. Architect behind <strong>CyberAgent TITAN NEXUS</strong>, a production autonomous AI agent capable of full-duplex conversational voice telephony via Telegram, local CUDA acceleration (RTX 5070), and 180+ system control tools. Dedicated to rock-solid software architecture, zero-latency execution, and elegant user interfaces.
    </p>
</div>

<div class="section">
    <div class="section-title">Core Technical Competencies</div>
    <div class="skills-grid">
        <div class="skill-cat">AI & Deep Learning:</div>
        <div class="skill-list">Python 3.12, PyTorch 2.14, CUDA 13, Whisper Large-v3-Turbo, Kokoro TTS, Gemini 3.8 Flash, DeepSeek R1, Groq LPU, Agent Tooling, Multi-Agent Swarms.</div>
        
        <div class="skill-cat">VoIP & Telephony:</div>
        <div class="skill-list">WebRTC Duplex Streaming, Telegram Hydrogram VoIP Engine, Real-time Audio DSP, Echo Cancellation, Low-latency Pipelines.</div>

        <div class="skill-cat">Frontend & 3D:</div>
        <div class="skill-list">Three.js, WebGL, GLSL Custom Shaders, React, Next.js, TypeScript, TailwindCSS, GSAP, Responsive Mobile/Desktop UX.</div>

        <div class="skill-cat">Backend & Systems:</div>
        <div class="skill-list">Node.js, Express, FastAPI, PostgreSQL, Redis, RESTful APIs, WebSockets, Linux Systems Programming (Arch/Zen).</div>

        <div class="skill-cat">DevOps & Cloud:</div>
        <div class="skill-list">Docker Engine 29.7.2, Portainer, Cloudflare Tunnels/Workers, CI/CD, Git, DevSecOps (OWASP GenAI Security).</div>
    </div>
</div>

<div class="section">
    <div class="section-title">Key Projects & Architectural Achievements</div>

    <div class="project-item">
        <div class="project-header">
            <div>
                <span class="project-name">CyberAgent TITAN NEXUS</span> — <span class="project-role">Creator & Chief Architect</span>
            </div>
            <div class="project-tech">Python • PyTorch • WebRTC • Gemini 3.8 • RTX 5070 CUDA</div>
        </div>
        <ul class="project-desc">
            <li>Engineered an autonomous cognitive agent featuring live 1-on-1 full-duplex voice phone calls over Telegram VoIP via custom WebRTC integration.</li>
            <li>Implemented an ultra-fast audio processing pipeline combining PyTorch Whisper Large-v3-Turbo for STT and Kokoro for natural voice synthesis running locally on RTX 5070 GPU.</li>
            <li>Integrated 180+ autonomous system tools enabling shell execution, container management, codebase refactoring, and automated web research.</li>
        </ul>
    </div>

    <div class="project-item">
        <div class="project-header">
            <div>
                <span class="project-name">3D Solar System Developer Portfolio</span> — <span class="project-role">Lead 3D & Graphics Engineer</span>
            </div>
            <div class="project-tech">Three.js • WebGL • GLSL • GSAP • PWA</div>
        </div>
        <ul class="project-desc">
            <li>Developed a photorealistic 3D WebGL solar system featuring the Sun, 9 planets with axial tilts and rings, the Moon, and an authentic asteroid belt with 1,400+ asteroids using InstancedMesh at 60 FPS.</li>
            <li>Authored custom GLSL solar prominence & corona shaders with simplex noise turbulence and realistic ACESFilmic tone mapping.</li>
            <li>Created Cinematic Tour Mode with smooth Bézier camera paths and an interactive Direct AI Moon communication terminal.</li>
        </ul>
    </div>

    <div class="project-item">
        <div class="project-header">
            <div>
                <span class="project-name">UstaPro Master CAD 3D</span> — <span class="project-role">Lead Engineer</span>
            </div>
            <div class="project-tech">Three.js • Telegram Mini App • TypeScript • CAD Algorithms</div>
        </div>
        <ul class="project-desc">
            <li>Built an interactive 3D construction modeling and estimation tool for roofs, ceilings, walls, and flooring with real-time bill-of-materials generation.</li>
            <li>Achieved 100% automated test pass rate (98/98 tests) with seamless Telegram WebApp integration.</li>
        </ul>
    </div>

    <div class="project-item">
        <div class="project-header">
            <div>
                <span class="project-name">CareTrack Clinic ERP</span> — <span class="project-role">Full-Stack Architect</span>
            </div>
            <div class="project-tech">Next.js • Node.js • PostgreSQL • HIPAA Standards</div>
        </div>
        <ul class="project-desc">
            <li>Architected enterprise medical CRM/ERP platform with electronic medical records (EMR), laboratory workflows, role-based access control, and encrypted patient data management.</li>
        </ul>
    </div>
</div>

<div class="section">
    <div class="section-title">Hardware & Engineering Lab Rig</div>
    <div class="rig-box">
        <div class="rig-item"><strong>Hardware:</strong> Lenovo Legion Pro 5</div>
        <div class="rig-item"><strong>CPU:</strong> AMD Ryzen 9 9955HX (32 vCPUs)</div>
        <div class="rig-item"><strong>GPU:</strong> NVIDIA RTX 5070 Laptop (8GB VRAM)</div>
        <div class="rig-item"><strong>RAM:</strong> 32 GB DDR5 | 1TB NVMe</div>
        <div class="rig-item"><strong>OS:</strong> EndeavourOS Linux (Zen Kernel)</div>
    </div>
</div>

<div class="section">
    <div class="section-title">Languages & Communication</div>
    <p class="summary-text">
        <strong>Uzbek</strong> (Native) • <strong>English</strong> (Professional Working Proficiency) • <strong>Russian</strong> (Professional Working Proficiency)
    </p>
</div>

</body>
</html>
`;

const htmlPath = '/tmp/resume_azimjon.html';
const pdfPath = '/home/cyber/projects/3d-portfolio/assets/Azimjon_Kamiljanov_Resume.pdf';

fs.writeFileSync(htmlPath, resumeHtml, 'utf8');

console.log("Generating Resume PDF via Chrome headless...");

const chromeArgs = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    htmlPath
];

const proc = spawn('google-chrome-stable', chromeArgs);

proc.on('close', (code) => {
    if (code === 0 && fs.existsSync(pdfPath)) {
        const stats = fs.statSync(pdfPath);
        console.log(`✓ Resume PDF generated successfully! Size: ${stats.size} bytes at ${pdfPath}`);
    } else {
        console.error(`Failed to generate PDF. Exit code: ${code}`);
        process.exit(1);
    }
});
