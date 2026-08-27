import { describe, it, expect, vi } from 'vitest';
import { h, createDOMNode, patch, lazy, hydrateNode, signal } from '../src/vnano.js';
import { __test_internals__ } from '../src/vnano.js';
const { diffKeyed, applyProps } = __test_internals__;

describe('Lazy API: Preload & Cancel', () => {
    it('preload caches the component without throwing', async () => {
        const loader = vi.fn(() => Promise.resolve({ default: () => h('div', null, 'Loaded') }));
        const LazyComp = lazy(loader);

        await LazyComp.preload();
        expect(loader).toHaveBeenCalled();

        // После preload вызов не должен выбрасывать Promise
        expect(() => LazyComp({})).not.toThrow();
    });

    it('cancel aborts the active request safely', () => {
        // Возвращаем промис, который никогда не завершится, чтобы избежать
        // необработанных ошибок (Unhandled Promise Rejection) при вызове abort()
        const loader = vi.fn(() => new Promise(() => {}));
        const LazyComp = lazy(loader);

        expect(() => LazyComp({})).toThrow(); // Запускает загрузку
        expect(() => LazyComp.cancel({})).not.toThrow(); // Отменяет загрузку без ошибок
        expect(loader).toHaveBeenCalled();
    });
});

describe('Diffing Edge Cases', () => {
    it('diffKeyed removes items that are missing in new array', () => {
        const parent = document.createElement('ul');
        const oldVNodes = [h('li', { key: 1 }, '1'), h('li', { key: 2 }, '2')];
        const newVNodes = [h('li', { key: 1 }, '1')];

        oldVNodes.forEach(v => parent.appendChild(createDOMNode(v)));

        diffKeyed(oldVNodes, newVNodes, parent);

        expect(parent.children.length).toBe(1);
        expect(parent.children[0].textContent).toBe('1');
    });

    it('diffKeyed adds new items that are missing in old array', () => {
        const parent = document.createElement('ul');
        const oldVNodes = [h('li', { key: 1 }, '1')];
        const newVNodes = [h('li', { key: 1 }, '1'), h('li', { key: 2 }, '2')];

        oldVNodes.forEach(v => parent.appendChild(createDOMNode(v)));

        diffKeyed(oldVNodes, newVNodes, parent);

        expect(parent.children.length).toBe(2);
    });
});

describe('applyProps Edge Cases', () => {
    it('sets and updates input value correctly', () => {
        const el = document.createElement('input');
        applyProps(el, {}, { value: 'test' });
        expect(el.value).toBe('test');

        applyProps(el, { value: 'test' }, { value: 'updated' });
        expect(el.value).toBe('updated');
    });

    it('handles boolean properties like disabled', () => {
        const el = document.createElement('button');
        applyProps(el, {}, { disabled: true });
        expect(el.disabled).toBe(true);

        applyProps(el, { disabled: true }, { disabled: false });
        expect(el.disabled).toBe(false);
    });
});

describe('Hydration Edge Cases', () => {
    it('removes existing DOM node when new vnode is null', () => {
        const parent = document.createElement('div');
        parent.innerHTML = '<span>Remove Me</span>';

        // Передаем null как новый vnode
        hydrateNode(parent, null, parent.firstChild);

        expect(parent.children.length).toBe(0);
    });
});