document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const svgLayer = document.getElementById('arrow-svg-layer');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    container.appendChild(hiddenInput);

    const GRID_SIZE = 20;

    let paperData = {}, boxes = [], arrows = {}, nextId = 0;
    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal', selectionStart = null;
    
    // 【変更】矢印モードの管理をシンプル化
    let pendingArrow = null; // {x, y, direction}

    let isComposing = false, compositionText = '';

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    function render() {
        const elementsToRemove = container.querySelectorAll('.char-cell, .cursor, .selection-highlight, .border-box');
        elementsToRemove.forEach(el => el.remove());
        svgLayer.innerHTML = '';

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
        svgLayer.appendChild(defs);

        // 【変更】新しい矢印データ構造に基づいて描画
        const drawCellArrow = (x, y, direction, isPreview = false) => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const centerOffset = GRID_SIZE / 2;
            const padding = 2; // 線がセルの端にピッタリつきすぎないように調整
            let x1, y1, x2, y2;

            switch (direction) {
                case 'right': x1 = x + padding; y1 = y + centerOffset; x2 = x + GRID_SIZE - padding; y2 = y + centerOffset; break;
                case 'left':  x1 = x + GRID_SIZE - padding; y1 = y + centerOffset; x2 = x + padding; y2 = y + centerOffset; break;
                case 'down':  x1 = x + centerOffset; y1 = y + padding; x2 = x + centerOffset; y2 = y + GRID_SIZE - padding; break;
                case 'up':    x1 = x + centerOffset; y1 = y + GRID_SIZE - padding; x2 = x + centerOffset; y2 = y + padding; break;
            }
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('class', 'arrow-line');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            if (isPreview) line.style.opacity = '0.5';
            svgLayer.appendChild(line);
        };
        
        for (const key in arrows) {
            const [x, y] = key.split(',').map(Number);
            drawCellArrow(x, y, arrows[key]);
        }
        
        if (currentMode === 'arrow' && pendingArrow && pendingArrow.direction) {
            drawCellArrow(pendingArrow.x, pendingArrow.y, pendingArrow.direction, true);
        }

        boxes.forEach(box => { const boxEl = document.createElement('div'); boxEl.classList.add('border-box'); boxEl.style.left = `${box.x}px`; boxEl.style.top = `${box.y}px`; boxEl.style.width = `${box.width}px`; boxEl.style.height = `${box.height}px`; container.appendChild(boxEl); });
        for (const key in paperData) { const [x, y] = key.split(',').map(Number); createCharCell(paperData[key], x, y); }
        if (currentMode === 'visual' && selectionStart) { const { x, y, width, height } = getSelectionRect(); const highlightEl = document.createElement('div'); highlightEl.classList.add('selection-highlight'); highlightEl.style.left = `${x}px`; highlightEl.style.top = `${y}px`; highlightEl.style.width = `${width}px`; highlightEl.style.height = `${height}px`; container.appendChild(highlightEl); }
        if (isComposing && compositionText) { let tempX = cursorPosition.x; for (const char of compositionText) { createCharCell(char, tempX, cursorPosition.y, true); tempX += GRID_SIZE; } }

        const cursorX = cursorPosition.x + (isComposing ? compositionText.length * GRID_SIZE : 0);
        cursorElement.style.left = `${cursorX}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);

        hiddenInput.style.left = `${cursorX}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        hiddenInput.focus();
    }
    
    // --- (以下、前回から変更のない関数群です) ---
    function createCharCell(char, x, y, isComposingChar = false) { const charCell = document.createElement('div'); charCell.classList.add('char-cell'); if (isComposingChar) charCell.classList.add('composing-char'); charCell.style.left = `${x}px`; charCell.style.top = `${y}px`; charCell.innerText = char === '\n' ? '' : char; container.appendChild(charCell); }
    function getSelectionRect() { if (!selectionStart) return null; const x1 = Math.min(selectionStart.x, cursorPosition.x); const y1 = Math.min(selectionStart.y, cursorPosition.y); const x2 = Math.max(selectionStart.x, cursorPosition.x); const y2 = Math.max(selectionStart.y, cursorPosition.y); return { x: x1, y: y1, width: x2 - x1 + GRID_SIZE, height: y2 - y1 + GRID_SIZE, }; }
    function insertChar(char) { const { x: currentX, y: currentY } = cursorPosition; const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x >= currentX).sort((a, b) => b.x - a.x); charsToShift.forEach(item => { paperData[`${item.x + GRID_SIZE},${item.y}`] = paperData[item.key]; delete paperData[item.key]; }); paperData[`${currentX},${currentY}`] = char; cursorPosition.x += GRID_SIZE; }
    function deleteCharBackward() { if (cursorPosition.x === 0) return; const prevX = cursorPosition.x - GRID_SIZE; const currentY = cursorPosition.y; delete paperData[`${prevX},${currentY}`]; const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x >= cursorPosition.x).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { paperData[`${item.x - GRID_SIZE},${item.y}`] = paperData[item.key]; delete paperData[item.key]; }); cursorPosition.x = prevX; }
    function deleteCharForward() { const { x: currentX, y: currentY } = cursorPosition; delete paperData[`${currentX},${currentY}`]; const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x > currentX).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { paperData[`${item.x - GRID_SIZE},${item.y}`] = paperData[item.key]; delete paperData[item.key]; }); }
    
    container.addEventListener('click', (event) => { const rect = container.getBoundingClientRect(); const x = event.clientX - rect.left + container.scrollLeft; const y = event.clientY - rect.top + container.scrollTop; cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE; cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE; if (currentMode === 'visual' || currentMode === 'arrow') { currentMode = 'normal'; selectionStart = null; pendingArrow = null; } render(); });

    hiddenInput.addEventListener('keydown', (e) => { if (isComposing) return; if (currentMode === 'normal') handleNormalModeKeys(e); else if (currentMode === 'visual') handleVisualModeKeys(e); else if (currentMode === 'arrow') handleArrowModeKeys(e); });

    function handleNormalModeKeys(e) {
        if ((e.key === 'e' || e.key === 'l') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (e.key === 'e') {
                currentMode = 'visual';
                selectionStart = { ...cursorPosition };
            } else if (e.key === 'l') {
                currentMode = 'arrow';
                // 【変更】始点の位置を pendingArrow に記憶
                pendingArrow = { x: cursorPosition.x, y: cursorPosition.y, direction: null };
            }
            render();
            return;
        }
        // ... (省略：他のキー操作は変更なし)
        const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter']; if (controlKeys.includes(e.key)) { e.preventDefault(); if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE); if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE; if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE); if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE; if (e.key === 'Enter') { insertChar('\n'); cursorPosition.y += GRID_SIZE; cursorPosition.x = 0; } if (e.key === 'Backspace') deleteCharBackward(); if (e.key === 'Delete') deleteCharForward(); render(); }
    }

    function handleVisualModeKeys(e) {
        e.preventDefault();
        // ... (省略：変更なし)
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']; if (arrowKeys.includes(e.key)) { if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE); if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE; if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE); if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE; } if (e.key === 'Enter') { const rect = getSelectionRect(); if (rect) { boxes.push({ id: `box${nextId++}`, ...rect }); } currentMode = 'normal'; selectionStart = null; } if (e.key === 'Escape') { currentMode = 'normal'; selectionStart = null; } if (e.key === 'Delete' || e.key === 'Backspace') { const rect = getSelectionRect(); if (rect) { const boxToDelete = boxes.find(box => box.x === rect.x && box.y === rect.y && box.width === rect.width && box.height === rect.height); if (boxToDelete) { boxes = boxes.filter(box => box.id !== boxToDelete.id); } arrows = arrows.filter(arrow => !Object.keys(arrow).find(key => { const [x,y] = key.split(',').map(Number); return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height; })); } currentMode = 'normal'; selectionStart = null; } render();
    }

    // 【変更】矢印モードのロジックを「スタンプ」方式に全面変更
    function handleArrowModeKeys(e) {
        e.preventDefault();
        
        const arrowKeyMap = { 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right' };
        if (arrowKeyMap[e.key]) {
            pendingArrow.direction = arrowKeyMap[e.key];
        } else if (e.key === 'Enter') {
            if (pendingArrow && pendingArrow.direction) {
                const key = `${pendingArrow.x},${pendingArrow.y}`;
                arrows[key] = pendingArrow.direction;
            }
            currentMode = 'normal';
            pendingArrow = null;
        } else if (e.key === 'Escape') {
            currentMode = 'normal';
            pendingArrow = null;
        }
        render();
    }
    
    // --- (省略：handleTextInput, IME関連のリスナーは変更なし) ---
    const handleTextInput = (text) => { if (text) { for (const char of text) { insertChar(char); } render(); } };
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data; render(); });
    hiddenInput.addEventListener('compositionend', (e) => { isComposing = false; compositionText = ''; handleTextInput(e.data); e.target.value = ''; });
    hiddenInput.addEventListener('input', (e) => { if (isComposing) return; handleTextInput(e.target.value); e.target.value = ''; });

    render();
});
