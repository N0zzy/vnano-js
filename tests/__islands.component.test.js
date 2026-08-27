import { describe, it, expect } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';
import { h, createDOMNode } from '../src/vnano.js';

describe('Island Plugin', () => {
    it('should inject data-island into a single child', () => {
        const child = h('div', { id: 'test' }, 'Content');
        const vnode = h($v.Island, null, child);
        const dom = createDOMNode(vnode);

        expect(dom.getAttribute('data-island')).toBe('true');
        expect(dom.id).toBe('test');
    });

    it('should wrap multiple children in a div with data-island', () => {
        const children = [h('span', null, '1'), h('span', null, '2')];
        const vnode = h($v.Island, null, children);
        const dom = createDOMNode(vnode);

        expect(dom.tagName).toBe('DIV');
        expect(dom.getAttribute('data-island')).toBe('true');
        expect(dom.children.length).toBe(2);
    });

    it('should return null if no children', () => {
        const vnode = h($v.Island, null, null);
        const dom = createDOMNode(vnode);
        // createDOMNode(null) returns empty text node
        expect(dom.nodeType).toBe(3);
    });
});