# Attributions and Licenses

This project adheres to strict open-source licensing standards and provides verifiable attribution for all third-party models, astronomical datasets, planetary maps, audio assets, and upstream software libraries.

---

## 1. Astronomical Imagery & Planetary Textures

All celestial textures used in this portfolio are sourced from verified public-domain scientific archives (NASA, USGS, ESA) or open-access creative commons repositories (Solar System Scope, CC BY 4.0).

| Body / Feature | File Path (Optimized WebP / Source) | Source & Science Team Credit | License |
|---|---|---|---|
| **Sun (Photosphere)** | `public/assets/sun_photosphere.webp`<br>`assets/sun_photosphere.jpg` | NASA / SDO (Solar Dynamics Observatory) & AIA / HMI Science Teams | Public Domain (NASA Guidelines) |
| **Sun (Photosphere Exact)** | `public/assets/sun_photosphere_exact.webp`<br>`assets/sun_photosphere_exact.jpg` | NASA / SDO continuum filter maps | Public Domain (NASA Guidelines) |
| **Sun (Prominences & Corona)** | `public/assets/sun_prominences_exact.webp`<br>`assets/sun_corona.png` | NASA / SDO AIA 304Å extreme ultraviolet | Public Domain (NASA Guidelines) |
| **Sun (Plasma Flow)** | `public/assets/sun_plasma.webp`<br>`assets/sun_plasma.jpg` | NASA / SOHO / SDO composite flow | Public Domain (NASA Guidelines) |
| **Earth (Day Albedo)** | `public/assets/earth_atmos_2048.webp`<br>`assets/earth_atmos_2048.jpg` | NASA Earth Observatory (`Blue Marble: Next Generation`) | Public Domain (NASA Guidelines) |
| **Earth (Cloud Layer)** | `public/assets/earth_clouds_2048.webp`<br>`assets/earth_clouds_2048.png` | NASA Visible Earth cloud composite | Public Domain (NASA Guidelines) |
| **Earth (Night Lights)** | `public/assets/earth_night_2048.webp`<br>`assets/earth_night_2048.jpg` | NASA Earth Observatory / NOAA NGDC (`Black Marble`) | Public Domain (NASA Guidelines) |
| **Earth (Normal & Specular)** | `public/assets/earth_normal_2048.webp`<br>`assets/earth_specular_2048.webp` | NASA Blue Marble topography & bathymetry maps | Public Domain (NASA Guidelines) |
| **Moon** | `public/assets/moon_1024.webp`<br>`assets/moon_1024.jpg` | NASA / GSFC Scientific Visualization Studio (LRO / LOLA) | Public Domain (NASA Guidelines) |
| **Mercury** | `public/assets/mercury_2048.webp`<br>`assets/mercury_2048.jpg` | NASA / Johns Hopkins University APL / Carnegie Institution (MESSENGER) | Public Domain (NASA Guidelines) |
| **Venus** | `public/assets/venus_2048.webp`<br>`assets/venus_2048.jpg` | NASA / JPL-Caltech / USGS Astrogeology Science Center (Magellan radar map) | Public Domain (NASA Guidelines) |
| **Mars** | `public/assets/mars_2048.webp`<br>`assets/mars_2048.jpg` | NASA / JPL-Caltech / USGS Astrogeology (Viking Orbiter MDIM 2.1) | Public Domain (NASA Guidelines) |
| **Jupiter** | `public/assets/jupiter_2048.webp`<br>`assets/jupiter_2048.jpg` | NASA / JPL-Caltech / Space Science Institute / Solar System Scope | CC BY 4.0 ([Solar System Scope](https://www.solarsystemscope.com/textures/)) |
| **Saturn & Rings** | `public/assets/saturn_2048.webp`<br>`public/assets/saturn_ring.webp` | NASA / JPL-Caltech / Space Science Institute / Solar System Scope | CC BY 4.0 ([Solar System Scope](https://www.solarsystemscope.com/textures/)) |
| **Uranus & Rings** | `public/assets/uranus_2048.webp`<br>`public/assets/uranus_ring.webp` | NASA / JPL-Caltech / Solar System Scope (Voyager 2 composite) | CC BY 4.0 ([Solar System Scope](https://www.solarsystemscope.com/textures/)) |
| **Neptune** | `public/assets/neptune_2048.webp`<br>`assets/neptune_2048.jpg` | NASA / JPL-Caltech / Solar System Scope (Voyager 2 composite) | CC BY 4.0 ([Solar System Scope](https://www.solarsystemscope.com/textures/)) |
| **Pluto** | `public/assets/pluto_2048.webp`<br>`assets/pluto_2048.jpg` | NASA / Johns Hopkins APL / Southwest Research Institute (New Horizons) | Public Domain (NASA Guidelines) |
| **Space Ambient Audio** | `public/assets/space_ambient.mp3`<br>`assets/space_ambient.mp3` | Procedural Web Audio API soundscape synthesis & NASA public domain radio emissions archive | CC0 1.0 Universal / Public Domain |

---

## 2. Optional 4K Ultra-HD Drop-In Maps `TODO(owner)`

For users with high-bandwidth connections desiring maximum graphical fidelity, 4K/8K replacement maps may be dropped directly into `assets/` and `public/assets/` without any code modifications:

1. `sun_photosphere_4096.jpg` (SDO/HMI 4K solar continuum, NASA Goddard)
2. `earth_atmos_4096.jpg` (NASA Blue Marble 4K daytime surface map)
3. `earth_clouds_4096.png` (NASA Visible Earth 4K cloud alpha map)
4. `earth_night_4096.jpg` (NASA Black Marble 4K city light radiance map)
5. `moon_4096.jpg` (NASA CGI Moon Kit 4K LOLA digital elevation model)
6. `mars_4096.jpg` (USGS Astrogeology Mars Viking Colorized 4K mosaic)
7. `jupiter_4096.jpg` (NASA Cassini/Juno 4K cylindrical map)
8. `saturn_4096.jpg` (NASA Cassini Imaging Science Subsystem 4K map)
9. `saturn_ring_4096.png` (Cassini UVIS high-res ring transparency map)

---

## 3. Open-Source Libraries & AI Frameworks

| Library | Author / Organization | License | Role in Application |
|---|---|---|---|
| **Three.js (r186)** | Ricardo Cabello (Mr.doob) & Three.js Authors | MIT | 3D WebGL / WebGPU scene graph, PBR shaders, and postprocessing pipeline |
| **@mediapipe/tasks-vision** | Google LLC | Apache 2.0 | On-device computer vision HandLandmarker ML model & WASM pipeline |
| **GSAP (GreenSock)** | GreenSock Inc. | Standard GreenSock License | High-performance camera dives, smooth tweening, and UI transition timeline |
| **Inter Font** | Rasmus Andersson | SIL Open Font License 1.1 | Modern neutral body typography |
| **Plus Jakarta Sans** | Gumpita Rahayu, Tokotype | SIL Open Font License 1.1 | Distinctive geometric heading typography |
| **JetBrains Mono** | JetBrains s.r.o. | SIL Open Font License 1.1 | High-legibility monospace font for orbital telemetry, coordinates, and terminal |

---

## 4. Upstream Open-Source Toolkits & Projects Cataloged

The portfolio showcases systems and implementations built upon these open-source toolkits, honoring their original creators:

1. **New API** — [Calcium-Ion/new-api](https://github.com/Calcium-Ion/new-api) (MIT License)
2. **Agent Zero** — [frdel/agent-zero](https://github.com/frdel/agent-zero) (Apache 2.0)
3. **Graphify** — [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) (MIT License)
4. **Aider** — Paul Gauthier ([Aider-AI/aider](https://github.com/Aider-AI/aider), Apache 2.0)
5. **OpenShell** — NVIDIA Corporation ([NVIDIA/OpenShell](https://github.com/NVIDIA/OpenShell), Apache 2.0)
6. **GSD Core** — [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) (MIT License)
7. **Claude Mem** — [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) (MIT License)
8. **Headroom** — [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) (MIT License)
9. **How to Ralph Wiggum** — Geoffrey Huntley ([ghuntley/how-to-ralph-wiggum](https://github.com/ghuntley/how-to-ralph-wiggum), MIT License)
10. **DeepSeek Harness** — DeepSeek AI ([deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness), MIT License)
11. **Nmap Security Scanner** — Gordon Lyon (Fyodor) (Nmap Public Source License)
12. **sqlmap** — Bernardo Damele Assumpcao & Miroslav Stampar (GPLv2+)
13. **Metasploit Framework** — Rapid7 LLC (BSD 3-Clause)
