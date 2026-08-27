import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import vnanoHMR from './vnano/plugins/vnano.vite.js';
import sandbox from './sandbox.config.js';

// FIX: в ESM-конфиге нет __dirname — вычисляем эквивалент из import.meta.url
const here = path.dirname(fileURLToPath(import.meta.url));

const rootDir = path.resolve(here, 'public');

// ---------------------------------------------------------------------
// Сборка входных точек build из sandbox.config.js
// ---------------------------------------------------------------------
const input = {};
const inputByPath = new Map();

function addPage(file) {
    if (!file) return;
    const abs = path.resolve(rootDir, file);
    if (inputByPath.has(abs)) return;

    let key = file.replace(/\.html$/i, '').replace(/[^\w-]/g, '_') || 'index';
    if (input[key] && input[key] !== abs) {
        throw new Error(
            '[sandbox] конфликт входных точек: ключ "' + key + '" уже занят ' +
            input[key] + ', файл ' + abs + ' даёт тот же ключ. Переименуйте файл.'
        );
    }
    input[key] = abs;
    inputByPath.set(abs, key);
}

const enabledSummary = [];

if (sandbox.vanilla && sandbox.vanilla.enabled) {
    addPage(sandbox.vanilla.index);
    (sandbox.vanilla.pages || []).forEach(addPage);
    enabledSummary.push('vanilla(' + sandbox.vanilla.index +
        ((sandbox.vanilla.pages || []).length ? ' +' + sandbox.vanilla.pages.length + ' pages' : '') + ')');
}
if (sandbox.module && sandbox.module.enabled) {
    addPage(sandbox.module.index);
    (sandbox.module.pages || []).forEach(addPage);
    enabledSummary.push('module(' + sandbox.module.index +
        ((sandbox.module.pages || []).length ? ' +' + sandbox.module.pages.length + ' pages' : '') + ')');
}

if (Object.keys(input).length === 0) {
    throw new Error('[sandbox] Все режимы выключены в sandbox.config.js — включите хотя бы один.');
}

console.log('[sandbox] enabled:', enabledSummary.join('  '));
console.log('[sandbox] features: addLibs=' + !!sandbox.addLibs + ' softPatch=' + !!sandbox.softPatch);

export default defineConfig({
    root: rootDir,

    publicDir: path.resolve(here, 'vnano/library'),

    server: {
        port: sandbox.port,
        watch: { ignored: ['**/*.html'] },
        fs: {
            // FIX: allow — ТОЛЬКО массив строк, иначе TypeError при старте
            allow: [here],
        },
    },

    resolve: {
        alias: { vnano: path.resolve(here, 'vnano/library/index.js') },
    },

    build: {
        rollupOptions: { input },
    },

    plugins: [
        vnanoHMR({
            addLibs: sandbox.addLibs !== false,
            softPatch: sandbox.softPatch !== false,
            vanillaHMR: !!(sandbox.vanilla && sandbox.vanilla.enabled),
            moduleHMR: !!(sandbox.module && sandbox.module.enabled),
        }),
    ],
});