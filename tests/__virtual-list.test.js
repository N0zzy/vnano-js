import { describe, it, expect, vi } from 'vitest';
// Импортируем ядро, чтобы фреймворк проинициализировался и создал глобальный $v
import '../src/vnano.js';
// Импортируем файл компонентов, чтобы он выполнился и повесил класс на $v
import '../src/vnano.components.js';
import { h, createDOMNode } from '../src/vnano.js';

// Достаем класс из глобального объекта
const VirtualList = globalThis.$v.VirtualList;

// Мокаем requestAnimationFrame, чтобы он работал синхронно в тестах
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

describe('VirtualList (Pure JS Vanilla)', () => {
    it('should mount, create DOM pool, and setup scroll track', () => {
        const items = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
        const renderItem = vi.fn((item, domEl) => {
            domEl.textContent = `Item ${item.id}`;
        });

        const vnode = h(VirtualList, { items, itemHeight: 40, height: 200, renderItem });
        const dom = createDOMNode(vnode);

        // 1. Проверяем стили контейнера
        expect(dom.style.overflowY).toBe('auto');
        expect(dom.style.height).toBe('200px');
        expect(dom.style.position).toBe('relative');

        // 2. Проверяем фейковый трек (первый ребенок) - высота должна быть 10000 * 40
        const track = dom.children[0];
        expect(track.style.height).toBe('400000px');

        // 3. Проверяем, что создано всего ~16 DOM узлов (1 трек + 15 пул), а не 10000
        // Высота 200 / 40 = 5 видимых + 10 буфер = 15. Плюс 1 трек = 16.
        expect(dom.children.length).toBe(16);

        // 4. Проверяем, что первый элемент пула отрендерился и спозиционирован
        const firstPoolEl = dom.children[1]; // 0-й это трек
        expect(firstPoolEl.style.top).toBe('0px');
        expect(firstPoolEl.textContent).toBe('Item 0');

        // renderItem должен был вызваться только для видимых элементов (15 раз)
        expect(renderItem).toHaveBeenCalledTimes(15);
    });

    it('should update DOM pool on scroll event', async () => {
        const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
        const renderItem = (item, domEl) => {
            domEl.textContent = `Item ${item.id}`;
            domEl.dataset.id = item.id;
        };

        const dom = createDOMNode(h(VirtualList, { items, itemHeight: 40, height: 200, renderItem }));

        // Симулируем скролл контейнера на 400px вниз (10 строк)
        dom.scrollTop = 400;
        dom.dispatchEvent(new Event('scroll'));

        // Ждем выполнения requestAnimationFrame
        await new Promise(r => setTimeout(r, 10));

        // Проверяем, что элементы пула сдвинулись и обновили контент
        // Из-за буфера 5, первый рендеримый элемент будет индекс 5 (10 - 5 = 5)
        const firstPoolEl = dom.children[1];
        expect(firstPoolEl.style.top).toBe('200px'); // ИСПРАВЛЕНО: 5 * 40 = 200
        expect(firstPoolEl.textContent).toBe('Item 5'); // ИСПРАВЛЕНО: Item 5
        expect(firstPoolEl.dataset.id).toBe('5');      // ИСПРАВЛЕНО: '5'
    });

    it('should update track height and re-render when items change', () => {
        const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
        const renderItem = vi.fn();
        const vnode = h(VirtualList, { items, itemHeight: 40, height: 200, renderItem });
        const dom = createDOMNode(vnode);

        const inst = dom._component;
        const track = dom.children[0];
        expect(track.style.height).toBe('40000px'); // 1000 * 40

        // Меняем props (уменьшаем массив до 500 элементов)
        inst.props.items = Array.from({ length: 500 }, (_, i) => ({ id: i }));

        // Вызываем обновление фреймворка
        inst.update();

        // Высота трека должна уменьшиться
        expect(track.style.height).toBe('20000px'); // 500 * 40
        // Пул должен был сброситься и перерисоваться
        expect(renderItem).toHaveBeenCalled();
    });

    it('should clean up DOM and listeners on unmount', () => {
        const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
        const renderItem = vi.fn();
        const dom = createDOMNode(h(VirtualList, { items, itemHeight: 40, height: 200, renderItem }));
        const inst = dom._component;

        // Проверяем, что контейнер populated
        expect(dom.children.length).toBeGreaterThan(0);

        // Размонтируем
        inst.componentWillUnmount();

        // Внутренности должны быть очищены
        expect(dom.children.length).toBe(0);
    });

    it('should render infinite mode using length prop without items array', () => {
        const renderItem = vi.fn((index, domEl) => {
            domEl.textContent = `Item ${index}`;
        });

        const vnode = h(VirtualList, {
            length: 1000000, // 1 миллион элементов
            itemHeight: 40,
            height: 200,
            renderItem
        });
        const dom = createDOMNode(vnode);

        // Высота трека должна быть 2,000,000px (динамический режим)
        const track = dom.children[0];
        expect(track.style.height).toBe('2000000px');

        // Должно отрендериться только ~16 элементов
        expect(dom.children.length).toBe(16);

        // renderItem должен вызваться 15 раз с индексами
        expect(renderItem).toHaveBeenCalledTimes(15);
        expect(renderItem.mock.calls[0][0]).toBe(0); // Первый вызов с индексом 0
    });
});