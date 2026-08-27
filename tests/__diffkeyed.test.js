import { describe, it, expect } from 'vitest';
import { h, createDOMNode } from '../src/vnano.js';
import { __test_internals__ } from '../src/vnano.js';

const { mapOldKeys, removeUnusedKeys, reconcileNodes, diffKeyed } = __test_internals__;

describe('Diffing: mapOldKeys', () => {
    it('should map old keys to DOM nodes', () => {
        const parent = document.createElement('div');
        const oldCh = [h('div', { key: 1 }), h('div', { key: 2 })];

        // Создаем DOM вручную для теста
        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        const map = mapOldKeys(oldCh, parent);

        expect(map.size).toBe(2);
        expect(map.get(1).dom).not.toBeUndefined();
        expect(map.get(1).vnode).toBe(oldCh[0]);
    });

    it('should remove unkeyed nodes from DOM', () => {
        const parent = document.createElement('div');
        const oldCh = [h('div', null, 'No Key'), h('div', { key: 1 })];

        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        mapOldKeys(oldCh, parent);

        // Элемент без ключа должен быть удален
        expect(parent.children.length).toBe(1);
        expect(parent.firstChild.getAttribute('data-key')).toBe(null);
    });
});

describe('Diffing: removeUnusedKeys', () => {
    it('should remove keys that are not in newKeys', () => {
        const parent = document.createElement('div');
        const oldCh = [h('div', { key: 1 }), h('div', { key: 2 })];
        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        const map = mapOldKeys(oldCh, parent);

        // newKeys содержит только ключ 1
        removeUnusedKeys(map, new Set([1]), parent);

        expect(parent.children.length).toBe(1);
        expect(map.has(2)).toBe(false);
    });
});

describe('Diffing: reconcileNodes', () => {
    it('should insert new nodes at the end', () => {
        const parent = document.createElement('div');
        const oldCh = [h('div', { key: 1 }, '1')];
        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        const map = mapOldKeys(oldCh, parent);
        const newCh = [h('div', { key: 1 }, '1'), h('div', { key: 2 }, '2')];

        reconcileNodes(newCh, map, parent);

        expect(parent.children.length).toBe(2);
        expect(parent.lastChild.textContent).toBe('2');
    });

    it('should move nodes to correct positions', () => {
        const parent = document.createElement('div');
        const oldCh = [h('div', { key: 1 }, '1'), h('div', { key: 2 }, '2')];
        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        const map = mapOldKeys(oldCh, parent);
        const newCh = [h('div', { key: 2 }, '2'), h('div', { key: 1 }, '1')];

        reconcileNodes(newCh, map, parent);

        expect(parent.children[0].textContent).toBe('2');
        expect(parent.children[1].textContent).toBe('1');
    });
});

describe('Diffing: diffKeyed (Integration)', () => {
    it('should handle complex reordering, addition, and removal', () => {
        const parent = document.createElement('div');
        const oldCh = [h('div', { key: 1 }, '1'), h('div', { key: 2 }, '2'), h('div', { key: 3 }, '3')];
        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        // Перемешиваем: 2 остается, 1 удаляется, 3 двигается вперед, 4 добавляется
        const newCh = [h('div', { key: 3 }, '3'), h('div', { key: 2 }, '2'), h('div', { key: 4 }, '4')];

        diffKeyed(oldCh, newCh, parent);

        expect(parent.children.length).toBe(3);
        expect(parent.children[0].textContent).toBe('3');
        expect(parent.children[1].textContent).toBe('2');
        expect(parent.children[2].textContent).toBe('4');
    });
});