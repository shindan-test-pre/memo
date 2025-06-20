document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const svgLayer = document.getElementById('arrow-svg-layer');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    container.appendChild(hiddenInput);

    const GRID_SIZE = 20;

    let paperData = {}, boxes = [], arrows = [], nextId = 0;
    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal', selectionStart = null, currentArrowPath = [];
    let isComposing = false, compositionText = '';

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    // --- 描画関連 ---
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
        marker.setAttribute('markerWidth', '4');
        marker.setAttribute('markerHeight', '4');
        marker.setAttribute('orient', 'auto-start-reverse');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', '#333');
        marker.appendChild(path);
defs.appendChild(marker);
        svgLayer.appendChild(defs);

        // 【最終修正】矢印描画ロジックを、単一の<polyline>で描く方式に刷新
        const drawArrowPath = (path, isPreview = false) => {
            if (path.length < 2) return;
            
            let points = path.map(p => ({ x: p.x + GRID_SIZE / 2, y: p.y + GRID_SIZE / 2 }));
            
            const startPoint = points[0];
            const endPoint = points[points.length - 1];
            const secondPoint = points[1];
            const secondLastPoint = points[points.length - 2];

            const startBox = boxes.find(b => startPoint.x >= b.x && startPoint.x <= b.x + b.width && startPoint.y >= b.y && startPoint.y <= b.y + b.height);
            const endBox = boxes.find(b => endPoint.x >= b.x && endPoint.x <= b.x + b.width && endPoint.y >= b.y && endPoint.y <= b.y + b.height);
            
            if (startBox) points[0] = getIntersectionPoint(startBox, secondPoint);
            if (endBox) points[points.length - 1] = getIntersectionPoint(endBox, secondLastPoint);

            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
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
    
    function getIntersectionPoint(box, outsidePoint) {
        const boxCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const line = { p1: boxCenter, p2: outsidePoint };
        const sides = [
            { p1: { x: box.x, y: box.y }, p2: { x: box.x + box.width, y: box.y } }, // Top
            { p1: { x: box.x + box.width, y: box.y }, p2: { x: box.x + box.width, y: box.y + box.height } }, // Right
            { p1: { x: box.x, y: box.y + box.height }, p2: { x: box.x + box.width, y: box.y + box.height } }, // Bottom
            { p1: { x: box.x, y: box.y }, p2: { x: box.x, y: box.y + box.height } }  // Left
        ];
        for (const side of sides) {
            const intersect = lineIntersect(line.p1.x, line.p1.y, line.p2.x, line.p2.y, side.p1.x, side.p1.y, side.p2.x, side.p2.y);
            if (intersect) return intersect;
        }
        return boxCenter; // Fallback
    }

    function lineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (den === 0) return null;
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
        if (t > 0 && t < 1 && u > 0 && u < 1) {
            return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
        }
        return null;
    }
    
    // --- (以下、前回から変更のない関数群です) ---
    function createCharCell(char, x, y, isComposingChar = false) { const charCell = document.createElement('div'); charCell.classList.add('char-cell'); if (isComposingChar) charCell.classList.add('composing-char'); charCell.style.left = `${x}px`; charCell.style.top = `${y}px`; charCell.innerText = char === '\n' ? '' : char; container.appendChild(charCell); }
    function getSelectionRect() { if (!selectionStart) return null; const x1 = Math.min(selectionStart.x, cursorPosition.x); const y1 = Math.min(selectionStart.y, cursorPosition.y); const x2 = Math.max(selectionStart.x, cursorPosition.x); const y2 = Math.max(selectionStart.y, cursorPosition.y); return { x: x1, y: y1, width: x2 - x1 + GRID_SIZE, height: y2 - y1 + GRID_SIZE, }; }
    function insertChar(char) { const { x: currentX, y: currentY } = cursorPosition; const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x >= currentX).sort((a, b) => b.x - a.x); charsToShift.forEach(item => { paperData[`${item.x + GRID_SIZE},${item.y}`] = paperData[item.key]; }); paperData[`${currentX},${currentY}`] = char; cursorPosition.x += GRID_SIZE; }
    function deleteCharBackward() { if (cursorPosition.x === 0) return; const prevX = cursorPosition.x - GRID_SIZE; const currentY = cursorPosition.y; delete paperData[`${prevX},${currentY}`]; const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x >= cursorPosition.x).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { paperData[`${item.x - GRID_SIZE},${item.y}`] = paperData[item.key]; delete paperData[item.key]; }); cursorPosition.x = prevX; }
    function deleteCharForward() { const { x: currentX, y: currentY } = cursorPosition; delete paperData[`${currentX},${currentY}`]; const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x > currentX).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { paperData[`${item.x - GRID_SIZE},${item.y}`] = paperData[item.key]; delete paperData[item.key]; }); }
    container.addEventListener('click', (event) => { const rect = container.getBoundingClientRect(); const x = event.clientX - rect.left + container.scrollLeft; const y = event.clientY - rect.top + container.scrollTop; cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE; cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE; if (currentMode === 'visual' || currentMode === 'arrow') { currentMode = 'normal'; selectionStart = null; currentArrowPath = []; } render(); });
    hiddenInput.addEventListener('keydown', (e) => { if (isComposing) return; if (currentMode === 'normal') handleNormalModeKeys(e); else if (currentMode === 'visual') handleVisualModeKeys(e); else if (currentMode === 'arrow') handleArrowModeKeys(e); });
    function handleNormalModeKeys(e) { if ((e.key === 'e' || e.key === 'l') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (e.key === 'e') { currentMode = 'visual'; selectionStart = { ...cursorPosition }; } else if (e.key === 'l') { currentMode = 'arrow'; currentArrowPath = [{...cursorPosition}]; } render(); return; } const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter']; if (controlKeys.includes(e.key)) { e.preventDefault(); if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE); if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE; if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE); if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE; if (e.key === 'Enter') { insertChar('\n'); cursorPosition.y += GRID_SIZE; cursorPosition.x = 0; } if (e.key === 'Backspace') deleteCharBackward(); if (e.key === 'Delete') deleteCharForward(); render(); } }
    function handleVisualModeKeys(e) { e.preventDefault(); const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']; if (arrowKeys.includes(e.key)) { if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE); if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE; if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE); if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE; } if (e.key === 'Enter') { const rect = getSelectionRect(); if (rect) { boxes.push({ id: `box${nextId++}`, ...rect }); } currentMode = 'normal'; selectionStart = null; } if (e.key === 'Escape') { currentMode = 'normal'; selectionStart = null; } if (e.key === 'Delete' || e.key === 'Backspace') { const rect = getSelectionRect(); if (rect) { const boxToDelete = boxes.find(box => box.x === rect.x && box.y === rect.y && box.width === rect.width && box.height === rect.height); if (boxToDelete) { boxes = boxes.filter(box => box.id !== boxToDelete.id); } arrows = arrows.filter(arrow => { const isArrowIntersecting = arrow.path.some(p => p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height); return !isArrowIntersecting; }); } currentMode = 'normal'; selectionStart = null; } render(); }
    function handleArrowModeKeys(e) { e.preventDefault(); const lastPoint = currentArrowPath[currentArrowPath.length - 1]; if (!lastPoint) { currentMode = 'normal'; render(); return; } let nextPoint = { ...lastPoint }; if (e.key === 'ArrowUp') nextPoint.y -= GRID_SIZE; else if (e.key === 'ArrowDown') nextPoint.y += GRID_SIZE; else if (e.key === 'ArrowLeft') nextPoint.x -= GRID_SIZE; else if (e.key === 'ArrowRight') nextPoint.x += GRID_SIZE; else if (e.key === 'Enter') { if (currentArrowPath.length > 1) { arrows.push({ id: `arrow${nextId++}`, path: currentArrowPath }); } currentMode = 'normal'; currentArrowPath = []; } else if (e.key === 'Escape') { currentMode = 'normal'; currentArrowPath = []; } if (nextPoint.x !== lastPoint.x || nextPoint.y !== lastPoint.y) currentArrowPath.push(nextPoint); render(); }
    const handleTextInput = (text) => { if (text) { for (const char of text) { insertChar(char); } render(); } };
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data; render(); });
    hiddenInput.addEventListener('compositionend', (e) => { isComposing = false; compositionText = ''; handleTextInput(e.data); e.target.value = ''; });
    hiddenInput.addEventListener('input', (e) => { if (isComposing) return; handleTextInput(e.target.value); e.target.value = ''; });

    render();
});
