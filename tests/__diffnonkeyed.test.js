import { describe, it, expect } from 'vitest';
import { h, createDOMNode } from '../src/vnano.js';
import { __test_internals__ } from '../src/vnano.js';

const { diffNonKeyed } = __test_internals__;

describe('diffNonKeyed', () => {
    it('should append new nodes at the end', () => {
        const parent = document.createElement('div');
        const oldCh = [h('div', null, '1')];
        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        const newCh = [h('div', null, '1'), h('div', null, '2')];
        diffNonKeyed(oldCh, newCh, parent);

        expect(parent.childNodes.length).toBe(2);
        expect(parent.childNodes[1].textContent).toBe('2');
    });

    it('should trim extra nodes from the end', () => {
        const parent = document.createElement('div');
        const oldCh = [h('div', null, '1'), h('div', null, '2')];
        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        const newCh = [h('div', null, '1')];
        diffNonKeyed(oldCh, newCh, parent);

        expect(parent.childNodes.length).toBe(1);
        expect(parent.firstChild.textContent).toBe('1');
    });

    it('should replace placeholder when toggling null to VNode (Bug Fix)', () => {
        const parent = document.createElement('div');

        // 1. Initial render: [1, 2, 3]
        const oldCh = [h('div', null, '1'), h('div', null, '2'), h('div', null, '3')];
        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        // 2. Hide 2: [1, null, 3]
        let newCh = [h('div', null, '1'), null, h('div', null, '3')];
        diffNonKeyed(oldCh, newCh, parent);

        expect(parent.childNodes.length).toBe(3);
        expect(parent.childNodes[0].textContent).toBe('1');
        expect(parent.childNodes[1].nodeType).toBe(3); // Text node placeholder
        expect(parent.childNodes[2].textContent).toBe('3');

        // 3. Show 2 again: [1, 2, 3]
        const oldChWithNull = [h('div', null, '1'), null, h('div', null, '3')];
        const restoredCh = [h('div', null, '1'), h('div', null, '2'), h('div', null, '3')];
        diffNonKeyed(oldChWithNull, restoredCh, parent);

        // Bug was here: it would append '2' at the end, leaving the placeholder
        expect(parent.childNodes.length).toBe(3);
        expect(parent.childNodes[0].textContent).toBe('1');
        expect(parent.childNodes[1].nodeType).toBe(1); // Should be DIV, not text node
        expect(parent.childNodes[1].textContent).toBe('2');
        expect(parent.childNodes[2].textContent).toBe('3');
    });

    it('should patch existing nodes in place', () => {
        const parent = document.createElement('div');
        const oldCh = [h('div', { id: 'old' }, 'Text')];
        oldCh.forEach(v => parent.appendChild(createDOMNode(v)));

        const newCh = [h('div', { id: 'new' }, 'Updated')];
        diffNonKeyed(oldCh, newCh, parent);

        expect(parent.childNodes.length).toBe(1);
        expect(parent.firstChild.id).toBe('new');
        expect(parent.firstChild.textContent).toBe('Updated');
    });
});