import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, h, createDOMNode } from '../src/vnano.js';
import '../src/vnano.js';
import '../src/vnano.components.js';


// Мокаем requestAnimationFrame чтобы он работал синхронно
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

describe('VirtualBlock (Lazy Load & Lifecycle)', () => {
    let observerCallbacks = [];

    beforeEach(() => {
        observerCallbacks = [];
        window.IntersectionObserver = vi.fn(function(cb, options) {
            const isLifecycle = !!(options && options.rootMargin); // <--- ДОБАВЛЕНО !!
            observerCallbacks.push({ cb, isLifecycle });

            return {
                observe: vi.fn(),
                unobserve: vi.fn(),
                disconnect: vi.fn()
            };
        });
    });

    // Вспомогательная функция: симулируем вход/выход из зоны
    function triggerObserver(isLifecycle, isIntersecting) {
        const targetObserver = observerCallbacks.find(o => o.isLifecycle === isLifecycle);
        if (targetObserver) {
            targetObserver.cb([{ isIntersecting }]);
        }
    }

    it('should mount with correct height and empty content initially (far away)', () => {
        const renderContent = vi.fn(() => h('div', { id: 'heavy' }, 'Heavy Content'));
        const vnode = h(window.$v.VirtualBlock, { height: 600, renderContent });
        const dom = createDOMNode(vnode);

        // Внешний блок должен иметь жесткую высоту (чтобы верстка не ехала)
        expect(dom.style.height).toBe('600px');

        // Внутренняя обертка должна быть пустой, так как блок изначально "далеко"
        const wrapper = dom.firstChild;
        expect(wrapper.style.display).toBe('none');
        expect(wrapper.children.length).toBe(0);
        expect(renderContent).not.toHaveBeenCalled();
    });

    it('should async mount content when entering buffer zone', async () => {
        const renderContent = vi.fn(() => h('div', { id: 'heavy' }, 'Heavy Content'));
        const dom = createDOMNode(h(window.$v.VirtualBlock, { height: 600, renderContent }));
        const wrapper = dom.firstChild;

        // Блок входит в буферную зону (lifecycle: true)
        triggerObserver(true, true);

        // Ждем выполнения requestAnimationFrame
        await new Promise(r => setTimeout(r, 10));

        // Контент должен быть создан
        expect(renderContent).toHaveBeenCalled();
        expect(wrapper.children.length).toBe(1);
        expect(wrapper.firstChild.id).toBe('heavy');
    });

    it('should toggle display when entering/leaving viewport (visibility)', async () => {
        const renderContent = vi.fn(() => h('div', null, 'Content'));
        const dom = createDOMNode(h(window.$v.VirtualBlock, { height: 600, renderContent }));
        const wrapper = dom.firstChild;

        // Сначала загружаем контент в буфере
        triggerObserver(true, true);
        await new Promise(r => setTimeout(r, 10));

        // Блок появляется на экране (visibility: false -> true)
        triggerObserver(false, true);
        expect(wrapper.style.display).toBe('block');

        // Блок уходит с экрана, но остается в буфере (visibility: true -> false)
        triggerObserver(false, false);
        expect(wrapper.style.display).toBe('none');

        // Контент при этом НЕ должен удаляться (display: none, но DOM на месте)
        expect(wrapper.children.length).toBe(1);
    });

    it('should destroy content when leaving buffer zone completely', async () => {
        const renderContent = vi.fn(() => h('div', null, 'Content'));
        const dom = createDOMNode(h(window.$v.VirtualBlock, { height: 600, renderContent }));
        const wrapper = dom.firstChild;

        // Загружаем контент
        triggerObserver(true, true);
        await new Promise(r => setTimeout(r, 10));
        expect(wrapper.children.length).toBe(1);

        // Блок уходит далеко из буфера (lifecycle: true -> false)
        triggerObserver(true, false);

        // Контент должен быть уничтожен (innerHTML очищен)
        expect(wrapper.children.length).toBe(0);

        // Но высота внешнего блока должна остаться!
        expect(dom.style.height).toBe('600px');
    });
});