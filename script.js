document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const container = document.getElementById('canvas-container');
    const svgLayer = document.getElementById('arrow-svg-layer');
    
    // 隠し入力要素の作成
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    hiddenInput.setAttribute('autocomplete', 'off');
    hiddenInput.setAttribute('autocorrect', 'off');
    hiddenInput.setAttribute('spellcheck', 'false');
    container.appendChild(hiddenInput);

    // 定数
    const GRID_SIZE = 20;
    const ARROW_DIRECTIONS = {
        'ArrowUp': 'up',
        'ArrowDown': 'down', 
        'ArrowLeft': 'left',
        'ArrowRight': 'right'
    };

    // 状態管理
    let paperData = {};
    let boxes = [];
    let arrows = {};
    let nextId = 0;
    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal';
    let selectionStart = null;
    let pendingArrow = null;
    let isComposing = false;
    let compositionText = '';

    // カーソル要素の作成
    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    /**
     * 位置文字列をパースして座標オブジェクトを返す
     * @param {string} key - "x,y" 形式の文字列
     * @returns {{x: number, y: number}|null}
     */
    function parsePosition(key) {
        try {
            const [x, y] = key.split(',').map(Number);
            if (isNaN(x) || isNaN(y)) return null;
            return { x, y };
        } catch (error) {
            console.warn('Position parsing error:', error);
            return null;
        }
    }

    /**
     * 座標を位置文字列に変換
     * @param {number} x 
     * @param {number} y 
     * @returns {string}
     */
    function positionToKey(x, y) {
        return `${x},${y}`;
    }

    /**
     * カーソルを安全に移動
     * @param {number} dx - X方向の移動量
     * @param {number} dy - Y方向の移動量
     */
    function moveCursor(dx, dy) {
        cursorPosition.x = Math.max(0, cursorPosition.x + dx);
        cursorPosition.y = Math.max(0, cursorPosition.y + dy);
    }

    /**
     * SVGマーカー（矢印の先端）を作成
     */
    function createArrowMarker() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        
        marker.id = 'arrowhead';
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '5');
        marker.setAttribute('markerHeight', '5');
        marker.setAttribute('orient', 'auto-start-reverse');
        
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        pathEl.setAttribute('fill', '#333');
        
        marker.appendChild(pathEl);
        defs.appendChild(marker);
        
        return defs;
    }

    /**
     * セル内に矢印を描画
     * @param {number} x 
     * @param {number} y 
     * @param {string} direction 
     * @param {boolean} isPreview 
     */
    function drawCellArrow(x, y, direction, isPreview = false) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const centerOffset = GRID_SIZE / 2;
        const padding = 2;
        
        let x1, y1, x2, y2;
        
        switch (direction) {
            case 'right':
                x1 = x + padding;
                y1 = y + centerOffset;
                x2 = x + GRID_SIZE - padding;
                y2 = y + centerOffset;
                break;
            case 'left':
                x1 = x + GRID_SIZE - padding;
                y1 = y + centerOffset;
                x2 = x + padding;
                y2 = y + centerOffset;
                break;
            case 'down':
                x1 = x + centerOffset;
                y1 = y + padding;
                x2 = x + centerOffset;
                y2 = y + GRID_SIZE - padding;
                break;
            case 'up':
                x1 = x + centerOffset;
                y1 = y + GRID_SIZE - padding;
                x2 = x + centerOffset;
                y2 = y + padding;
                break;
            default:
                return;
        }
        
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('class', 'arrow-line');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        
        if (isPreview) {
            line.style.opacity = '0.5';
        }
        
        svgLayer.appendChild(line);
    }

    /**
     * 文字セルを作成
     * @param {string} char 
     * @param {number} x 
     * @param {number} y 
     * @param {boolean} isComposingChar 
     */
    function createCharCell(char, x, y, isComposingChar = false) {
        const charCell = document.createElement('div');
        charCell.classList.add('char-cell');
        
        if (isComposingChar) {
            charCell.classList.add('composing-char');
        }
        
        charCell.style.left = `${x}px`;
        charCell.style.top = `${y}px`;
        charCell.innerText = char === '\n' ? '' : char;
        
        container.appendChild(charCell);
    }

    /**
     * 選択範囲の矩形を取得
     * @returns {{x: number, y: number, width: number, height: number}|null}
     */
    function getSelectionRect() {
        if (!selectionStart) return null;
        
        const x1 = Math.min(selectionStart.x, cursorPosition.x);
        const y1 = Math.min(selectionStart.y, cursorPosition.y);
        const x2 = Math.max(selectionStart.x, cursorPosition.x);
        const y2 = Math.max(selectionStart.y, cursorPosition.y);
        
        return {
            x: x1,
            y: y1,
            width: x2 - x1 + GRID_SIZE,
            height: y2 - y1 + GRID_SIZE
        };
    }

    /**
     * 文字を挿入し、後続の文字をシフト
     * @param {string} char 
     */
    function insertChar(char) {
        const currentKey = positionToKey(cursorPosition.x, cursorPosition.y);
        const currentY = cursorPosition.y;
        
        // 同じ行の右側にある文字を取得してソート
        const charsToShift = Object.keys(paperData)
            .map(key => {
                const pos = parsePosition(key);
                return pos ? { key, ...pos } : null;
            })
            .filter(item => item && item.y === currentY && item.x >= cursorPosition.x)
            .sort((a, b) => b.x - a.x); // 右から左へソート
        
        // 文字を右にシフト
        charsToShift.forEach(item => {
            const newKey = positionToKey(item.x + GRID_SIZE, item.y);
            paperData[newKey] = paperData[item.key];
            delete paperData[item.key];
        });
        
        // 新しい文字を挿入
        paperData[currentKey] = char;
        moveCursor(GRID_SIZE, 0);
    }

    /**
     * カーソルの前の文字を削除
     */
    function deleteCharBackward() {
        if (cursorPosition.x === 0) return;
        
        const prevX = cursorPosition.x - GRID_SIZE;
        const currentY = cursorPosition.y;
        const prevKey = positionToKey(prevX, currentY);
        
        // 前の文字を削除
        delete paperData[prevKey];
        
        // 右側の文字を左にシフト
        const charsToShift = Object.keys(paperData)
            .map(key => {
                const pos = parsePosition(key);
                return pos ? { key, ...pos } : null;
            })
            .filter(item => item && item.y === currentY && item.x >= cursorPosition.x)
            .sort((a, b) => a.x - b.x); // 左から右へソート
        
        charsToShift.forEach(item => {
            const newKey = positionToKey(item.x - GRID_SIZE, item.y);
            paperData[newKey] = paperData[item.key];
            delete paperData[item.key];
        });
        
        moveCursor(-GRID_SIZE, 0);
    }

    /**
     * カーソルの後の文字を削除
     */
    function deleteCharForward() {
        const currentKey = positionToKey(cursorPosition.x, cursorPosition.y);
        const currentY = cursorPosition.y;
        
        // 現在位置の文字を削除
        delete paperData[currentKey];
        
        // 右側の文字を左にシフト
        const charsToShift = Object.keys(paperData)
            .map(key => {
                const pos = parsePosition(key);
                return pos ? { key, ...pos } : null;
            })
            .filter(item => item && item.y === currentY && item.x > cursorPosition.x)
            .sort((a, b) => a.x - b.x); // 左から右へソート
        
        charsToShift.forEach(item => {
            const newKey = positionToKey(item.x - GRID_SIZE, item.y);
            paperData[newKey] = paperData[item.key];
            delete paperData[item.key];
        });
    }

    /**
     * メイン描画関数
     */
    function render() {
        // 既存要素をクリア
        const elementsToRemove = container.querySelectorAll(
            '.char-cell, .cursor, .selection-highlight, .border-box'
        );
        elementsToRemove.forEach(el => el.remove());
        svgLayer.innerHTML = '';

        // SVGマーカーを追加
        svgLayer.appendChild(createArrowMarker());

        // 矢印を描画
        Object.keys(arrows).forEach(key => {
            const pos = parsePosition(key);
            if (pos) {
                drawCellArrow(pos.x, pos.y, arrows[key]);
            }
        });

        // 矢印プレビューを描画
        if (currentMode === 'arrow' && pendingArrow && pendingArrow.direction) {
            drawCellArrow(pendingArrow.x, pendingArrow.y, pendingArrow.direction, true);
        }

        // 枠線を描画
        boxes.forEach(box => {
            const boxEl = document.createElement('div');
            boxEl.classList.add('border-box');
            boxEl.style.left = `${box.x}px`;
            boxEl.style.top = `${box.y}px`;
            boxEl.style.width = `${box.width}px`;
            boxEl.style.height = `${box.height}px`;
            container.appendChild(boxEl);
        });

        // 文字を描画
        Object.keys(paperData).forEach(key => {
            const pos = parsePosition(key);
            if (pos) {
                createCharCell(paperData[key], pos.x, pos.y);
            }
        });

        // 選択ハイライトを描画
        if (currentMode === 'visual' && selectionStart) {
            const rect = getSelectionRect();
            if (rect) {
                const highlightEl = document.createElement('div');
                highlightEl.classList.add('selection-highlight');
                highlightEl.style.left = `${rect.x}px`;
                highlightEl.style.top = `${rect.y}px`;
                highlightEl.style.width = `${rect.width}px`;
                highlightEl.style.height = `${rect.height}px`;
                container.appendChild(highlightEl);
            }
        }

        // 入力中の文字を描画
        if (isComposing && compositionText) {
            let tempX = cursorPosition.x;
            for (const char of compositionText) {
                createCharCell(char, tempX, cursorPosition.y, true);
                tempX += GRID_SIZE;
            }
        }

        // カーソルを描画
        const cursorX = cursorPosition.x + (isComposing ? compositionText.length * GRID_SIZE : 0);
        cursorElement.style.left = `${cursorX}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);

        // 隠し入力要素の位置を調整
        hiddenInput.style.left = `${cursorX}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        hiddenInput.focus();
    }

    /**
     * ノーマルモードのキー処理
     * @param {KeyboardEvent} e 
     */
    function handleNormalModeKeys(e) {
        // モード切り替え
        if ((e.key === 'e' || e.key === 'l') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            
            if (e.key === 'e') {
                currentMode = 'visual';
                selectionStart = { ...cursorPosition };
            } else if (e.key === 'l') {
                currentMode = 'arrow';
                pendingArrow = {
                    x: cursorPosition.x,
                    y: cursorPosition.y,
                    direction: null
                };
            }
            
            render();
            return;
        }

        // 制御キーの処理
        const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter'];
        
        if (controlKeys.includes(e.key)) {
            e.preventDefault();
            
            switch (e.key) {
                case 'ArrowUp':
                    moveCursor(0, -GRID_SIZE);
                    break;
                case 'ArrowDown':
                    moveCursor(0, GRID_SIZE);
                    break;
                case 'ArrowLeft':
                    moveCursor(-GRID_SIZE, 0);
                    break;
                case 'ArrowRight':
                    moveCursor(GRID_SIZE, 0);
                    break;
                case 'Enter':
                    insertChar('\n');
                    cursorPosition.y += GRID_SIZE;
                    cursorPosition.x = 0;
                    break;
                case 'Backspace':
                    deleteCharBackward();
                    break;
                case 'Delete':
                    deleteCharForward();
                    break;
            }
            
            render();
        }
    }

    /**
     * 選択モードのキー処理
     * @param {KeyboardEvent} e 
     */
    function handleVisualModeKeys(e) {
        e.preventDefault();
        
        // カーソル移動
        if (ARROW_DIRECTIONS[e.key]) {
            switch (e.key) {
                case 'ArrowUp':
                    moveCursor(0, -GRID_SIZE);
                    break;
                case 'ArrowDown':
                    moveCursor(0, GRID_SIZE);
                    break;
                case 'ArrowLeft':
                    moveCursor(-GRID_SIZE, 0);
                    break;
                case 'ArrowRight':
                    moveCursor(GRID_SIZE, 0);
                    break;
            }
        }
        
        // 枠線作成
        else if (e.key === 'Enter') {
            const rect = getSelectionRect();
            if (rect) {
                boxes.push({
                    id: `box${nextId++}`,
                    ...rect
                });
            }
            currentMode = 'normal';
            selectionStart = null;
        }
        
        // キャンセル
        else if (e.key === 'Escape') {
            currentMode = 'normal';
            selectionStart = null;
        }
        
        // 削除
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            const rect = getSelectionRect();
            if (rect) {
                // 完全に一致する枠線を削除
                const boxToDelete = boxes.find(box =>
                    box.x === rect.x &&
                    box.y === rect.y &&
                    box.width === rect.width &&
                    box.height === rect.height
                );
                
                if (boxToDelete) {
                    boxes = boxes.filter(box => box.id !== boxToDelete.id);
                }
                
                // 範囲内の矢印を削除
                const arrowKeysToDelete = Object.keys(arrows).filter(key => {
                    const pos = parsePosition(key);
                    return pos &&
                        pos.x >= rect.x &&
                        pos.x < rect.x + rect.width &&
                        pos.y >= rect.y &&
                        pos.y < rect.y + rect.height;
                });
                
                arrowKeysToDelete.forEach(key => delete arrows[key]);
            }
            
            currentMode = 'normal';
            selectionStart = null;
        }
        
        render();
    }

    /**
     * 矢印モードのキー処理
     * @param {KeyboardEvent} e 
     */
    function handleArrowModeKeys(e) {
        e.preventDefault();
        
        // 方向設定
        if (ARROW_DIRECTIONS[e.key]) {
            pendingArrow.direction = ARROW_DIRECTIONS[e.key];
        }
        
        // 矢印確定
        else if (e.key === 'Enter') {
            if (pendingArrow && pendingArrow.direction) {
                const key = positionToKey(pendingArrow.x, pendingArrow.y);
                arrows[key] = pendingArrow.direction;
                cursorPosition.x = pendingArrow.x;
                cursorPosition.y = pendingArrow.y;
            }
            currentMode = 'normal';
            pendingArrow = null;
        }
        
        // キャンセル
        else if (e.key === 'Escape') {
            currentMode = 'normal';
            pendingArrow = null;
        }
        
        render();
    }

    /**
     * テキスト入力処理
     * @param {string} text 
     */
    function handleTextInput(text) {
        if (text) {
            for (const char of text) {
                insertChar(char);
            }
            render();
        }
    }

    // イベントリスナーの設定
    container.addEventListener('click', (event) => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + container.scrollLeft;
        const y = event.clientY - rect.top + container.scrollTop;
        
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE;
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE;
        
        // モードをリセット
        if (currentMode === 'visual' || currentMode === 'arrow') {
            currentMode = 'normal';
            selectionStart = null;
            pendingArrow = null;
        }
        
        render();
    });

    hiddenInput.addEventListener('keydown', (e) => {
        if (isComposing) return;
        
        switch (currentMode) {
            case 'normal':
                handleNormalModeKeys(e);
                break;
            case 'visual':
                handleVisualModeKeys(e);
                break;
            case 'arrow':
                handleArrowModeKeys(e);
                break;
        }
    });

    // 日本語入力関連のイベント
    hiddenInput.addEventListener('compositionstart', () => {
        isComposing = true;
        compositionText = '';
    });

    hiddenInput.addEventListener('compositionupdate', (e) => {
        compositionText = e.data || '';
        render();
    });

    hiddenInput.addEventListener('compositionend', (e) => {
        isComposing = false;
        compositionText = '';
        handleTextInput(e.data || '');
        e.target.value = '';
    });

    hiddenInput.addEventListener('input', (e) => {
        if (isComposing) return;
        handleTextInput(e.target.value);
        e.target.value = '';
    });

    // 初期描画
    render();
});
