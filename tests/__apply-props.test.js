import { describe, it, expect, vi } from 'vitest';
import '../src/vnano.js';
import { __test_internals__ } from '../src/vnano.js';

const { applyRefLogic, updateClass, updateStyle, updateAttributes, updateAttr, eventDelegation } = __test_internals__;

describe('Props: applyRefLogic', () => {
    it('should set object ref', () => {
        const el = document.createElement('div');
        const ref = { current: null };
        applyRefLogic(undefined, ref, el);
        expect(ref.current).toBe(el);
    });

    it('should call function ref', () => {
        const el = document.createElement('div');
        const ref = vi.fn();
        applyRefLogic(undefined, ref, el);
        expect(ref).toHaveBeenCalledWith(el);
    });

    it('should clear old ref when changing', () => {
        const el = document.createElement('div');
        const oldRef = vi.fn();
        const newRef = vi.fn();
        applyRefLogic(oldRef, newRef, el);
        expect(oldRef).toHaveBeenCalledWith(null);
        expect(newRef).toHaveBeenCalledWith(el);
    });
});

describe('Props: updateClass', () => {
    it('should set className', () => {
        const el = document.createElement('div');
        updateClass(el, {}, { className: 'btn-active' });
        expect(el.className).toBe('btn-active');
    });

    it('should remove className if missing in newProps', () => {
        const el = document.createElement('div');
        el.className = 'old-class';
        updateClass(el, { className: 'old-class' }, {});
        expect(el.className).toBe('');
    });
});

describe('Props: updateStyle', () => {
    it('should set object styles', () => {
        const el = document.createElement('div');
        updateStyle(el, {}, { style: { color: 'red', fontSize: '12px' } });
        expect(el.style.color).toBe('red');
        expect(el.style.fontSize).toBe('12px');
    });

    it('should remove styles missing in newProps', () => {
        const el = document.createElement('div');
        el.style.color = 'red';
        updateStyle(el, { style: { color: 'red' } }, { style: { background: 'blue' } });
        expect(el.style.color).toBe('');
        expect(el.style.backgroundColor).toBe('blue');
    });

    it('should set string style', () => {
        const el = document.createElement('div');
        updateStyle(el, {}, { style: 'color: green;' });
        expect(el.getAttribute('style')).toBe('color: green;');
    });
});

describe('Props: updateAttr', () => {
    it('should set standard attribute', () => {
        const el = document.createElement('div');
        updateAttr(el, 'id', undefined, 'test-id');
        expect(el.getAttribute('id')).toBe('test-id');
    });

    it('should set boolean true attribute', () => {
        const el = document.createElement('button');
        updateAttr(el, 'disabled', undefined, true);
        expect(el.hasAttribute('disabled')).toBe(true);
    });

    it('should remove attribute if false/null', () => {
        const el = document.createElement('div');
        el.setAttribute('id', 'test');
        updateAttr(el, 'id', 'test', null);
        expect(el.hasAttribute('id')).toBe(false);
    });

    it('should set DOM property (value)', () => {
        const el = document.createElement('input');
        updateAttr(el, 'value', undefined, 'text-val');
        expect(el.value).toBe('text-val');
    });
});