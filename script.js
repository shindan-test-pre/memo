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

    // --- 状態管理 ---
    let paperData = {};
    let boxes = [];
    let arrows = []; // 【変更】軌跡(path)を保存する配列に戻しました
    let nextId = 0;
    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal';
    let selectionStart = null;
    let currentArrowPath = []; // 【変更】矢印モード中の軌跡を管理
    let isComposing = false;
    let compositionText = '';

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    function createArrowMarker() { /* ... (変更なし) ... */ }
    function createCharCell(char, x, y, isComposingChar = false) { /* ... (変更なし) ... */ }
    function getSelectionRect() { /* ... (変更なし) ... */ }
    function insertChar(char) { /* ... (変更なし) ... */ }
    function deleteCharBackward() { /* ... (変更なし) ... */ }
    function deleteCharForward() { /* ... (変更なし) ... */ }
    
    /**
     * メイン描画関数
     */
    function render() {
        const elementsToRemove = container.querySelectorAll('.char-cell, .cursor, .selection-highlight, .border-box');
        elementsToRemove.forEach(el => el.remove());
        svgLayer.innerHTML = '';

        svgLayer.appendChild(createArrowMarker());

        // 【変更】矢印描画ロジックを刷新
        const drawArrowPath = (path, isPreview = false) => {
            if (path.length === 0) return;
            for (let i = 0; i < path.length; i++) {
                const p_curr = path[i];
                const p_prev = path[i - 1];
                const p_next = path[i + 1];
                const center = { x: p_curr.x + GRID_SIZE / 2, y: p_curr.y + GRID_SIZE / 2 };

                let entryPoint = center, exitPoint = center;
                if (p_prev) {
                    if (p_prev.x < p_curr.x) entryPoint = { x: p_curr.x, y: center.y };
                    else if (p_prev.x > p_curr.x) entryPoint = { x: p_curr.x + GRID_SIZE, y: center.y };
                    else if (p_prev.y < p_curr.y) entryPoint = { x: center.x, y: p_curr.y };
                    else if (p_prev.y > p_curr.y) entryPoint = { x: center.x, y: p_curr.y + GRID_SIZE };
                }
                if (p_next) {
                    if (p_next.x > p_curr.x) exitPoint = { x: p_curr.x + GRID_SIZE, y: center.y };
                    else if (p_next.x < p_curr.x) exitPoint = { x: p_curr.x, y: center.y };
                    else if (p_next.y > p_curr.y) exitPoint = { x: center.x, y: p_curr.y + GRID_SIZE };
                    else if (p_next.y < p_curr.y) exitPoint = { x: center.x, y: p_curr.y };
                }

                const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                let d;
                const isStraight = p_prev && p_next && ((p_prev.x === p_curr.x && p_curr.x === p_next.x) || (p_prev.y === p_curr.y && p_curr.y === p_next.y));
                if (isStraight) {
                    d = `M ${entryPoint.x} ${entryPoint.y} L ${exitPoint.x} ${exitPoint.y}`;
                } else {
                    d = `M ${entryPoint.x} ${entryPoint.y} L ${center.x} ${center.y} L ${exitPoint.x} ${exitPoint.y}`;
                }
                svgPath.setAttribute('d', d);
                svgPath.setAttribute('class', 'arrow-line');
                svgPath.setAttribute('fill', 'none');
                if (isPreview) svgPath.style.opacity = '0.5';
                if (!p_next && !isPreview) svgPath.setAttribute('marker-end', 'url(#arrowhead)');
                svgLayer.appendChild(svgPath);
            }
        };

        arrows.forEach(arrow => drawArrowPath(arrow.path));
        if (currentMode === 'arrow') drawArrowPath(currentArrowPath, true);
        
        // ... (省略：枠線、文字、カーソル等の描画。ここは変更なし)
        boxes.forEach(box => { const boxEl = document.createElement('div'); boxEl.classList.add('border-box'); boxEl.style.left = `${box.x}px`; boxEl.style.top = `${box.y}px`; boxEl.style.width = `${box.width}px`; boxEl.style.height = `${box.height}px`; container.appendChild(boxEl); });
        Object.keys(paperData).forEach(key => { const pos = parsePosition(key); if (pos) createCharCell(paperData[key], pos.x, pos.y); });
        if (currentMode === 'visual' && selectionStart) { const rect = getSelectionRect(); if (rect) { const highlightEl = document.createElement('div'); highlightEl.classList.add('selection-highlight'); highlightEl.style.left = `${rect.x}px`; highlightEl.style.top = `${rect.y}px`; highlightEl.style.width = `${rect.width}px`; highlightEl.style.height = `${rect.height}px`; container.appendChild(highlightEl); } }
        if (isComposing && compositionText) { let tempX = cursorPosition.x; for (const char of compositionText) { createCharCell(char, tempX, cursorPosition.y, true); tempX += GRID_SIZE; } }
        const cursorX = cursorPosition.x + (isComposing ? compositionText.length * GRID_SIZE : 0);
        cursorElement.style.left = `${cursorX}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);
        hiddenInput.style.left = `${cursorX}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        hiddenInput.focus();
    }

    function handleNormalModeKeys(e) {
        if ((e.key === 'e' || e.key === 'l') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (e.key === 'e') {
                currentMode = 'visual';
                selectionStart = { ...cursorPosition };
            } else if (e.key === 'l') {
                currentMode = 'arrow';
                currentArrowPath = [{ ...cursorPosition }]; // 【変更】軌跡の描画を開始
            }
            render();
            return;
        }
        // ... (省略：他のキー操作は変更なし)
        const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter']; if (controlKeys.includes(e.key)) { e.preventDefault(); switch (e.key) { case 'ArrowUp': moveCursor(0, -GRID_SIZE); break; case 'ArrowDown': moveCursor(0, GRID_SIZE); break; case 'ArrowLeft': moveCursor(-GRID_SIZE, 0); break; case 'ArrowRight': moveCursor(GRID_SIZE, 0); break; case 'Enter': insertChar('\n'); cursorPosition.y += GRID_SIZE; cursorPosition.x = 0; break; case 'Backspace': deleteCharBackward(); break; case 'Delete': deleteCharForward(); break; } render(); }
    }
    
    function handleVisualModeKeys(e) {
        e.preventDefault();
        // ... (省略：変更なし)
        if (ARROW_DIRECTIONS[e.key]) { switch (e.key) { case 'ArrowUp': moveCursor(0, -GRID_SIZE); break; case 'ArrowDown': moveCursor(0, GRID_SIZE); break; case 'ArrowLeft': moveCursor(-GRID_SIZE, 0); break; case 'ArrowRight': moveCursor(GRID_SIZE, 0); break; } } else if (e.key === 'Enter') { const rect = getSelectionRect(); if (rect) { boxes.push({ id: `box${nextId++}`, ...rect }); } currentMode = 'normal'; selectionStart = null; } else if (e.key === 'Escape') { currentMode = 'normal'; selectionStart = null; } else if (e.key === 'Delete' || e.key === 'Backspace') { const rect = getSelectionRect(); if (rect) { const boxToDelete = boxes.find(box => box.x === rect.x && box.y === rect.y && box.width === rect.width && box.height === rect.height); if (boxToDelete) { boxes = boxes.filter(box => box.id !== boxToDelete.id); } arrows = arrows.filter(arrow => { const isArrowIntersecting = arrow.path.some(p => p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height); return !isArrowIntersecting; }); } currentMode = 'normal'; selectionStart = null; } render();
    }

    // 【変更】矢印モードのロジックを軌跡描画方式に刷新
    function handleArrowModeKeys(e) {
        e.preventDefault();
        const lastPoint = currentArrowPath[currentArrowPath.length - 1];
        if (!lastPoint) { currentMode = 'normal'; render(); return; }
        
        let nextPoint = { ...lastPoint };
        let moved = false;
        
        if (ARROW_DIRECTIONS[e.key]) {
             switch (e.key) {
                case 'ArrowUp': if (lastPoint.y > 0) { nextPoint.y -= GRID_SIZE; moved = true; } break;
                case 'ArrowDown': nextPoint.y += GRID_SIZE; moved = true; break;
                case 'ArrowLeft': if (lastPoint.x > 0) { nextPoint.x -= GRID_SIZE; moved = true; } break;
                case 'ArrowRight': nextPoint.x += GRID_SIZE; moved = true; break;
             }
             if (moved) {
                 currentArrowPath.push(nextPoint);
                 cursorPosition.x = nextPoint.x;
                 cursorPosition.y = nextPoint.y;
             }
        } else if (e.key === 'Enter') {
            if (currentArrowPath.length > 1) {
                arrows.push({ id: `arrow${nextId++}`, path: currentArrowPath });
            }
            currentMode = 'normal';
            currentArrowPath = [];
        } else if (e.key === 'Escape') {
            currentMode = 'normal';
            currentArrowPath = [];
        }
        render();
    }
    
    // --- ユーティリティとイベントリスナー（ここから下は変更なし） ---
    const ARROW_DIRECTIONS = { 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right' };
    function parsePosition(key) { try { const [x, y] = key.split(',').map(Number); if (isNaN(x) || isNaN(y)) return null; return { x, y }; } catch (error) { console.warn('Position parsing error:', error); return null; } }
    function positionToKey(x, y) { return `${x},${y}`; }
    function moveCursor(dx, dy) { cursorPosition.x = Math.max(0, cursorPosition.x + dx); cursorPosition.y = Math.max(0, cursorPosition.y + dy); }
    function handleTextInput(text) { if (text) { for (const char of text) { insertChar(char); } render(); } }
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data || ''; render(); });
    hiddenInput.addEventListener('compositionend', (e) => { isComposing = false; compositionText = ''; handleTextInput(e.data || ''); e.target.value = ''; });
    hiddenInput.addEventListener('input', (e) => { if (isComposing) return; handleTextInput(e.target.value); e.target.value = ''; });

    render();
});
