import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../src/vnano.js';
import '../src/vnano.components.js';
import { h, createDOMNode } from '../src/vnano.js';

// Мок для IntersectionObserver
let observerCallbacks = [];
const __img__ = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQKMT-WFfIQjUanh2LTIl0D_1hJn3MW8CmchNM3y2_2Eg&s=10";

beforeEach(() => {
    observerCallbacks = [];
    window.IntersectionObserver = vi.fn(function(cb, options) {
        observerCallbacks.push({ cb, options });
        return {
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn()
        };
    });
});

// Вспомогательная функция для симуляции входа/выхода из зоны видимости
function triggerVisibility(isIntersecting) {
    observerCallbacks.forEach(o => o.cb([{ isIntersecting }]));
}

describe('LazyImage', () => {
    it('should render placeholder with hidden img initially', () => {
        const dom = createDOMNode(h(window.$v.LazyImage, { src: __img__, height: "285px", width: "300px" }));

        // Внешний блок (плейсхолдер)
        expect(dom.style.height).toBe('285px');
        expect(dom.style.width).toBe('300px');
        console.dir(dom.style.background);
        expect(dom.style.background).toBe('#eee'); // #eee

        // Внутренняя картинка
        const img = dom.querySelector('img');
        expect(img).not.toBeNull();
        expect(img.style.opacity).toBe('0'); // Скрыта
        expect(img.getAttribute('src')).toBe(''); // Пустой src
    });

    it('should load image when visible and fade in on load', () => {
        const dom = createDOMNode(h(window.$v.LazyImage, { src: __img__ }));
        const img = dom.querySelector('img');

        // Симулируем появление картинки на экране
        triggerVisibility(true);

        // src должен установиться
        expect(img.src).toBe(__img__);

        // Симулируем завершение загрузки картинки браузером
        img.onload();

        // Прозрачность должна исчезнуть (картинка проявится)
        expect(img.style.opacity).toBe('1');
    });
});

describe('InfiniteScroll', () => {
    it('should call loadMore when visible', async () => {
        const loadMore = vi.fn(() => new Promise(r => setTimeout(r, 10)));
        createDOMNode(h(window.$v.InfiniteScroll, { loadMore }));

        // Симулируем докручивание до конца списка
        triggerVisibility(true);

        expect(loadMore).toHaveBeenCalledTimes(1);

        // Ждем пока промис зарезолвится
        await new Promise(r => setTimeout(r, 20));

        // Симулируем второй раз
        triggerVisibility(true);
        expect(loadMore).toHaveBeenCalledTimes(2);
    });

    it('should not call loadMore again while loading (debounce)', async () => {
        const loadMore = vi.fn(() => new Promise(r => setTimeout(r, 50)));
        createDOMNode(h(window.$v.InfiniteScroll, { loadMore }));

        // Вызываем первый раз
        triggerVisibility(true);
        expect(loadMore).toHaveBeenCalledTimes(1);

        // Пытаемся вызвать еще 3 раза подряд (пока промис еще не зарезолвился)
        triggerVisibility(true);
        triggerVisibility(true);
        triggerVisibility(true);
        expect(loadMore).toHaveBeenCalledTimes(1); // Вызовов не должно стать больше!

        // Ждем резолва промиса
        await new Promise(r => setTimeout(r, 60));

        // Теперь снова можем вызывать
        triggerVisibility(true);
        expect(loadMore).toHaveBeenCalledTimes(2);
    });
});