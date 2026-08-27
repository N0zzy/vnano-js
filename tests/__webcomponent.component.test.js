import { describe, it, expect, vi } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';
import { Component, h , createApp } from '../src/vnano.js';

describe('Web Components Plugin', () => {
    it('should register a custom element', () => {
        class TestComp extends Component { render() { return h('div', null, 'WC'); } }
        $v.define('test-wc-1', TestComp);

        expect(customElements.get('test-wc-1')).toBeDefined();
    });

    it('should render component inside shadow DOM when added to DOM', () => {
        class TestComp extends Component { render() { return h('div', { id: 'inner' }, 'Hello WC'); } }
        $v.define('test-wc-2', TestComp);

        const el = document.createElement('test-wc-2');
        document.body.appendChild(el);

        // Проверяем Shadow DOM
        expect(el.shadowRoot).not.toBeNull();
        const inner = el.shadowRoot.querySelector('#inner');
        expect(inner).not.toBeNull();
        expect(inner.textContent).toBe('Hello WC');

        document.body.removeChild(el);
    });

    it('should unmount when removed from DOM', () => {
        class TestComp extends Component { render() { return h('div', null, 'WC'); } }
        $v.define('test-wc-3', TestComp);

        const el = document.createElement('test-wc-3');
        document.body.appendChild(el);

        expect(el.shadowRoot.children.length).toBeGreaterThan(0);

        document.body.removeChild(el);

        // После удаления shadowRoot остается, но его содержимое должно быть очищено
        expect(el.shadowRoot.children.length).toBe(0);
    });

    it('should read attributes as props', () => {
        class TestComp extends Component {
            render() { return h('div', { id: 'prop-test' }, this.props.title); }
        }
        $v.define('test-wc-4', TestComp);

        const el = document.createElement('test-wc-4');
        el.setAttribute('title', 'My Title');
        document.body.appendChild(el);

        const inner = el.shadowRoot.querySelector('#prop-test');
        expect(inner.textContent).toBe('My Title');

        document.body.removeChild(el);
    });
});