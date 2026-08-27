import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';
import { h, createDOMNode } from '../src/vnano.js';

describe('TransitionGroup Plugin', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('Enter: should add active then clean up', () => {
        const children = [h('div', { key: 1 }, 'Item')];
        const vnode = h(window.TransitionGroup, { name: 'v', duration: 300 }, children);
        const dom = createDOMNode(vnode);
        const item = dom.querySelector('[data-key="1"]');

        expect(item.className).toContain('v-enter');

        vi.advanceTimersByTime(50); // rAF

        // ИСПРАВЛЕНО: Проверяем массив классов, чтобы избежать ложных срабатываний
        const classes = item.className.split(' ');
        expect(classes).toContain('v-enter-active');
        expect(classes).not.toContain('v-enter');

        vi.advanceTimersByTime(300); // duration
        expect(item.className).not.toContain('v-enter-active');
    });

    it('Leave: should add active then remove from DOM', () => {
        const children = [h('div', { key: 1 }, '1'), h('div', { key: 2 }, '2')];
        const vnode = h(window.TransitionGroup, { name: 'v', duration: 300 }, children);
        const dom = createDOMNode(vnode);
        const inst = dom._component || dom._parentComponent;

        vi.advanceTimersByTime(350); // Finish enter

        inst.props = { name: 'v', duration: 300, children: [h('div', { key: 1 }, '1')] };
        inst.update();

        const leavingItem = dom.querySelector('[data-key="2"]');
        expect(leavingItem).not.toBeNull();

        vi.advanceTimersByTime(50); // rAF
        expect(leavingItem.className).toContain('v-leave-active');

        vi.advanceTimersByTime(300); // duration
        expect(dom.querySelector('[data-key="2"]')).toBeNull();
    });

    it('Cancel: should stop leave if reappears', () => {
        const children = [h('div', { key: 1 }, '1')];
        const vnode = h(window.TransitionGroup, { name: 'v', duration: 300 }, children);
        const dom = createDOMNode(vnode);
        const inst = dom._component || dom._parentComponent;

        vi.advanceTimersByTime(350);

        // Remove
        inst.props = { name: 'v', duration: 300, children: [] };
        inst.update();
        vi.advanceTimersByTime(50);

        // Re-add
        inst.props = { name: 'v', duration: 300, children: [h('div', { key: 1 }, '1')] };
        inst.update();

        const restoredItem = dom.querySelector('[data-key="1"]');
        expect(restoredItem.className).not.toContain('v-leave-active');

        vi.advanceTimersByTime(400);
        expect(dom.querySelector('[data-key="1"]')).not.toBeNull();
    });
});