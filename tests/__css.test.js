import { describe, it, expect, beforeEach } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';
import { h, createDOMNode } from '../src/vnano.js';

describe('StylingEngine Plugin', () => {
    beforeEach(() => {
        $v._cssEngine.clear();
    });

    it('should generate scoped class and inject into <head>', () => {
        const cls = $v.css`color: red;`;
        expect(cls).toMatch(/^v[a-z0-9]+$/);

        const styleEl = document.querySelector('style[data-vnano-css]');
        expect(styleEl.textContent).toContain(`.${cls} { color: red; }`);
    });

    it('should handle & nesting', () => {
        const cls = $v.css`&:hover { color: blue; }`;
        const styleEl = document.querySelector('style[data-vnano-css]');
        expect(styleEl.textContent).toContain(`.${cls}:hover { color: blue; }`);
    });

    it('styled should create component with class', () => {
        const StyledDiv = $v.styled('div')`background: green;`;
        const dom = createDOMNode(h(StyledDiv, null, 'Test'));

        expect(dom.className).toContain('v');
        expect(dom.textContent).toBe('Test');
        expect(document.querySelector('style').textContent).toContain('background: green;');
    });

    it('keyframes should inject @keyframes and return name', () => {
        const animName = $v.keyframes`
            0% { opacity: 0; }
            100% { opacity: 1; }
        `;

        expect(animName).toMatch(/^v[a-z0-9]+$/);
        const styleEl = document.querySelector('style[data-vnano-css]');
        expect(styleEl.textContent).toContain(`@keyframes ${animName} {`);
    });

    // ИСПРАВЛЕНО: Переименовано в styles
    it('styles should inject raw CSS without scoping', () => {
        $v.styles`body { margin: 0; }`;
        const styleEl = document.querySelector('style[data-vnano-css]');
        expect(styleEl.textContent).toContain('body { margin: 0; }');
    });
});