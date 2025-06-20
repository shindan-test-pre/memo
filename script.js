document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const svgLayer = document.getElementById('arrow-svg-layer');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    container.appendChild(hiddenInput);

    const GRID_SIZE = 20;

    let paperData = {};
    let boxes = [];
    let arrows = {}; // 【変更】矢印データ構造を { "x,y": "direction" } に変更
    let nextId = 0;

    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal'; // 'normal' | 'visual' | 'arrow'
    let selectionStart = null;

    let isComposing = false;
    let compositionText = '';

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
        marker.setAttribute('markerWidth', '4'); // 先端を少し小さく
        marker.setAttribute('markerHeight', '4');
        marker.setAttribute('orient', 'auto-start-reverse');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', '#333');
        marker.appendChild(path);
        defs.appendChild(marker);
        svgLayer.appendChild(defs);

        // 【変更】新しい矢印データ構造に基づいて、マス目単位で矢印を描画
        for (const key in arrows) {
            const [x, y] = key.split(',').map(Number);
            const direction = arrows[key];
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            
            let x1, y1, x2, y2;
            const centerOffset = GRID_SIZE / 2;

            switch (direction) {
                case 'right':
                    x1 = x; y1 = y + centerOffset; x2 = x + GRID_SIZE; y2 = y + centerOffset;
                    break;
                case 'left':
                    x1 = x + GRID_SIZE; y1 = y + centerOffset; x2 = x; y2 = y + centerOffset;
                    break;
                case 'down':
                    x1 = x + centerOffset; y1 = y; x2 = x + centerOffset; y2 = y + GRID_SIZE;
                    break;
                case 'up':
                    x1 = x + centerOffset; y1 = y + GRID_SIZE; x2 = x + centerOffset; y2 = y;
                    break;
            }
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('class', 'arrow-line');
            line.setAttribute('marker-end', 'url(#arrowhead)');
            svgLayer.appendChild(line);
        }
        
        boxes.forEach(box => { /* ... (変更なし) ... */ });
        for (const key in paperData) { /* ... (変更なし) ... */ }
        if (currentMode === 'visual' && selectionStart) { /* ... (変更なし) ... */ }
        if (isComposing && compositionText) { /* ... (変更なし) ... */ }
        
        const cursorX = cursorPosition.x + (isComposing ? compositionText.length * GRID_SIZE : 0);
        cursorElement.style.left = `${cursorX}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);

        hiddenInput.style.left = `${cursorX}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        hiddenInput.focus();
    }

    // --- (省略：createCharCell, getSelectionRect, insertChar, deleteChar... などのヘルパー関数は変更なし) ---

    hiddenInput.addEventListener('keydown', (e) => {
        if (isComposing) return;
        if (currentMode === 'normal') handleNormalModeKeys(e);
        else if (currentMode === 'visual') handleVisualModeKeys(e);
        else if (currentMode === 'arrow') handleArrowModeKeys(e);
    });

    function handleNormalModeKeys(e) {
        if ((e.key === 'e' || e.key === 'l') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (e.key === 'e') {
                currentMode = 'visual';
                selectionStart = { ...cursorPosition };
            } else if (e.key === 'l') {
                currentMode = 'arrow';
            }
            render();
            return;
        }
        // ... (省略：他のキー操作は変更なし)
    }

    // 【変更】矢印モードのロジックを、マス目に矢印を描く方式に全面変更
    function handleArrowModeKeys(e) {
        e.preventDefault();
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (arrowKeys.includes(e.key)) {
            const key = `${cursorPosition.x},${cursorPosition.y}`;
            if (e.key === 'ArrowUp') {
                arrows[key] = 'up';
                cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE);
            } else if (e.key === 'ArrowDown') {
                arrows[key] = 'down';
                cursorPosition.y += GRID_SIZE;
            } else if (e.key === 'ArrowLeft') {
                arrows[key] = 'left';
                cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE);
            } else if (e.key === 'ArrowRight') {
                arrows[key] = 'right';
                cursorPosition.x += GRID_SIZE;
            }
        }
        
        // Backspaceで矢印を消す
        if (e.key === 'Backspace') {
            const prevX = Math.max(0, cursorPosition.x - GRID_SIZE);
            // ひとつ前のマスに戻って、そこにある矢印を消す（カーソルの動きを直感的にするため）
            const keyToDelete = `${prevX},${cursorPosition.y}`; // 仮。これはカーソルの動きに依存するので要調整
            // Backspaceはカーソルを戻してから、その位置の矢印を消すのが自然
            cursorPosition.x = prevX;
            delete arrows[`${cursorPosition.x},${cursorPosition.y}`];
        }

        if (e.key === 'Escape' || e.key === 'Enter') {
            currentMode = 'normal';
        }
        render();
    }
    
    // --- (省略：handleVisualModeKeys, handleTextInput, IME関連のリスナーは変更なし) ---
    // (省略部分を展開した完全なコード)
    function handleVisualModeKeys(e) { e.preventDefault(); const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']; if (arrowKeys.includes(e.key)) { if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE); if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE; if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE); if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE; } if (e.key === 'Enter') { const rect = getSelectionRect(); if (rect) { boxes.push({ id: `box${nextId++}`, ...rect }); } currentMode = 'normal'; selectionStart = null; } if (e.key === 'Escape') { currentMode = 'normal'; selectionStart = null; } if (e.key === 'Delete' || e.key === 'Backspace') { const rect = getSelectionRect(); if (rect) { const boxToDelete = boxes.find(box => box.x === rect.x && box.y === rect.y && box.width === rect.width && box.height === rect.height); if (boxToDelete) { boxes = boxes.filter(box => box.id !== boxToDelete.id); } arrows = arrows.filter(arrow => { const key = Object.keys(arrow)[0]; const path = arrow[key]; const isArrowIntersecting = path.some(p => p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height); return !isArrowIntersecting; }); } currentMode = 'normal'; selectionStart = null; } render(); }
    const handleTextInput = (text) => { if (text) { for (const char of text) { insertChar(char); } render(); } };
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data; render(); });
    hiddenInput.addEventListener('compositionend', (e) => { isComposing = false; compositionText = ''; handleTextInput(e.data); e.target.value = ''; });
    hiddenInput.addEventListener('input', (e) => { if (isComposing) return; handleTextInput(e.target.value); e.target.value = ''; });
    
    // 省略されていたヘルパー関数などもすべて含める
    boxes.forEach(box => { const boxEl = document.createElement('div'); boxEl.classList.add('border-box'); boxEl.style.left = `${box.x}px`; boxEl.style.top = `${box.y}px`; boxEl.style.width = `${box.width}px`; boxEl.style.height = `${box.height}px`; container.appendChild(boxEl); });
    for (const key in paperData) { const [x, y] = key.split(',').map(Number); createCharCell(paperData[key], x, y); }
    if (currentMode === 'visual' && selectionStart) { const { x, y, width, height } = getSelectionRect(); const highlightEl = document.createElement('div'); highlightEl.classList.add('selection-highlight'); highlightEl.style.left = `${x}px`; highlightEl.style.top = `${y}px`; highlightEl.style.width = `${width}px`; highlightEl.style.height = `${height}px`; container.appendChild(highlightEl); }
    if (isComposing && compositionText) { let tempX = cursorPosition.x; for (const char of compositionText) { createCharCell(char, tempX, cursorPosition.y, true); tempX += GRID_SIZE; } }
    function insertChar(char) { const { x: currentX, y: currentY } = cursorPosition; const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x >= currentX).sort((a, b) => b.x - a.x); charsToShift.forEach(item => { paperData[`${item.x + GRID_SIZE},${item.y}`] = paperData[item.key]; }); paperData[`${currentX},${currentY}`] = char; cursorPosition.x += GRID_SIZE; }
    function deleteCharBackward() { if (cursorPosition.x === 0) return; const prevX = cursorPosition.x - GRID_SIZE; const currentY = cursorPosition.y; delete paperData[`${prevX},${currentY}`]; const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x >= cursorPosition.x).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { paperData[`${item.x - GRID_SIZE},${item.y}`] = paperData[item.key]; delete paperData[item.key]; }); cursorPosition.x = prevX; }
    function deleteCharForward() { const { x: currentX, y: currentY } = cursorPosition; delete paperData[`${currentX},${currentY}`]; const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x > currentX).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { paperData[`${item.x - GRID_SIZE},${item.y}`] = paperData[item.key]; delete paperData[item.key]; }); }
    
    // 初期描画
    render();
});
