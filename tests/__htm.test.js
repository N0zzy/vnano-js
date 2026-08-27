import { describe, it, expect, vi } from 'vitest';
import { h, Component, createDOMNode, signal, html } from '../src/vnano.js';

describe('HTM (Tagged Templates)', () => {
    it('should parse basic HTML', () => {
        const vnode = html`<div id="test">Hello World</div>`;
        const dom = createDOMNode(vnode);

        expect(dom.tagName).toBe('DIV');
        expect(dom.id).toBe('test');
        expect(dom.textContent).toBe('Hello World');
    });

    it('should parse nested elements', () => {
        const vnode = html`<div class="parent"><span class="child">Text</span></div>`;
        const dom = createDOMNode(vnode);

        expect(dom.className).toBe('parent');
        const child = dom.querySelector('.child');
        expect(child).not.toBeNull();
        expect(child.textContent).toBe('Text');
    });

    it('should interpolate dynamic props and children', () => {
        const cls = 'dynamic-class';
        const text = 'Dynamic Text';
        const vnode = html`<div class="${cls}">${text}</div>`;
        const dom = createDOMNode(vnode);

        expect(dom.className).toBe('dynamic-class');
        expect(dom.textContent).toBe('Dynamic Text');
    });

    it('should bind events', () => {
        const spy = vi.fn();
        const vnode = html`<button onclick="${spy}">Click Me</button>`;
        const dom = createDOMNode(vnode);

        dom.dispatchEvent(new Event('click'));
        expect(spy).toHaveBeenCalled();
    });

    it('should work with boolean and null children', () => {
        const show = true;
        const hide = false;
        const vnode = html`<div>${show && 'Visible'} ${hide && 'Hidden'}</div>`;
        const dom = createDOMNode(vnode);

        expect(dom.textContent).toContain('Visible');
        expect(dom.textContent).not.toContain('Hidden');
    });


    it('should handle input events with interpolation', () => {
        let inputValue = '';
        const onInput = (e) => { inputValue = e.target.value; };

        const vnode = html`<input type="text" oninput="${onInput}" placeholder="Type here" />`;
        const dom = createDOMNode(vnode);

        // Симулируем ввод
        dom.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'Hello' }));

        // В happy-dom value может не обновиться автоматически при dispatchEvent,
        // поэтому проверяем, что слушатель сработал.
        // Для надежности можно установить value напрямую:
        dom.value = 'Hello';
        dom.dispatchEvent(new Event('input'));

        expect(inputValue).toBe('Hello');
    });
});

describe('HTM with Components', () => {
    it('should render class components using <${Comp} /> syntax', () => {
        class Child extends Component {
            render() {
                return html`<span id="child">From Child</span>`;
            }
        }

        class Parent extends Component {
            render() {
                return html`<div id="parent"><${Child} /></div>`;
            }
        }

        const dom = createDOMNode(html`<${Parent} />`);

        expect(dom.id).toBe('parent');
        const childSpan = dom.querySelector('#child');
        expect(childSpan).not.toBeNull();
        expect(childSpan.textContent).toBe('From Child');
    });

    it('should pass props to components', () => {
        class Greeting extends Component {
            render() {
                return html`<h1>Hello, ${this.props.name}!</h1>`;
            }
        }

        const name = 'Ivan';
        const dom = createDOMNode(html`<${Greeting} name="${name}" />`);

        expect(dom.tagName).toBe('H1');
        expect(dom.textContent).toBe('Hello, Ivan!');
    });

    it('should update component when signal changes inside html', () => {
        class Counter extends Component {
            constructor() {
                super();
                this.count = signal(0);
            }

            render() {
                return html`<div>Count: ${this.count.value}</div>`;
            }
        }

        const dom = createDOMNode(html`<${Counter} />`);
        const inst = dom._parentComponent;

        expect(dom.textContent).toBe('Count: 0');

        inst.count.value = 10;
        expect(dom.textContent).toBe('Count: 10');
    });

    it('should handle fragments and lists', () => {
        const items = ['Apple', 'Banana', 'Cherry'];
        const vnode = html`<ul>${items.map(item => html`<li>${item}</li>`)}</ul>`;
        const dom = createDOMNode(vnode);

        const lis = dom.querySelectorAll('li');
        expect(lis.length).toBe(3);
        expect(lis[0].textContent).toBe('Apple');
        expect(lis[2].textContent).toBe('Cherry');
    });
});