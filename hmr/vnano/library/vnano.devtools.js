// vnano.devtools.js
(function (global) {
    const DEVTOOLS_KEY = 'v'; // Клавиша переключения (Ctrl+Alt+V)

    class DevToolsManager {
        constructor() {
            this.panel = null;
            this.treeContainer = null;
            this.inspectorContainer = null;
            this.domInfoContainer = null;
            this.resizer = null;
            this._interval = null;
            this._selectedComp = null;
            this.overlay = null;
            this.overlayLabel = null;
            this.overlayEnabled = true;
            this._signalRegistry = new Map();
            this._patchSignal();
            this._setupKeyboard();
        }

        _patchSignal() {
            if (!global.$v || !global.$v.signal) return;
            const originalSignal = global.$v.signal;
            const self = this;

            global.$v.signal = function (initialValue) {
                const sig = originalSignal(initialValue);
                const id = Math.random().toString(36).substr(2, 9);
                self._signalRegistry.set(id, sig);

                // Возвращаем прокси, чтобы DevTools видел изменения
                return {
                    get value() {
                        return sig.value;
                    },
                    set value(v) {
                        sig.value = v;
                    }
                };
            };
        }

        init() {
            if (this.panel) return;

            // Создаем основную панель
            this.panel = document.createElement('div');
            this.panel.id = 'vnano-devtools';
            this.panel.style.cssText = `
                position: fixed; bottom: 0; left: 0; right: 0; width: 100%; height: 300px; 
                background: #1e1e1e; color: #e0e0e0; border-top: 2px solid #007bff; 
                z-index: 99999; font-family: 'Consolas', monospace; font-size: 12px; 
                display: flex; flex-direction: column; box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
            `;

            // Ресайзер (верхняя кромка)
            this.resizer = document.createElement('div');
            this.resizer.style.cssText = `height: 4px; background: #007bff; cursor: ns-resize; flex-shrink: 0;`;
            this.panel.appendChild(this.resizer);

            // Хедер с кнопками
            // Хедер с кнопками
            const header = document.createElement('div');
            header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 15px; background: #252526; border-bottom: 1px solid #333;`;

            const leftHeader = document.createElement('div');
            leftHeader.style.cssText = `display: flex; align-items: center;`;

            const title = document.createElement('span');
            title.textContent = '⚡ vnano DevTools (Ctrl+Alt+V)';
            title.style.fontWeight = 'bold';
            leftHeader.appendChild(title);

            // НОВОЕ: Чекбокс для оверлея
            const overlayToggleLabel = document.createElement('label');
            overlayToggleLabel.style.cssText = 'color: #aaa; font-weight: normal; margin-left: 15px; display: flex; align-items: center; cursor: pointer; user-select: none;';
            overlayToggleLabel.innerHTML = `<input type="checkbox" id="vnano-overlay-toggle" checked style="margin-right: 5px; cursor: pointer;"> Highlight Overlay`;
            leftHeader.appendChild(overlayToggleLabel);

            header.appendChild(leftHeader);

            const controls = document.createElement('div');
            controls.innerHTML = `
                <button id="vnano-min" style="background:#333;color:#fff;border:none;padding:4px 8px;cursor:pointer;margin-right:5px;">Min</button>
                <button id="vnano-max" style="background:#333;color:#fff;border:none;padding:4px 8px;cursor:pointer;margin-right:5px;">Max</button>
                <button id="vnano-close" style="background:#e74c3c;color:#fff;border:none;padding:4px 8px;cursor:pointer;">X</button>
            `;
            header.appendChild(controls);
            this.panel.appendChild(header);

            // Тело (Дерево + Инспектор + DOM Info)
            // Тело (Дерево + Ресайзер + Инспектор + Ресайзер + DOM Info)
            const body = document.createElement('div');
            body.style.cssText = `display: flex; flex: 1; overflow: hidden;`;

            this.treeContainer = document.createElement('div');
            this.treeContainer.id = 'vnano-tree'; // НОВОЕ
            this.treeContainer.style.cssText = `width: 250px; flex-shrink: 0; overflow-y: auto; padding: 10px;`;
            body.appendChild(this.treeContainer);

            // НОВЫЙ Ресайзер 1
            const resizer1 = document.createElement('div');
            resizer1.style.cssText = `width: 4px; background: #333; cursor: col-resize; flex-shrink: 0; transition: background 0.2s;`;
            body.appendChild(resizer1);

            this.inspectorContainer = document.createElement('div');
            this.inspectorContainer.id = 'vnano-inspector'; // НОВОЕ
            this.inspectorContainer.style.cssText = `width: 350px; flex-shrink: 0; overflow-y: auto; padding: 10px; color: #d4d4d4;`;
            this.inspectorContainer.textContent = 'Select a component...';
            body.appendChild(this.inspectorContainer);

            // НОВЫЙ Ресайзер 2
            const resizer2 = document.createElement('div');
            resizer2.style.cssText = `width: 4px; background: #333; cursor: col-resize; flex-shrink: 0; transition: background 0.2s;`;
            body.appendChild(resizer2);

            // НОВАЯ 3-я колонка
            this.domInfoContainer = document.createElement('div');
            this.domInfoContainer.id = 'vnano-dom-info'; // НОВОЕ
            this.domInfoContainer.style.cssText = `flex: 1; overflow-y: auto; padding: 10px; color: #d4d4d4;`;
            this.domInfoContainer.textContent = 'No component selected.';
            body.appendChild(this.domInfoContainer);

            this.panel.appendChild(body);

            // НОВОЕ: Настройка ресайзеров колонок
            this._setupColumnResize(resizer1, this.treeContainer, this.inspectorContainer);
            this._setupColumnResize(resizer2, this.inspectorContainer, this.domInfoContainer);
            document.body.appendChild(this.panel);

            this._setupControls();
            this._setupResize();

            // Запускаем обновление дерева
            this._interval = setInterval(() => this._renderTree(), 1000);

            // Создаем оверлей для подсветки элемента
            this.overlay = document.createElement('div');
            this.overlay.style.cssText = `
                position: fixed; 
                background: rgba(0, 123, 255, 0.15); 
                border: 1px solid #007bff; 
                z-index: 99998; 
                pointer-events: none; 
                display: none; 
                box-sizing: border-box;
                transition: all 0.05s ease;
            `;

            this.overlayLabel = document.createElement('div');
            this.overlayLabel.style.cssText = `
                position: absolute; top: -20px; left: -1px; 
                background: #007bff; color: white; 
                padding: 2px 6px; font-size: 10px; 
                font-family: sans-serif; border-radius: 2px;
                white-space: nowrap; pointer-events: none;
            `;
            this.overlay.appendChild(this.overlayLabel);
            document.body.appendChild(this.overlay);

            // Слушатель скролла для обновления позиции оверлея
            this._scrollHandler = () => this._updateOverlay();
            window.addEventListener('scroll', this._scrollHandler, true);

            // Запускаем обновление дерева
        }

        _setupColumnResize(resizer, leftEl, rightEl) {
            let isResizing = false;
            let startX, startLeftWidth, startRightWidth;

            // Подсветка ресайзера при наведении
            resizer.addEventListener('mouseenter', () => resizer.style.background = '#007bff');
            resizer.addEventListener('mouseleave', () => resizer.style.background = '#333');

            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;

                // Запоминаем начальные ширины
                startLeftWidth = leftEl.offsetWidth;
                startRightWidth = rightEl.offsetWidth;

                // Отключаем flex для ручного управления шириной
                rightEl.style.flex = 'none';
                rightEl.style.width = startRightWidth + 'px';

                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none'; // Предотвращаем выделение текста
                e.preventDefault();
            });

            const onMouseMove = (e) => {
                if (!isResizing) return;
                const dx = e.clientX - startX;

                let newLeftWidth = startLeftWidth + dx;
                let newRightWidth = startRightWidth - dx;

                // Минимальная ширина колонки (100px)
                if (newLeftWidth > 100 && newRightWidth > 100) {
                    leftEl.style.width = newLeftWidth + 'px';
                    rightEl.style.width = newRightWidth + 'px';
                }
            };

            const onMouseUp = () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = 'default';
                    document.body.style.userSelect = 'auto';
                }
            };

            // Вешаем слушатели на document, чтобы не "потерять" курсор при быстром движении мыши
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            // Сохраняем ссылки для возможности очистки в destroy()
            if (!this._resizeHandlers) this._resizeHandlers = [];
            this._resizeHandlers.push({ mousemove: onMouseMove, mouseup: onMouseUp });
        }

        _updateOverlay() {
            // НОВОЕ: Если оверлей выключен, ничего не делаем
            if (!this.overlayEnabled || !this._selectedComp || !this.overlay) return;

            const el = this._selectedComp.host;
            if (!el || !el.nodeType) {
                this.overlay.style.display = 'none';
                return;
            }

            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                this.overlay.style.display = 'none';
                return;
            }

            this.overlay.style.display = 'block';
            this.overlay.style.left = rect.left + 'px';
            this.overlay.style.top = rect.top + 'px';
            this.overlay.style.width = rect.width + 'px';
            this.overlay.style.height = rect.height + 'px';

            const name = this._selectedComp.constructor?.name || this._selectedComp.render?.name || 'Anonymous';
            const tag = el.tagName?.toLowerCase() || '#text';
            this.overlayLabel.textContent = `<${tag}> ${name}`;
        }

        _setupControls() {
            document.getElementById('vnano-close').onclick = () => this.destroy();
            document.getElementById('vnano-min').onclick = () => {
                this.panel.style.height = '40px';
                this.panel.style.overflow = 'hidden';
            };
            document.getElementById('vnano-max').onclick = () => {
                this.panel.style.height = '50vh';
                this.panel.style.overflow = 'visible';
            };

            // Обработчик чекбокса оверлея
            const overlayToggle = document.getElementById('vnano-overlay-toggle');
            if (overlayToggle) {
                overlayToggle.onchange = (e) => {
                    this.overlayEnabled = e.target.checked;
                    if (!this.overlayEnabled && this.overlay) {
                        this.overlay.style.display = 'none';
                    } else if (this.overlayEnabled) {
                        this._updateOverlay(); // Сразу обновляем, если включили
                    }
                };
            }
        }

        _updateDomInfo() {
            if (!this._selectedComp || !this.domInfoContainer) return;
            const openSpoilers = Array.from(this.domInfoContainer.querySelectorAll('details[open]'))
                .map(d => d.querySelector('summary')?.textContent);

            const el = this._selectedComp.host;
            if (!el || !el.nodeType) {
                this.domInfoContainer.innerHTML = '<i style="color:#888;">No host element available</i>';
                return;
            }

            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            let html = '<div style="margin-bottom: 20px;"><h4 style="color:#007bff; margin:0 0 5px 0;">Host Element (DOM)</h4></div>';

            // 1. Базовая инфа об элементе
            // 1. Базовая инфа об элементе
            html += '<div style="margin-bottom: 15px;">';
            html += '<div style="color:#e0e0e0; font-weight:bold; margin-bottom: 5px; border-bottom: 1px solid #444; padding-bottom: 2px;">Element</div>';
            html += `<div style="padding-left: 15px; margin-bottom: 4px;">Tag: <span style="color:#ce9178;">&lt;${el.tagName.toLowerCase()}&gt;</span></div>`;
            if (el.id) html += `<div style="padding-left: 15px; margin-bottom: 4px;">ID: <span style="color:#ce9178;">#${el.id}</span></div>`;
            if (el.className) html += `<div style="padding-left: 15px; margin-bottom: 4px;">Class: <span style="color:#ce9178;">.${String(el.className).split(' ').join('.')}</span></div>`;

            // НОВОЕ: Добавляем имя компонента-владельца
            const ownerName = this._selectedComp.constructor?.name || this._selectedComp.render?.name || 'Anonymous';
            html += `<div style="padding-left: 15px; margin-bottom: 4px; margin-top: 8px; border-top: 1px dashed #333; padding-top: 8px;">Owner Component: <span style="color:#4CAF50; font-weight:bold;">${ownerName}</span></div>`;
            html += '</div>';
            // 2. Размеры и позиция
            html += '<div style="margin-bottom: 15px;">';
            html += '<div style="color:#e0e0e0; font-weight:bold; margin-bottom: 5px; border-bottom: 1px solid #444; padding-bottom: 2px;">Sizes & Position</div>';
            html += `<div style="padding-left: 15px; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px;">`;
            html += `<span style="color:#9cdcfe;">Offset W/H:</span><span>${el.offsetWidth} x ${el.offsetHeight}px</span>`;
            html += `<span style="color:#9cdcfe;">Client W/H:</span><span>${el.clientWidth} x ${el.clientHeight}px</span>`;
            html += `<span style="color:#9cdcfe;">Top:</span><span>${Math.round(rect.top)}px</span>`;
            html += `<span style="color:#9cdcfe;">Left:</span><span>${Math.round(rect.left)}px</span>`;
            html += `</div></div>`;

            // 3. Стили (Фон, Цвет, Display)
            html += '<div style="margin-bottom: 15px;">';
            html += '<div style="color:#e0e0e0; font-weight:bold; margin-bottom: 5px; border-bottom: 1px solid #444; padding-bottom: 2px;">Computed Styles</div>';
            html += `<div style="padding-left: 15px; margin-bottom: 4px;">Background: <span style="color:#ce9178;">${style.backgroundColor}</span></div>`;
            html += `<div style="padding-left: 15px; margin-bottom: 4px;">Color: <span style="color:#ce9178;">${style.color}</span></div>`;
            html += `<div style="padding-left: 15px; margin-bottom: 4px;">Display: <span style="color:#ce9178;">${style.display}</span></div>`;
            html += `<div style="padding-left: 15px; margin-bottom: 4px;">Padding: <span style="color:#ce9178;">${style.padding}</span></div>`;
            html += '</div>';

            // 4. Содержимое (Text и HTML)
            html += '<div>';
            html += '<div style="color:#e0e0e0; font-weight:bold; margin-bottom: 5px; border-bottom: 1px solid #444; padding-bottom: 2px;">Content</div>';
            const text = el.innerText || '';
            const textPreview = text.length > 50 ? text.substring(0, 50) + '...' : text;
            html += `<div style="padding-left: 15px; margin-bottom: 4px;">Text: <span style="color:#ce9178;">${textPreview || 'Empty'}</span></div>`;

            const htmlContent = el.innerHTML || '';
            if (htmlContent.length > 0) {
                // Экранируем HTML для отображения
                const escapedHtml = htmlContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html += `<details style="margin-left: 15px; margin-top: 5px; color: #9cdcfe;"><summary style="cursor:pointer; outline:none;">HTML Content</summary><pre style="margin:0; margin-left: 15px; color:#ce9178; font-size: 11px; white-space: pre-wrap; word-wrap: break-word; max-height: 150px; overflow-y: auto;">${escapedHtml}</pre></details>`;
            }
            html += '</div>';

            this.domInfoContainer.innerHTML = html;

            //  Восстанавливаем открытые спойлеры после перерисовки
            this.domInfoContainer.querySelectorAll('details').forEach(d => {
                const summaryText = d.querySelector('summary')?.textContent;
                if (openSpoilers.includes(summaryText)) {
                    d.setAttribute('open', '');
                }
            });

            //  Обновляем позицию оверлея
            this._updateOverlay();
        }

        _setupKeyboard() {
            this._keyHandler = (e) => {
                if (e.ctrlKey && e.altKey && e.key.toLowerCase() === DEVTOOLS_KEY) {
                    e.preventDefault();
                    if (this.panel) {
                        this.destroy();
                    } else {
                        this.init();
                    }
                }
            };
            document.addEventListener('keydown', this._keyHandler);
        }

        _setupResize() {
            let isResizing = false;
            let startY, startHeight;

            this.resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                startHeight = parseInt(getComputedStyle(this.panel).height, 10);
                document.body.style.cursor = 'ns-resize';
                e.preventDefault(); // Предотвращаем выделение текста
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const newHeight = startHeight - (e.clientY - startY);
                if (newHeight > 40 && newHeight < window.innerHeight - 100) {
                    this.panel.style.height = newHeight + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = 'default';
                }
            });
        }

        _renderTree() {
            if (!this.treeContainer) return;
            this.treeContainer.innerHTML = '';

            const walk = (node, depth = 0) => {
                if (!node) return;

                node.childNodes.forEach(child => {
                    const comp = child._component || child._parentComponent;
                    if (comp) {
                        const div = document.createElement('div');
                        div.style.marginLeft = `${depth * 15}px`;
                        div.style.padding = '2px 0';
                        div.style.cursor = 'pointer';

                        const name = comp.constructor?.name || comp.render?.name || 'Anonymous';
                        const tag = child.tagName?.toLowerCase() || '#text';

                        const isClass = comp.constructor?.prototype?.render;
                        div.style.color = isClass ? '#4CAF50' : '#FFC107';

                        div.innerHTML = `<span style="color:#888;">${'  '.repeat(depth)}</span><${tag}> <b>${name}</b>`;

                        div.onclick = () => this._inspect(comp);
                        if (this._selectedComp === comp) {
                            div.style.background = '#333';
                        }

                        this.treeContainer.appendChild(div);
                    }

                    if (child.childNodes.length > 0) {
                        walk(child, depth + 1);
                    }
                });
            };

            walk(document.body);

            // Обновляем информацию о DOM элементе
            this._updateDomInfo();
        }

        _inspect(comp) {
            this._selectedComp = comp;
            this._renderTree(); // Обновляем подсветку

            // НОВОЕ: Сохраняем открытые спойлеры
            const openPropsSpoilers = Array.from(this.inspectorContainer.querySelectorAll('details[open]'))
                .map(d => d.querySelector('summary')?.textContent);
            // Определяем имя и тип компонента
            const compName = comp.constructor?.name || comp.render?.name || 'Anonymous';
            const isClass = !!(comp.constructor && comp.constructor.prototype && comp.constructor.prototype.render);
            const compType = isClass ? 'Class Component' : 'Function Component';


            let html = `
                <div style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #444;">
                    <div style="color:#007bff; font-weight:bold; font-size: 14px;">⚡ ${compName}</div>
                    <div style="color:#888; font-size: 11px;">${compType}</div>
                </div>
            `;
            // --- Блок PROPS ---
            html += '<div style="margin-bottom: 20px;">';
            html += '<div style="color:#e0e0e0; font-weight:bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 2px;">Props</div>';
            html += '<div style="padding-left: 15px;">';
            if (comp.props) {
                for (let k in comp.props) {
                    if (k === 'children') continue; // Пропускаем детей
                    html += `<div style="margin-bottom: 4px;"><span style="color:#9CDCFE;">${k}</span>: ${this._formatValue(comp.props[k])}</div>`;
                }
            } else {
                html += '<i style="color:#888;">None</i>';
            }
            html += '</div></div>';

            // --- Блок STATE / SIGNALS ---
            html += '<div>';
            html += '<div style="color:#e0e0e0; font-weight:bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 2px;">State / Signals</div>';
            html += '<div style="padding-left: 15px;">';
            let hasState = false;
            for (let k in comp) {
                if (k.startsWith('_') || k === 'props' || k === 'host' || k === 'htm' || k === 'html' || k === 'constructor') continue;
                hasState = true;
                html += `<div style="margin-bottom: 4px;"><span style="color:#9CDCFE;">${k}</span>: ${this._formatValue(comp[k])}</div>`;
            }
            if (!hasState) html += '<i style="color:#888;">None</i>';
            html += '</div></div>';

            this.inspectorContainer.innerHTML = html;
            // Восстанавливаем открытые спойлеры
            this.inspectorContainer.querySelectorAll('details').forEach(d => {
                const summaryText = d.querySelector('summary')?.textContent;
                if (openPropsSpoilers.includes(summaryText)) {
                    d.setAttribute('open', '');
                }
            });
            // Обновляем подсветку
            this._updateOverlay();
        }

        // Вспомогательный метод для форматирования значений (с поддержкой вложенности и спойлеров)
        _formatValue(val) {
            if (val === null) return '<span style="color:#569cd6;">null</span>';
            if (typeof val === 'function') return '<span style="color:#dcdcaa;">[Function]</span>';

            // Проверка, является ли значение сигналом
            let isSignal = false;
            let actualVal = val;
            try {
                if (val && typeof val === 'object' && 'value' in val && !Array.isArray(val)) {
                    actualVal = val.value;
                    isSignal = true;
                }
            } catch (e) {
            }

            // Форматируем содержимое
            let contentHtml = this._formatPrimitive(actualVal);

            if (isSignal) {
                return `<span style="color:#b5cea8;">Signal(</span>${contentHtml}<span style="color:#b5cea8;">)</span>`;
            }
            return contentHtml;
        }

        _formatPrimitive(val) {
            if (val === null) return '<span style="color:#569cd6;">null</span>';
            if (typeof val === 'function') return '<span style="color:#dcdcaa;">[Function]</span>';
            if (typeof val !== 'object') {
                // Строки, числа, булевы
                return `<span style="color:#ce9178;">${JSON.stringify(val)}</span>`;
            }

            // Объекты и массивы — делаем спойлер
            const str = JSON.stringify(val, null, 2);
            const type = Array.isArray(val) ? `Array(${val.length})` : 'Object';

            return `<details style="margin-left: 10px; margin-top: 2px; color: #9cdcfe;"><summary style="cursor:pointer; outline:none; user-select:none;">${type}</summary><pre style="margin:0; margin-left: 15px; color:#ce9178; font-size: 11px; white-space: pre-wrap; word-wrap: break-word;">${str}</pre></details>`;
        }

        destroy() {
            if (this._interval) clearInterval(this._interval);
            if (this._scrollHandler) window.removeEventListener('scroll', this._scrollHandler, true);
            if (this._resizeHandlers) {
                this._resizeHandlers.forEach(({ mousemove, mouseup }) => {
                    document.removeEventListener('mousemove', mousemove);
                    document.removeEventListener('mouseup', mouseup);
                });
            }
            if (this.overlay) this.overlay.remove();

            // НОВОЕ: Пуленепробиваемое удаление панели из DOM
            const panelEl = document.getElementById('vnano-devtools');
            if (panelEl) panelEl.remove();

            this.panel = null;
            this.overlay = null;
        }
    }

    const devtoolsInstance = new DevToolsManager();

    if (global.$v) {
        global.$v.devtools = devtoolsInstance;
    }

})(typeof window !== 'undefined' ? window : globalThis);