import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Production Distribution (dist/) Integrity Tests', () => {
    const distPath = path.resolve(import.meta.dirname, '../dist');
    const indexPath = path.join(distPath, 'index.html');

    it('dist/index.html exists and contains valid modern HTML', () => {
        expect(fs.existsSync(indexPath)).toBe(true);
        const html = fs.readFileSync(indexPath, 'utf8');
        expect(html.length).toBeGreaterThan(5000);
        expect(html).toContain('<!DOCTYPE html>');
    });

    it('enforces zoomable viewport meta without user-scalable=no (WCAG 1.4.4)', () => {
        const html = fs.readFileSync(indexPath, 'utf8');
        expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
        expect(html).not.toContain('user-scalable=no');
        expect(html).not.toContain('maximum-scale=1');
    });

    it('contains no external unpkg or jsdelivr CDN script dependencies', () => {
        const html = fs.readFileSync(indexPath, 'utf8');
        expect(html).not.toContain('https://unpkg.com/three');
        expect(html).not.toContain('https://unpkg.com/es-module-shims');
        expect(html).not.toContain('https://cdn.jsdelivr.net');
    });

    it('contains accessible skip-link and accessible-fallback region with projects', () => {
        const html = fs.readFileSync(indexPath, 'utf8');
        expect(html).toContain('class="skip-link"');
        expect(html).toContain('id="accessible-fallback"');
        expect(html).toContain('CyberAgent TITAN NEXUS');
        expect(html).toContain('CareTrack Clinic');
        expect(html).toContain('UstaPro Master CAD 3D');
    });

    it('contains truthful schema.org JSON-LD and meta description', () => {
        const html = fs.readFileSync(indexPath, 'utf8');
        expect(html).toContain('AI & Full-Stack Developer (Student)');
        expect(html).toContain('PDP University');
        expect(html).toContain('School 21 Tashkent');
        expect(html).not.toContain('Lead AI Systems Architect & Full-Stack Engineer');
    });

    it('verifies bundled self-hosted assets exist in dist/', () => {
        const assetsDir = path.join(distPath, 'assets');
        expect(fs.existsSync(assetsDir)).toBe(true);

        const files = fs.readdirSync(assetsDir);
        expect(files.some(f => f.endsWith('.woff2'))).toBe(true);
        expect(files.some(f => f.endsWith('.webp'))).toBe(true);
        expect(files.some(f => f.endsWith('.css'))).toBe(true);
        expect(files.some(f => f.endsWith('.js'))).toBe(true);

        expect(fs.existsSync(path.join(distPath, 'assets/Azimjon_Kamiljanov_Resume.pdf'))).toBe(true);
        expect(fs.existsSync(path.join(distPath, 'assets/space_ambient.mp3'))).toBe(true);
    });

    it('verifies self-hosted MediaPipe hands assets exist in dist/mediapipe/hands/', () => {
        const mpDir = path.join(distPath, 'mediapipe/hands');
        expect(fs.existsSync(mpDir)).toBe(true);
        expect(fs.existsSync(path.join(mpDir, 'hands_solution_simd_wasm_bin.wasm'))).toBe(true);
        expect(fs.existsSync(path.join(mpDir, 'hands_solution_wasm_bin.wasm'))).toBe(true);
        expect(fs.existsSync(path.join(mpDir, 'hand_landmark_full.tflite'))).toBe(true);
    });
});
