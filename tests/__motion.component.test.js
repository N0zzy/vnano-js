import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';
import { h, createDOMNode } from '../src/vnano.js';

describe('Motion Plugin', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('should render empty text node initially if show is false', () => {
        const vnode = h($v.Motion, { show: false, name: 'v' }, h('div', { id: 'test' }, 'Content'));
        const dom = createDOMNode(vnode);

        // ИСПРАВЛЕНО: createDOMNode(null) возвращает пустой текстовый узел (nodeType 3)
        expect(dom.nodeType).toBe(3);
        expect(dom.nodeValue).toBe('');
    });

    it('should render child and add enter classes when show is true', () => {
        const vnode = h($v.Motion, { show: true, name: 'v', duration: 300 }, h('div', { id: 'test' }, 'Content'));
        const dom = createDOMNode(vnode);

        // ИСПРАВЛЕНО: dom - это и есть наш div
        expect(dom.tagName).toBe('DIV');
        expect(dom.id).toBe('test');
        expect(dom.className).toContain('v-enter');
        expect(dom.className).toContain('v-enter-active');
    });

    it('should remove enter classes after duration', () => {
        const vnode = h($v.Motion, { show: true, name: 'v', duration: 300 }, h('div', null, 'Content'));
        const dom = createDOMNode(vnode);

        vi.advanceTimersByTime(350);

        // ИСПРАВЛЕНО: классы висят на dom
        expect(dom.className).not.toContain('v-enter');
        expect(dom.className).not.toContain('v-enter-active');
    });

    it('should add leave classes and remove from DOM when show becomes false', () => {
        const vnode = h($v.Motion, { show: true, name: 'v', duration: 300 }, h('div', { id: 'test' }, 'Content'));
        const dom = createDOMNode(vnode);
        const inst = dom._component || dom._parentComponent;

        vi.advanceTimersByTime(350); // Завершаем enter

        // Скрываем
        inst.props = { show: false, name: 'v', duration: 300, children: h('div', { id: 'test' }, 'Content') };
        inst.update();

        // ИСПРАВЛЕНО: inst.host ссылается на актуальный DOM-узел
        const leavingItem = inst.host;
        expect(leavingItem).not.toBeNull();
        expect(leavingItem.className).toContain('v-leave');

        // Проматываем duration
        vi.advanceTimersByTime(350);

        // После анимации узел должен замениться на пустой текстовый плейсхолдер
        expect(inst.host.nodeType).toBe(3);
        expect(inst.host.nodeValue).toBe('');
    });
});