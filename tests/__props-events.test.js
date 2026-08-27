import { describe, it, expect, vi } from 'vitest';
import { h } from '../src/vnano.js';
import { __test_internals__ } from '../src/vnano.js';
const { eventDelegation, applyProps, detachRefsDeep, findContext, clearRef } = __test_internals__;

describe('Events: eventDelegation', () => {
    it('setListener registers handler in WeakMap', () => {
        const el = document.createElement('button');
        document.body.appendChild(el); // <--- ВАЖНО: добавляем в DOM для всплытия

        const handler = vi.fn();
        eventDelegation.setListener(el, 'click', handler);

        // ИСПРАВЛЕНИЕ: Указываем { bubbles: true }, чтобы событие долетело до document
        el.dispatchEvent(new Event('click', { bubbles: true }));
        expect(handler).toHaveBeenCalled();

        // Очистка после теста
        document.body.removeChild(el);
        eventDelegation.removeListener(el, 'click');
    });

    it('removeListener deletes handler', () => {
        const el = document.createElement('button');
        const handler = vi.fn();
        eventDelegation.setListener(el, 'click', handler);
        eventDelegation.removeListener(el, 'click');

        el.dispatchEvent(new Event('click'));
        expect(handler).not.toHaveBeenCalled();
    });
});

describe('Events: applyProps', () => {
    it('updates class and style', () => {
        const el = document.createElement('div');
        applyProps(el, {}, { className: 'btn', style: { color: 'red' } });
        expect(el.className).toBe('btn');
        expect(el.style.color).toBe('red');
    });

    it('removes props', () => {
        const el = document.createElement('div');
        el.setAttribute('id', 'test');
        applyProps(el, { id: 'test' }, {});
        expect(el.hasAttribute('id')).toBe(false);
    });
});

describe('Events: clearRef & detachRefsDeep', () => {
    it('clearRef nullifies object ref', () => {
        const ref = { current: 'test' };
        clearRef(ref);
        expect(ref.current).toBeNull();
    });

    it('detachRefsDeep clears refs recursively', () => {
        const ref = vi.fn();
        const el = document.createElement('div');
        const vnode = h('div', { ref });
        detachRefsDeep(vnode, el);
        expect(ref).toHaveBeenCalledWith(null);
    });
});

describe('Events: findContext', () => {
    it('returns default value if stack is empty', () => {
        const ctx = { defaultValue: 'def' };
        expect(findContext(ctx)).toBe('def');
    });
});