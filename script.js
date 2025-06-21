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
    const LOCAL_STORAGE_KEY = 'simpleMemoAppState';

    // 状態管理
    let paperData = {}, boxes = [], arrows = {}, nextId = 0;
    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal', selectionStart = null, pendingArrow = null;
    let isComposing = false, compositionText = '';

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    // --- データ保存・読み込み関連の関数 ---
    function serializeState() { return JSON.stringify({ paperData, boxes, arrows, nextId }); }
    function deserializeState(jsonString) { try { const state = JSON.parse(jsonString); if (state && typeof state.paperData === 'object' && Array.isArray(state.boxes) && typeof state.arrows === 'object') { paperData = state.paperData; boxes = state.boxes; arrows = state.arrows; nextId = state.nextId || 0; render(); } else { alert('無効なファイル形式です。'); } } catch (error) { alert('ファイルの読み込みに失敗しました。'); console.error("Failed to parse state:", error); } }
    function saveToLocalStorage() { try { localStorage.setItem(LOCAL_STORAGE_KEY, serializeState()); } catch (error) { console.error("Failed to save to localStorage:", error); } }
    function loadFromLocalStorage() { const stateJson = localStorage.getItem(LOCAL_STORAGE_KEY); if (stateJson) { deserializeState(stateJson); } }
    function exportToFile() { const stateJson = serializeState(); const blob = new Blob([stateJson], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `memo-${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
    function importFromFile() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = (event) => { const file = event.target.files[0]; if (!file) return; if (!confirm('現在の内容は上書きされます。よろしいですか？')) return; const reader = new FileReader(); reader.onload = (e) => deserializeState(e.target.result); reader.readAsText(file); }; input.click(); }
    
    // --- 描画・操作のヘルパー関数群 ---
    function parsePosition(key) { try { const [x, y] = key.split(',').map(Number); if (isNaN(x) || isNaN(y)) return null; return { x, y }; } catch (e) { return null; } }
    function positionToKey(x, y) { return `${x},${y}`; }
    function moveCursor(dx, dy) { cursorPosition.x = Math.max(0, cursorPosition.x + dx); cursorPosition.y = Math.max(0, cursorPosition.y + dy); }
    function createArrowMarker() { const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker'); marker.id = 'arrowhead'; marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '8'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5'); marker.setAttribute('orient', 'auto-start-reverse'); const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pathEl.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); pathEl.setAttribute('fill', '#555'); marker.appendChild(pathEl); defs.appendChild(marker); return defs; }
    function drawCellArrow(x, y, direction, isPreview = false) { const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); const centerOffset = GRID_SIZE / 2; const padding = 2; let x1, y1, x2, y2; switch (direction) { case 'right': x1 = x + padding; y1 = y + centerOffset; x2 = x + GRID_SIZE - padding; y2 = y + centerOffset; break; case 'left': x1 = x + GRID_SIZE - padding; y1 = y + centerOffset; x2 = x + padding; y2 = y + centerOffset; break; case 'down': x1 = x + centerOffset; y1 = y + padding; x2 = x + centerOffset; y2 = y + GRID_SIZE - padding; break; case 'up': x1 = x + centerOffset; y1 = y + GRID_SIZE - padding; x2 = x + centerOffset; y2 = y + padding; break; default: return; } line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2); line.setAttribute('class', 'arrow-line'); line.setAttribute('marker-end', 'url(#arrowhead)'); if (isPreview) line.style.opacity = '0.5'; svgLayer.appendChild(line); }
    function createCharCell(char, x, y, isComposingChar = false) { const charCell = document.createElement('div'); charCell.classList.add('char-cell'); if (isComposingChar) charCell.classList.add('composing-char'); charCell.style.left = `${x}px`; charCell.style.top = `${y}px`; charCell.innerText = char === '\n' ? '' : char; container.appendChild(charCell); }
    function getSelectionRect() { if (!selectionStart) return null; const x1 = Math.min(selectionStart.x, cursorPosition.x); const y1 = Math.min(selectionStart.y, cursorPosition.y); const x2 = Math.max(selectionStart.x, cursorPosition.x); const y2 = Math.max(selectionStart.y, cursorPosition.y); return { x: x1, y: y1, width: x2 - x1 + GRID_SIZE, height: y2 - y1 + GRID_SIZE }; }
    function insertChar(char) { const { x: currentX, y: currentY } = cursorPosition; const charsToShift = Object.keys(paperData).map(key => parsePosition(key)).filter(pos => pos && pos.y === currentY && pos.x >= currentX).sort((a, b) => b.x - a.x); charsToShift.forEach(item => { const oldKey = positionToKey(item.x, item.y); const newKey = positionToKey(item.x + GRID_SIZE, item.y); paperData[newKey] = paperData[oldKey]; delete paperData[oldKey]; }); paperData[positionToKey(currentX, currentY)] = char; if (char === '\n') { cursorPosition.y += GRID_SIZE; cursorPosition.x = 0; } else { moveCursor(GRID_SIZE, 0); } }
    function deleteCharBackward() { if (cursorPosition.x === 0 && cursorPosition.y === 0) return; let targetX = cursorPosition.x; let targetY = cursorPosition.y; if (cursorPosition.x === 0) { targetY -= GRID_SIZE; const lineChars = Object.keys(paperData).map(key => parsePosition(key)).filter(pos => pos && pos.y === targetY).sort((a, b) => b.x - a.x); targetX = lineChars.length > 0 ? lineChars[0].x + GRID_SIZE : 0; } moveCursor(targetX - cursorPosition.x - GRID_SIZE, targetY - cursorPosition.y); deleteCharForward(); }
    function deleteCharForward() { const currentKey = positionToKey(cursorPosition.x, cursorPosition.y); const currentY = cursorPosition.y; delete paperData[currentKey]; const charsToShift = Object.keys(paperData).map(key => parsePosition(key)).filter(pos => pos && pos.y === currentY && pos.x > cursorPosition.x).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { const oldKey = positionToKey(item.x, item.y); const newKey = positionToKey(item.x - GRID_SIZE, item.y); paperData[newKey] = paperData[oldKey]; delete paperData[oldKey]; }); }

    // 【NEW】キャンバスの自動拡張ロジックを刷新
    function updateCanvasSize() {
        const buffer = 300;
        let maxX = 0;
        let maxY = 0;

        const allPositions = [
            ...Object.keys(paperData).map(parsePosition),
            ...boxes.flatMap(b => [{x: b.x + b.width, y: b.y + b.height}]),
            ...Object.keys(arrows).map(parsePosition)
        ].filter(p => p);

        allPositions.forEach(p => {
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });

        const newWidth = maxX + buffer;
        const newHeight = maxY + buffer;

        const minWidth = container.parentNode.clientWidth;
        const minHeight = container.parentNode.clientHeight;

        container.style.width = `${Math.max(minWidth, newWidth)}px`;
        container.style.height = `${Math.max(minHeight, newHeight)}px`;
        
        svgLayer.setAttribute('width', container.scrollWidth);
        svgLayer.setAttribute('height', container.scrollHeight);
    }

    /** メイン描画関数 */
    function render() {
        const elementsToRemove = container.querySelectorAll('.char-cell, .cursor, .selection-highlight, .border-box');
        elementsToRemove.forEach(el => el.remove());
        svgLayer.innerHTML = '';
        svgLayer.appendChild(createArrowMarker());
        Object.keys(arrows).forEach(key => { const pos = parsePosition(key); if (pos) drawCellArrow(pos.x, pos.y, arrows[key]); });
        if (currentMode === 'arrow' && pendingArrow && pendingArrow.direction) drawCellArrow(pendingArrow.x, pendingArrow.y, pendingArrow.direction, true);
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

        updateCanvasSize();
    }
    
    // --- キーボードイベントハンドラ ---
    function handleNormalModeKeys(e) { if ((e.key === 's' || e.key === 'o') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (e.key === 's') exportToFile(); if (e.key === 'o') importFromFile(); return; } if ((e.key === 'e' || e.key === 'l') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (e.key === 'e') { currentMode = 'visual'; selectionStart = { ...cursorPosition }; } else if (e.key === 'l') { currentMode = 'arrow'; pendingArrow = { x: cursorPosition.x, y: cursorPosition.y, direction: null }; } render(); return; } const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter']; if (controlKeys.includes(e.key)) { e.preventDefault(); switch (e.key) { case 'ArrowUp': moveCursor(0, -GRID_SIZE); break; case 'ArrowDown': moveCursor(0, GRID_SIZE); break; case 'ArrowLeft': moveCursor(-GRID_SIZE, 0); break; case 'ArrowRight': moveCursor(GRID_SIZE, 0); break; case 'Enter': insertChar('\n'); break; case 'Backspace': deleteCharBackward(); break; case 'Delete': deleteCharForward(); break; } render(); saveToLocalStorage(); } }
    function handleVisualModeKeys(e) { e.preventDefault(); if (ARROW_DIRECTIONS[e.key]) { switch (e.key) { case 'ArrowUp': moveCursor(0, -GRID_SIZE); break; case 'ArrowDown': moveCursor(0, GRID_SIZE); break; case 'ArrowLeft': moveCursor(-GRID_SIZE, 0); break; case 'ArrowRight': moveCursor(GRID_SIZE, 0); break; } } else if (e.key === 'Enter') { const rect = getSelectionRect(); if (rect) { boxes.push({ id: `box${nextId++}`, ...rect }); } currentMode = 'normal'; selectionStart = null; saveToLocalStorage(); } else if (e.key === 'Escape') { currentMode = 'normal'; selectionStart = null; } else if (e.key === 'Delete' || e.key === 'Backspace') { const rect = getSelectionRect(); if (rect) { const boxToDelete = boxes.find(box => box.x === rect.x && box.y === rect.y && box.width === rect.width && box.height === rect.height); if (boxToDelete) { boxes = boxes.filter(box => box.id !== boxToDelete.id); } const arrowKeysToDelete = Object.keys(arrows).filter(key => { const pos = parsePosition(key); return pos && pos.x >= rect.x && pos.x < rect.x + rect.width && pos.y >= rect.y && pos.y < rect.y + rect.height; }); arrowKeysToDelete.forEach(key => delete arrows[key]); } currentMode = 'normal'; selectionStart = null; saveToLocalStorage(); } render(); }
    function handleArrowModeKeys(e) { e.preventDefault(); if (ARROW_DIRECTIONS[e.key]) { pendingArrow.direction = ARROW_DIRECTIONS[e.key]; } else if (e.key === 'Enter') { if (pendingArrow && pendingArrow.direction) { const key = positionToKey(pendingArrow.x, pendingArrow.y); arrows[key] = pendingArrow.direction; cursorPosition.x = pendingArrow.x; cursorPosition.y = pendingArrow.y; saveToLocalStorage(); } currentMode = 'normal'; pendingArrow = null; } else if (e.key === 'Escape') { currentMode = 'normal'; pendingArrow = null; } render(); }
    function handleTextInput(text) { if (text) { for (const char of text) { insertChar(char); } render(); saveToLocalStorage(); } }
    
    container.addEventListener('click', (event) => { const rect = container.getBoundingClientRect(); const x = event.clientX - rect.left + container.scrollLeft; const y = event.clientY - rect.top + container.scrollTop; cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE; cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE; if (currentMode === 'visual' || currentMode === 'arrow') { currentMode = 'normal'; selectionStart = null; pendingArrow = null; } render(); });
    hiddenInput.addEventListener('keydown', (e) => { if (isComposing) return; switch (currentMode) { case 'normal': handleNormalModeKeys(e); break; case 'visual': handleVisualModeKeys(e); break; case 'arrow': handleArrowModeKeys(e); break; } });
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data || ''; render(); });
    hiddenInput.addEventListener('compositionend', (e) => { isComposing = false; compositionText = ''; handleTextInput(e.data || ''); e.target.value = ''; });
    hiddenInput.addEventListener('input', (e) => { if (isComposing) return; handleTextInput(e.target.value); e.target.value = ''; });

    // --- 初期化 ---
    loadFromLocalStorage();
    container.focus();
    render();
});
