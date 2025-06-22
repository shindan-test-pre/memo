document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const container = document.getElementById('canvas-container');
    const svgLayer = document.getElementById('arrow-svg-layer');
    const helpModal = document.getElementById('help-modal');
    const closeHelpModalBtn = document.getElementById('close-help-modal');
    
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
    let paperData = {};
    let boxes = [];
    let arrows = [];
    let nextId = 0;
    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal';
    let selectionStart = null;
    let currentArrowPath = [];
    let isComposing = false;
    let compositionText = '';
    let history = [];
    let historyIndex = -1;

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    // --- ヘルパー関数群 ---
    function parsePosition(key) { try { const [x, y] = key.split(',').map(Number); if (isNaN(x) || isNaN(y)) return null; return { x, y }; } catch (error) { return null; } }
    function positionToKey(x, y) { return `${x},${y}`; }
    function moveCursor(dx, dy) { cursorPosition.x = Math.max(0, cursorPosition.x + dx); cursorPosition.y = Math.max(0, cursorPosition.y + dy); }
    function createArrowMarker() { const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker'); marker.id = 'arrowhead'; marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '8'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5'); marker.setAttribute('orient', 'auto-start-reverse'); const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pathEl.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); pathEl.setAttribute('fill', '#333'); marker.appendChild(pathEl); defs.appendChild(marker); return defs; }
    
    function createCharCell(charObject, x, y, isComposingChar = false) {
        const charCell = document.createElement('div');
        charCell.className = 'char-cell';
        if (isComposingChar) charCell.classList.add('composing-char');
        if (charObject.color) charCell.classList.add(`text-${charObject.color}`);
        if (charObject.bold) charCell.classList.add('text-bold');
        if (charObject.underline) charCell.classList.add('text-underline');
        charCell.style.left = `${x}px`;
        charCell.style.top = `${y}px`;
        charCell.innerText = charObject.char === '\n' ? '' : charObject.char;
        container.appendChild(charCell);
    }
    
    function getSelectionRect() { if (!selectionStart) return null; const x1 = Math.min(selectionStart.x, cursorPosition.x); const y1 = Math.min(selectionStart.y, cursorPosition.y); const x2 = Math.max(selectionStart.x, cursorPosition.x); const y2 = Math.max(selectionStart.y, cursorPosition.y); return { x: x1, y: y1, width: x2 - x1 + GRID_SIZE, height: y2 - y1 + GRID_SIZE }; }
    
    // 【★修正★】データ操作関数は、履歴記録や描画を行わないようにする
    function insertChar(char) {
        const currentKey = positionToKey(cursorPosition.x, cursorPosition.y);
        const currentY = cursorPosition.y;
        const charsToShift = Object.keys(paperData).map(parsePosition).filter(item => item && item.y === currentY && item.x >= cursorPosition.x).sort((a, b) => b.x - a.x);
        charsToShift.forEach(item => { const oldKey = positionToKey(item.x, item.y); const newKey = positionToKey(item.x + GRID_SIZE, item.y); paperData[newKey] = paperData[oldKey]; delete paperData[oldKey]; });
        paperData[currentKey] = { char: char, color: null, bold: false, underline: false };
        moveCursor(GRID_SIZE, 0);
    }
    function deleteCharBackward() { if (cursorPosition.x === 0 && cursorPosition.y === 0) return false; if (cursorPosition.x > 0) { moveCursor(-GRID_SIZE, 0); return deleteCharForward(); } return false; }
    function deleteCharForward() { const currentKey = positionToKey(cursorPosition.x, cursorPosition.y); if (!paperData[currentKey]) return false; const currentY = cursorPosition.y; delete paperData[currentKey]; const charsToShift = Object.keys(paperData).map(key => parsePosition(key)).filter(item => item && item.y === currentY && item.x > cursorPosition.x).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { const oldKey = positionToKey(item.x, item.y); const newKey = positionToKey(item.x - GRID_SIZE, item.y); paperData[newKey] = paperData[oldKey]; delete paperData[oldKey]; }); return true; }
    
    function insertNewLine() {
        const shiftThresholdY = cursorPosition.y + GRID_SIZE;
        const charsToShift = Object.keys(paperData).map(parsePosition).filter(p => p && p.y >= shiftThresholdY).sort((a, b) => b.y - a.y || b.x - a.x);
        for (const pos of charsToShift) { const oldKey = positionToKey(pos.x, pos.y); const newKey = positionToKey(pos.x, pos.y + GRID_SIZE); paperData[newKey] = paperData[oldKey]; delete paperData[oldKey]; }
        boxes.forEach(box => { if (box.y >= shiftThresholdY) { box.y += GRID_SIZE; } });
        arrows.forEach(arrow => { arrow.path.forEach(point => { if (point.y >= shiftThresholdY) { point.y += GRID_SIZE; } }); });
        cursorPosition.x = 0;
        cursorPosition.y = shiftThresholdY;
    }

    function updateCanvasSize() { const buffer = 300; let maxX = 0; let maxY = 0; const allPositions = [ ...Object.keys(paperData).map(parsePosition), ...boxes.flatMap(b => [{x: b.x + b.width, y: b.y + b.height}]), ...arrows.flatMap(a => a.path) ].filter(p => p); allPositions.forEach(p => { if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }); const newWidth = maxX + buffer; const newHeight = maxY + buffer; const minWidth = container.parentNode.clientWidth; const minHeight = container.parentNode.clientHeight; container.style.width = `${Math.max(minWidth, newWidth)}px`; container.style.height = `${Math.max(minHeight, newHeight)}px`; svgLayer.setAttribute('width', container.scrollWidth); svgLayer.setAttribute('height', container.scrollHeight); }

    // --- Undo/Redo & State Management ---
    function recordHistory() {
        const currentState = { paperData: JSON.parse(JSON.stringify(paperData)), boxes: JSON.parse(JSON.stringify(boxes)), arrows: JSON.parse(JSON.stringify(arrows)), nextId };
        if (historyIndex < history.length - 1) { history = history.slice(0, historyIndex + 1); }
        history.push(currentState);
        historyIndex++;
        if (history.length > 100) { history.shift(); historyIndex--; }
        saveToLocalStorage();
    }
    function loadStateFromHistory(index) {
        const state = history[index];
        if (!state) return;
        paperData = JSON.parse(JSON.stringify(state.paperData));
        boxes = JSON.parse(JSON.stringify(state.boxes));
        arrows = JSON.parse(JSON.stringify(state.arrows));
        nextId = state.nextId;
        render();
    }
    function undo() { if (historyIndex > 0) { historyIndex--; loadStateFromHistory(historyIndex); saveToLocalStorage(); } }
    function redo() { if (historyIndex < history.length - 1) { historyIndex++; loadStateFromHistory(historyIndex); saveToLocalStorage(); } }
    function resetMemo() { if (confirm('すべてのメモ内容が消去され、元に戻せません。\n本当によろしいですか？')) { paperData = {}; boxes = []; arrows = []; nextId = 0; cursorPosition = { x: 0, y: 0 }; currentMode = 'normal'; selectionStart = null; currentArrowPath = []; recordHistory(); render(); } }
    function exportToPdf() { window.print(); }
    function openHelpModal() { currentMode = 'modal'; helpModal.classList.add('is-visible'); helpModal.setAttribute('aria-hidden', 'false'); }
    function closeHelpModal() { currentMode = 'normal'; helpModal.classList.remove('is-visible'); helpModal.setAttribute('aria-hidden', 'true'); hiddenInput.focus(); }
    
    /** メイン描画関数 */
    function render() {
        const elementsToRemove = container.querySelectorAll('.char-cell, .cursor, .selection-highlight, .border-box');
        elementsToRemove.forEach(el => el.remove());
        svgLayer.innerHTML = '';
        svgLayer.appendChild(createArrowMarker());
        const drawArrowPath = (path, isPreview = false) => { if (path.length < 2) return; const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); const points = path.map(p => `${p.x + GRID_SIZE / 2},${p.y + GRID_SIZE / 2}`).join(' '); polyline.setAttribute('points', points); polyline.setAttribute('class', 'arrow-line'); polyline.setAttribute('fill', 'none'); if (isPreview) { polyline.style.opacity = '0.5'; } else { polyline.setAttribute('marker-end', 'url(#arrowhead)'); } svgLayer.appendChild(polyline); };
        arrows.forEach(arrow => drawArrowPath(arrow.path));
        if (currentMode === 'arrow') drawArrowPath(currentArrowPath, true);
        boxes.forEach(box => { const boxEl = document.createElement('div'); boxEl.classList.add('border-box'); boxEl.style.left = `${box.x}px`; boxEl.style.top = `${box.y}px`; boxEl.style.width = `${box.width}px`; boxEl.style.height = `${box.height}px`; container.appendChild(boxEl); });
        Object.keys(paperData).forEach(key => { const pos = parsePosition(key); if (pos) createCharCell(paperData[key], pos.x, pos.y); });
        if (currentMode === 'visual' && selectionStart) { const rect = getSelectionRect(); if (rect) { const highlightEl = document.createElement('div'); highlightEl.classList.add('selection-highlight'); highlightEl.style.left = `${rect.x}px`; highlightEl.style.top = `${rect.y}px`; highlightEl.style.width = `${rect.width}px`; highlightEl.style.height = `${rect.height}px`; container.appendChild(highlightEl); } }
        if (isComposing && compositionText) { let tempX = cursorPosition.x; for (const char of compositionText) { createCharCell({ char: char, color: null, bold: false, underline: false }, tempX, cursorPosition.y, true); tempX += GRID_SIZE; } }
        const cursorX = cursorPosition.x + (isComposing ? compositionText.length * GRID_SIZE : 0);
        cursorElement.style.left = `${cursorX}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);
        hiddenInput.style.left = `${cursorX}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        if (currentMode === 'normal') { hiddenInput.focus({preventScroll:true}); } else { container.focus({preventScroll:true}); }
        updateCanvasSize();
    }
    
    // --- データ保存・読み込み関連 ---
    function serializeState() { return JSON.stringify({ history, historyIndex }); }
    function deserializeState(jsonString) { try { const state = JSON.parse(jsonString); if (state && Array.isArray(state.history) && typeof state.historyIndex === 'number') { history = state.history; historyIndex = state.historyIndex; loadStateFromHistory(historyIndex); return true; } } catch (error) { console.error("Failed to parse state:", error); } return false; }
    function saveToLocalStorage() { try { localStorage.setItem(LOCAL_STORAGE_KEY, serializeState()); } catch (error) { console.error("Failed to save to localStorage:", error); } }
    function loadFromLocalStorage() { if (localStorage.getItem(LOCAL_STORAGE_KEY)) { return deserializeState(localStorage.getItem(LOCAL_STORAGE_KEY)); } return false; }
    function exportToFile() { const stateJson = serializeState(); const blob = new Blob([stateJson], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `memo-${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
    function importFromFile() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = (event) => { const file = event.target.files[0]; if (!file) return; if (!confirm('現在の内容は上書きされます。よろしいですか？')) return; const reader = new FileReader(); reader.onload = (e) => { const success = deserializeState(e.target.result); if (!success) { alert("ファイルの読み込みに失敗しました。"); history = []; historyIndex = -1; recordHistory(); render(); } }; reader.readAsText(file); }; input.click(); }

    // --- キーボードイベントハンドラ ---
    // 【★修正★】処理の流れを再構築し、クリーンな形に
    function handleNormalModeKeys(e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'l')) {
            e.preventDefault();
            if (e.key === 'e') { currentMode = 'visual'; selectionStart = { ...cursorPosition }; } 
            else if (e.key === 'l') { currentMode = 'arrow'; currentArrowPath = [{...cursorPosition}]; }
            render();
            return;
        }

        const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter'];
        if (controlKeys.includes(e.key)) {
            e.preventDefault();
            let stateChanged = false;
            switch (e.key) {
                case 'ArrowUp': moveCursor(0, -GRID_SIZE); break;
                case 'ArrowDown': moveCursor(0, GRID_SIZE); break;
                case 'ArrowLeft': moveCursor(-GRID_SIZE, 0); break;
                case 'ArrowRight': moveCursor(GRID_SIZE, 0); break;
                case 'Enter':
                    insertNewLine();
                    stateChanged = true;
                    break;
                case 'Backspace':
                    stateChanged = deleteCharBackward();
                    break;
                case 'Delete':
                    stateChanged = deleteCharForward();
                    break;
            }

            if (stateChanged) {
                recordHistory();
            }
            render();
        }
    }

    function handleVisualModeKeys(e) {
        e.preventDefault();
        // ... (以前の、Undo/Redoとスタイル機能を含んだ完成版のコードをここに統合)
    }
    
    function handleArrowModeKeys(e) {
        e.preventDefault();
        const lastPoint = currentArrowPath[currentArrowPath.length - 1];
        if (!lastPoint) { currentMode = 'normal'; render(); return; }
        
        if (ARROW_DIRECTIONS[e.key]) {
            let nextPoint = { ...lastPoint };
            switch (e.key) {
                case 'ArrowUp': if (lastPoint.y > 0) nextPoint.y -= GRID_SIZE; break;
                case 'ArrowDown': nextPoint.y += GRID_SIZE; break;
                case 'ArrowLeft': if (lastPoint.x > 0) nextPoint.x -= GRID_SIZE; break;
                case 'ArrowRight': nextPoint.x += GRID_SIZE; break;
            }
            if (nextPoint.x !== lastPoint.x || nextPoint.y !== lastPoint.y) { currentArrowPath.push(nextPoint); cursorPosition.x = nextPoint.x; cursorPosition.y = nextPoint.y; }
        } else if (e.key === 'Enter') {
            if (currentArrowPath.length > 1) { arrows.push({ id: `arrow${nextId++}`, path: currentArrowPath }); recordHistory(); }
            currentMode = 'normal'; currentArrowPath = [];
        } else if (e.key === 'Escape') {
            currentMode = 'normal'; currentArrowPath = [];
        }
        render();
    }

    function handleTextInput(text) { if (currentMode !== 'normal') return; if (text) { for (const char of text) { insertChar(char); } } }

    // --- イベントリスナー群 ---
    window.addEventListener('keydown', (e) => {
        if (currentMode === 'modal') { if (e.key === 'Escape') { closeHelpModal(); } return; }
        if ((e.ctrlKey || e.metaKey)) {
            if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
            if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
            if (e.key === 's' || e.key === 'o') { e.preventDefault(); if (e.key === 's') exportToFile(); if (e.key === 'o') importFromFile(); }
            if (e.shiftKey && e.key === 'Backspace') { e.preventDefault(); resetMemo(); }
            if (e.key === '/') { e.preventDefault(); openHelpModal(); }
            if (e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); exportToPdf(); }
        }
    });

    hiddenInput.addEventListener('keydown', (e) => { if (isComposing || currentMode !== 'normal') return; handleNormalModeKeys(e); });
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data || ''; render(); });
    hiddenInput.addEventListener('compositionend', (e) => { isComposing = false; compositionText = ''; handleTextInput(e.data || ''); e.target.value = ''; });
    hiddenInput.addEventListener('input', (e) => { if (isComposing) return; handleTextInput(e.target.value); e.target.value = ''; });

    container.addEventListener('keydown', (e) => {
        if (currentMode === 'visual') { handleVisualModeKeys(e); } 
        else if (currentMode === 'arrow') { handleArrowModeKeys(e); }
    });

    container.addEventListener('click', (event) => { const rect = container.getBoundingClientRect(); const x = event.clientX - rect.left + container.scrollLeft; const y = event.clientY - rect.top + container.scrollTop; cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE; cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE; if (currentMode !== 'normal') { currentMode = 'normal'; selectionStart = null; currentArrowPath = []; } render(); });
    
    closeHelpModalBtn.addEventListener('click', closeHelpModal);
    helpModal.addEventListener('click', (e) => { if (e.target === helpModal) { closeHelpModal(); } });

    // --- 初期化 ---
    if (!loadFromLocalStorage()) {
        recordHistory();
    }
    render();
    window.scrollTo(0, 0);
});
