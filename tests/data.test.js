import { describe, it, expect } from 'vitest';
import fs from 'fs';

describe('Data Integrity & Fact Verification Tests', () => {
    const projects = JSON.parse(fs.readFileSync('src/data/projects.json', 'utf8'));
    const profile = JSON.parse(fs.readFileSync('src/data/profile.json', 'utf8'));

    it('contains all 28 systems in projects.json', () => {
        expect(projects.length).toBe(28);
    });

    it('each project has complete trilingual metadata (uz, en, ru)', () => {
        projects.forEach(project => {
            expect(project.id).toBeTruthy();
            expect(project.categories.length).toBeGreaterThan(0);
            ['uz', 'en', 'ru'].forEach(lang => {
                expect(project[lang]).toBeDefined();
                expect(project[lang].title).toBeTruthy();
                expect(project[lang].subtitle).toBeTruthy();
                expect(project[lang].content).toBeTruthy();
                expect(project[lang].tags.length).toBeGreaterThan(0);
            });
        });
    });

    it('credits open-source tools with original authors and separates personal projects', () => {
        const myProjects = projects.filter(p => p.group === 'my_projects');
        const openSource = projects.filter(p => p.group === 'open_source_tools');

        expect(myProjects.length).toBe(18);
        expect(openSource.length).toBe(10);

        openSource.forEach(tool => {
            expect(tool.originalAuthor).toBeTruthy();
        });
    });

    it('profile reflects truthful student status and language proficiency', () => {
        expect(profile.name).toBe('Azimjon Kamiljanov');
        expect(profile.title.en).toBe('AI & Full-Stack Developer (Student)');
        expect(profile.title.uz).toBe('AI & Full-Stack Dasturchi (Talaba)');

        // Education checks
        const institutions = profile.education.map(e => e.institution);
        expect(institutions).toContain('PDP University');
        expect(institutions).toContain('School 21 Tashkent');

        // Languages checks
        const uzbek = profile.languages.find(l => l.name === 'Uzbek');
        const english = profile.languages.find(l => l.name === 'English');
        const russian = profile.languages.find(l => l.name === 'Russian');

        expect(uzbek.cefr).toBe('Native');
        expect(english.cefr).toBe('B1');
        expect(russian.cefr).toBe('A1');
    });

    it('no sensationalized weapon terms exist in projects dataset', () => {
        const serialized = JSON.stringify(projects).toLowerCase();
        expect(serialized).not.toContain('kiber-qurol');
        expect(serialized).not.toContain('cyber-weapons');
    });
});
