import { describe, it, expect, vi } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.devtools.js';
import { Component, h, createApp, signal } from '../src/vnano.js';

describe('DevTools Plugin Advanced', () => {
    it('should create full-width panel on init()', () => {
        $v.devtools.init();

        const panel = document.getElementById('vnano-devtools');
        expect(panel).not.toBeNull();
        expect(panel.style.left).toBe('0px');
        expect(panel.style.right).toBe('0px');

        $v.devtools.destroy();
    });

    it('should populate tree and inspector on click', () => {
        vi.useFakeTimers();

        class MyComp extends Component {
            constructor() {
                super();
                this.count = signal(0);
            }
            render() { return h('div', null, 'Test'); }
        }

        const root = document.createElement('div');
        document.body.appendChild(root);
        createApp(root).mount(MyComp);

        $v.devtools.init();
        vi.advanceTimersByTime(1100);

        const panel = document.getElementById('vnano-devtools');
        const tree = document.getElementById('vnano-tree');

        expect(tree.textContent).toContain('MyComp');

        const treeItem = Array.from(tree.querySelectorAll('div'))
            .find(d => d.textContent.includes('MyComp'));

        treeItem.click();

        const inspector = document.getElementById('vnano-inspector');
        expect(inspector.textContent).toContain('State / Signals');
        expect(inspector.textContent).toContain('count');
        expect(inspector.textContent).toContain('Signal(0)');

        document.body.removeChild(root);
        $v.devtools.destroy();
        vi.useRealTimers();
    });

    it('should toggle panel on Ctrl+Alt+V', () => {
        $v.devtools.init();
        expect(document.getElementById('vnano-devtools')).not.toBeNull();

        const event = new KeyboardEvent('keydown', { ctrlKey: true, altKey: true, key: 'v' });
        document.dispatchEvent(event);

        expect(document.getElementById('vnano-devtools')).toBeNull();

        document.dispatchEvent(event);
        expect(document.getElementById('vnano-devtools')).not.toBeNull();

        $v.devtools.destroy();
    });
});