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
    const ARROW_DIRECTIONS = { 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right' };

    // --- 状態管理 ---
    let paperData = {};
    let boxes = [];
    let arrows = []; // 【修正】軌跡(path)を保存する配列形式
    let nextId = 0;
    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal';
    let selectionStart = null;
    let currentArrowPath = []; // 【修正】矢印モード中の軌跡を管理
    let isComposing = false;
    let compositionText = '';

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    // --- ヘルパー関数群 ---
    function parsePosition(key) { try { const [x, y] = key.split(',').map(Number); if (isNaN(x) || isNaN(y)) return null; return { x, y }; } catch (e) { return null; } }
    function positionToKey(x, y) { return `${x},${y}`; }
    function moveCursor(dx, dy) { cursorPosition.x = Math.max(0, cursorPosition.x + dx); cursorPosition.y = Math.max(0, cursorPosition.y + dy); }
    function createArrowMarker() { const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker'); marker.id = 'arrowhead'; marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '8'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5'); marker.setAttribute('orient', 'auto-start-reverse'); const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pathEl.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); pathEl.setAttribute('fill', '#333'); marker.appendChild(pathEl); defs.appendChild(marker); return defs; }
    function createCharCell(char, x, y, isComposingChar = false) { const charCell = document.createElement('div'); charCell.classList.add('char-cell'); if (isComposingChar) charCell.classList.add('composing-char'); charCell.style.left = `${x}px`; charCell.style.top = `${y}px`; charCell.innerText = char === '\n' ? '' : char; container.appendChild(charCell); }
    function getSelectionRect() { if (!selectionStart) return null; const x1 = Math.min(selectionStart.x, cursorPosition.x); const y1 = Math.min(selectionStart.y, cursorPosition.y); const x2 = Math.max(selectionStart.x, cursorPosition.x); const y2 = Math.max(selectionStart.y, cursorPosition.y); return { x: x1, y: y1, width: x2 - x1 + GRID_SIZE, height: y2 - y1 + GRID_SIZE }; }
    function insertChar(char) { const { x: currentX, y: currentY } = cursorPosition; const charsToShift = Object.keys(paperData).map(key => parsePosition(key)).filter(pos => pos && pos.y === currentY && pos.x >= currentX).sort((a, b) => b.x - a.x); charsToShift.forEach(item => { const oldKey = positionToKey(item.x, item.y); const newKey = positionToKey(item.x + GRID_SIZE, item.y); paperData[newKey] = paperData[oldKey]; delete paperData[oldKey]; }); paperData[positionToKey(currentX, currentY)] = char; moveCursor(GRID_SIZE, 0); }
    function deleteCharBackward() { if (cursorPosition.x === 0) return; moveCursor(-GRID_SIZE, 0); deleteCharForward(); }
    function deleteCharForward() { const currentKey = positionToKey(cursorPosition.x, cursorPosition.y); const currentY = cursorPosition.y; delete paperData[currentKey]; const charsToShift = Object.keys(paperData).map(key => parsePosition(key)).filter(pos => pos && pos.y === currentY && pos.x > cursorPosition.x).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { const oldKey = positionToKey(item.x, item.y); const newKey = positionToKey(item.x - GRID_SIZE, item.y); paperData[newKey] = paperData[oldKey]; delete paperData[oldKey]; }); }

    /**
     * メイン描画関数
     */
    function render() {
        const elementsToRemove = container.querySelectorAll('.char-cell, .cursor, .selection-highlight, .border-box');
        elementsToRemove.forEach(el => el.remove());
        svgLayer.innerHTML = '';
        svgLayer.appendChild(createArrowMarker());

        // 【最終修正】矢印描画ロジックを、単一の<polyline>（一本の繋がった線）で描く方式に刷新
        const drawArrowPath = (path, isPreview = false) => {
            if (path.length < 2) return;
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            const points = path.map(p => `${p.x + GRID_SIZE / 2},${p.y + GRID_SIZE / 2}`).join(' ');
            polyline.setAttribute('points', points);
            polyline.setAttribute('class', 'arrow-line');
            polyline.setAttribute('fill', 'none');
            if (isPreview) {
                polyline.style.opacity = '0.5';
            } else {
                polyline.setAttribute('marker-end', 'url(#arrowhead)');
            }
            svgLayer.appendChild(polyline);
        };
        
        arrows.forEach(arrow => drawArrowPath(arrow.path));
        if (currentMode === 'arrow') drawArrowPath(currentArrowPath, true);
        
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
    
    // --- キーボードイベントハンドラ ---

    function handleNormalModeKeys(e) {
        if ((e.key === 'e' || e.key === 'l') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (e.key === 'e') { currentMode = 'visual'; selectionStart = { ...cursorPosition }; }
            else if (e.key === 'l') { currentMode = 'arrow'; currentArrowPath = [{ ...cursorPosition }]; }
            render();
            return;
        }
        const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter'];
        if (controlKeys.includes(e.key)) {
            e.preventDefault();
            switch (e.key) {
                case 'ArrowUp': moveCursor(0, -GRID_SIZE); break;
                case 'ArrowDown': moveCursor(0, GRID_SIZE); break;
                case 'ArrowLeft': moveCursor(-GRID_SIZE, 0); break;
                case 'ArrowRight': moveCursor(GRID_SIZE, 0); break;
                case 'Enter': insertChar('\n'); cursorPosition.y += GRID_SIZE; cursorPosition.x = 0; break;
                case 'Backspace': deleteCharBackward(); break;
                case 'Delete': deleteCharForward(); break;
            }
            render();
        }
    }

    function handleVisualModeKeys(e) {
        e.preventDefault();
        if (ARROW_DIRECTIONS[e.key]) {
            switch (e.key) {
                case 'ArrowUp': moveCursor(0, -GRID_SIZE); break;
                case 'ArrowDown': moveCursor(0, GRID_SIZE); break;
                case 'ArrowLeft': moveCursor(-GRID_SIZE, 0); break;
                case 'ArrowRight': moveCursor(GRID_SIZE, 0); break;
            }
        } else if (e.key === 'Enter') {
            const rect = getSelectionRect();
            if (rect) { boxes.push({ id: `box${nextId++}`, ...rect }); }
            currentMode = 'normal'; selectionStart = null;
        } else if (e.key === 'Escape') {
            currentMode = 'normal'; selectionStart = null;
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            const rect = getSelectionRect();
            if (rect) {
                const boxToDelete = boxes.find(box => box.x === rect.x && box.y === rect.y && box.width === rect.width && box.height === rect.height);
                if (boxToDelete) { boxes = boxes.filter(box => box.id !== boxToDelete.id); }
                // 【修正】矢印削除ロジックを、新しいデータ構造に対応
                arrows = arrows.filter(arrow => {
                    const isArrowIntersecting = arrow.path.some(p => p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height);
                    return !isArrowIntersecting;
                });
            }
            currentMode = 'normal'; selectionStart = null;
        }
        render();
    }

    // 【修正】矢印モードのロジックを、軌跡を描画する方式に刷新
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
    
    // --- イベントリスナー設定 ---
    const handleTextInput = (text) => { if (text) { for (const char of text) { insertChar(char); } render(); } };
    container.addEventListener('click', (event) => { const rect = container.getBoundingClientRect(); const x = event.clientX - rect.left + container.scrollLeft; const y = event.clientY - rect.top + container.scrollTop; cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE; cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE; if (currentMode === 'visual' || currentMode === 'arrow') { currentMode = 'normal'; selectionStart = null; currentArrowPath = []; } render(); });
    hiddenInput.addEventListener('keydown', (e) => { if (isComposing) return; switch (currentMode) { case 'normal': handleNormalModeKeys(e); break; case 'visual': handleVisualModeKeys(e); break; case 'arrow': handleArrowModeKeys(e); break; } });
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data || ''; render(); });
    hiddenInput.addEventListener('compositionend', (e) => { isComposing = false; compositionText = ''; handleTextInput(e.data || ''); e.target.value = ''; });
    hiddenInput.addEventListener('input', (e) => { if (isComposing) return; handleTextInput(e.target.value); e.target.value = ''; });

    container.focus();
    render();
});
