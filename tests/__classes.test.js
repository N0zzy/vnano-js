import { describe, it, expect, vi } from 'vitest';
import {
    h, Component, App, Suspense, KeepAlive, Delegator,
    createDOMNode, patch, signal
} from '../src/vnano.js';

describe('Component Class', () => {
    it('should render initial state', () => {
        class TestComp extends Component {
            render() { return h('div', { id: 'test' }, this.props.text); }
        }
        const dom = createDOMNode(h(TestComp, { text: 'Hello' }));
        expect(dom.tagName).toBe('DIV');
        expect(dom.textContent).toBe('Hello');
        expect(dom.id).toBe('test');
    });

    it('should update DOM when signal changes', () => {
        class TestComp extends Component {
            constructor(props) {
                super(props);
                this.count = signal(0);
            }
            render() { return h('div', null, `Count: ${this.count.value}`); }
        }
        const dom = createDOMNode(h(TestComp, {}));
        expect(dom.textContent).toBe('Count: 0');

        // Находим инстанс и меняем сигнал
        const inst = dom._parentComponent;
        inst.count.value = 10;
        expect(dom.textContent).toBe('Count: 10');
    });

    it('should register and run $effect', () => {
        class TestComp extends Component {
            constructor(props) {
                super(props);
                this.spy = vi.fn();
            }
            render() {
                // ИСПРАВЛЕНО: Явно вызываем spy(), а не просто возвращаем
                this.$effect(() => { this.spy(); });
                return h('div');
            }
        }
        const dom = createDOMNode(h(TestComp, {}));
        const inst = dom._parentComponent;

        expect(inst.spy).toHaveBeenCalled();

        inst.dispose();
        // Проверяем, что эффекты очистились
        expect(inst._effects.length).toBe(0);
    });

    it('should call componentWillUnmount on dispose', () => {
        class TestComp extends Component {
            constructor(props) {
                super(props);
                this.unmountSpy = vi.fn();
            }
            componentWillUnmount() { this.unmountSpy(); }
            render() { return h('div'); }
        }
        const dom = createDOMNode(h(TestComp, {}));
        const inst = dom._parentComponent;

        inst.dispose();
        expect(inst.unmountSpy).toHaveBeenCalled();
    });

    it('should use $prop helper for signals', () => {
        class TestComp extends Component {
            constructor(props) {
                super(props);
                this.$prop('val', 5);
            }
            render() { return h('div', null, this.$prop('val')); }
        }
        const dom = createDOMNode(h(TestComp, {}));
        expect(dom.textContent).toBe('5');

        const inst = dom._parentComponent;
        inst.val.value = 15;
        expect(dom.textContent).toBe('15');
    });
});

describe('App Class', () => {
    it('should mount component to selector', () => {
        document.body.innerHTML = '<div id="app-root"></div>';
        class TestComp extends Component { render() { return h('div', null, 'Mounted'); } }

        const app = new App('#app-root');
        app.mount(TestComp, {});

        expect(document.querySelector('#app-root').innerHTML).toBe('<div>Mounted</div>');
    });

    it('should create root if selector not found', () => {
        document.body.innerHTML = '';
        class TestComp extends Component { render() { return h('div', null, 'Dynamic'); } }

        const app = new App('#non-existent');
        app.mount(TestComp, {});

        const createdRoot = document.querySelector('#non-existent');
        expect(createdRoot).not.toBeNull();
        expect(createdRoot.textContent).toBe('Dynamic');
    });

    it('should unmount and clean DOM', () => {
        document.body.innerHTML = '<div id="app-root"></div>';
        class TestComp extends Component { render() { return h('div', null, 'Remove Me'); } }

        const app = new App('#app-root');
        app.mount(TestComp, {});
        expect(document.querySelector('#app-root').children.length).toBe(1);

        app.unmount();
        expect(document.querySelector('#app-root').children.length).toBe(0);
    });
});

describe('Suspense Class', () => {
    it('should render fallback when child throws promise', async () => {
        let resolvePromise;
        let hasThrown = false;

        const fakeLazy = () => {
            if (!hasThrown) {
                hasThrown = true;
                throw new Promise((res) => { resolvePromise = res; });
            }
            return h('div', null, 'Loaded Content');
        };

        const vnode = h(Suspense, { fallback: h('div', null, 'Loading...') }, h(fakeLazy));
        const dom = createDOMNode(vnode);

        const inst = dom._component || dom._parentComponent;

        expect(dom.textContent).toBe('Loading...');

        resolvePromise();
        await new Promise(r => setTimeout(r, 0));

        expect(inst.host.textContent).toBe('Loaded Content');
    });
    it('should render error fallback on non-promise error', () => {
        const fakeErrorComp = () => { throw new Error('Real Error!'); };
        const vnode = h(Suspense, { fallback: h('div', null, 'Loading') }, h(fakeErrorComp));

        // Так как это синхронная ошибка, а не Promise, componentDidCatch сохранит её в state.error
        const dom = createDOMNode(vnode);
        expect(dom.textContent).toBe('Error: Real Error!');
    });
});

describe('KeepAlive Class', () => {
    it('should cache component state when switched out', () => {
        class Counter extends Component {
            constructor(props) {
                super(props);
                this.count = signal(0);
            }
            render() { return h('div', null, `Count: ${this.count.value}`); }
        }

        const vnode1 = h(KeepAlive, { name: 'counter' }, h(Counter));
        const dom = createDOMNode(vnode1);
        expect(dom.textContent).toBe('Count: 0');

        // ИСПРАВЛЕНО: Ищем инстанс внутри обертки
        const counterInst = dom.firstChild._component || dom.firstChild._parentComponent;
        counterInst.count.value = 99;
        expect(dom.textContent).toBe('Count: 99');

        // Патчим KeepAlive, убирая детей (children = null)
        const vnode2 = h(KeepAlive, { name: 'counter' }, null);
        patch(vnode1, vnode2, dom);

        // Проверяем, что компонент скрылся (display: none)
        const wrapper = dom._parentComponent.host;
        expect(wrapper.style.display).toBe('none');

        // Возвращаем компонент
        const vnode3 = h(KeepAlive, { name: 'counter' }, h(Counter));
        patch(vnode2, vnode3, dom);

        // Проверяем, что состояние сохранилось (99), а не сбросилось (0)
        const newWrapper = dom._parentComponent.host;
        expect(newWrapper.textContent).toBe('Count: 99');
    });
});

describe('Delegator Class', () => {
    it('should catch events via delegation', () => {
        const clickSpy = vi.fn();
        // Delegator принимает селектор и обработчик
        const vnode = h(Delegator, {
            selector: '.btn',
            onclick: clickSpy
        }, h('button', { class: 'btn' }, 'Click Me'));

        const dom = createDOMNode(vnode);
        document.body.appendChild(dom);

        // Кликаем по кнопке внутри Delegator
        const btn = dom.querySelector('.btn');
        btn.dispatchEvent(new Event('click', { bubbles: true }));

        expect(clickSpy).toHaveBeenCalled();

        document.body.removeChild(dom);
    });
});