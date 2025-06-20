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

    function render() {
        const elementsToRemove = container.querySelectorAll('.char-cell, .cursor, .selection-highlight, .border-box, .arrow-path-start');
        elementsToRemove.forEach(el => el.remove());
        svgLayer.innerHTML = '';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.id = 'arrowhead';
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', '#333');
        marker.appendChild(path);
        defs.appendChild(marker);
        svgLayer.appendChild(defs);

        // --- 矢印描画ロジック ---
        const drawArrow = (arrowPath, isPreview = false) => {
            if (arrowPath.length < 2) return;
            
            let startPoint = { ...arrowPath[0], x: arrowPath[0].x + GRID_SIZE / 2, y: arrowPath[0].y + GRID_SIZE / 2 };
            let endPoint = { ...arrowPath[arrowPath.length - 1], x: arrowPath[arrowPath.length - 1].x + GRID_SIZE / 2, y: arrowPath[arrowPath.length - 1].y + GRID_SIZE / 2 };

            const startBox = boxes.find(b => startPoint.x >= b.x && startPoint.x <= b.x + b.width && startPoint.y >= b.y && startPoint.y <= b.y + b.height);
            const endBox = boxes.find(b => endPoint.x >= b.x && endPoint.x <= b.x + b.width && endPoint.y >= b.y && endPoint.y <= b.y + b.height);
            
            if (startBox) startPoint = getIntersectionPoint(startBox, arrowPath[1] ? { ...arrowPath[1], x: arrowPath[1].x + GRID_SIZE / 2, y: arrowPath[1].y + GRID_SIZE / 2 } : endPoint);
            if (endBox) endPoint = getIntersectionPoint(endBox, arrowPath[arrowPath.length - 2] ? { ...arrowPath[arrowPath.length - 2], x: arrowPath[arrowPath.length - 2].x + GRID_SIZE / 2, y: arrowPath[arrowPath.length - 2].y + GRID_SIZE / 2 } : startPoint);

            const points = [startPoint, ...arrowPath.slice(1, -1).map(p => ({ x: p.x + GRID_SIZE / 2, y: p.y + GRID_SIZE / 2 })), endPoint]
                           .map(p => `${p.x},${p.y}`).join(' ');

            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.setAttribute('points', points);
            polyline.setAttribute('class', 'arrow-line');
            polyline.setAttribute('marker-end', 'url(#arrowhead)');
            polyline.setAttribute('fill', 'none');
            if (isPreview) polyline.style.opacity = '0.5';
            svgLayer.appendChild(polyline);
        };
        
        arrows.forEach(arrow => drawArrow(arrow.path));
        if (currentMode === 'arrow') drawArrow(currentArrowPath, true);
        
        // --- ここから先の描画処理 ---
        boxes.forEach(box => { /* ... (変更なし) ... */ });
        for (const key in paperData) { /* ... (変更なし) ... */ }
        if (currentMode === 'visual' && selectionStart) { /* ... (変更なし) ... */ }

        if (currentMode === 'arrow' && currentArrowPath.length === 1) {
            const startHighlight = document.createElement('div');
            startHighlight.classList.add('arrow-path-start');
            startHighlight.style.left = `${currentArrowPath[0].x}px`;
            startHighlight.style.top = `${currentArrowPath[0].y}px`;
            startHighlight.style.width = `${GRID_SIZE}px`;
            startHighlight.style.height = `${GRID_SIZE}px`;
            container.appendChild(startHighlight);
        }

        if (isComposing && compositionText) { /* ... (変更なし) ... */ }
        
        const cursorX = cursorPosition.x + (isComposing ? compositionText.length * GRID_SIZE : 0);
        cursorElement.style.left = `${cursorX}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);

        hiddenInput.style.left = `${cursorX}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        hiddenInput.focus();
    }
    
    // --- 枠線と線の交点を求めるヘルパー関数 ---
    function getIntersectionPoint(box, outsidePoint) {
        const boxCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const dx = outsidePoint.x - boxCenter.x;
        const dy = outsidePoint.y - boxCenter.y;

        let t = Infinity;
        if (dx !== 0) {
            t = Math.min(t, ((dx > 0 ? box.x + box.width : box.x) - boxCenter.x) / dx);
        }
        if (dy !== 0) {
            t = Math.min(t, ((dy > 0 ? box.y + box.height : box.y) - boxCenter.y) / dy);
        }
        return { x: boxCenter.x + t * dx, y: boxCenter.y + t * dy };
    }

    // --- (省略：ここから先の関数は、前回から変更ありません) ---
    // (ここから省略部分を展開)
    function createCharCell(char, x, y, isComposingChar = false) {
        const charCell = document.createElement('div');
        charCell.classList.add('char-cell');
        if (isComposingChar) charCell.classList.add('composing-char');
        charCell.style.left = `${x}px`;
        charCell.style.top = `${y}px`;
        charCell.innerText = char === '\n' ? '' : char;
        container.appendChild(charCell);
    }
    
    function getSelectionRect() {
        if (!selectionStart) return null;
        const x1 = Math.min(selectionStart.x, cursorPosition.x);
        const y1 = Math.min(selectionStart.y, cursorPosition.y);
        const x2 = Math.max(selectionStart.x, cursorPosition.x);
        const y2 = Math.max(selectionStart.y, cursorPosition.y);
        return { x: x1, y: y1, width: x2 - x1 + GRID_SIZE, height: y2 - y1 + GRID_SIZE, };
    }

    function insertChar(char) {
        const { x: currentX, y: currentY } = cursorPosition;
        const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x >= currentX).sort((a, b) => b.x - a.x);
        charsToShift.forEach(item => { paperData[`${item.x + GRID_SIZE},${item.y}`] = paperData[item.key]; });
        paperData[`${currentX},${currentY}`] = char;
        cursorPosition.x += GRID_SIZE;
    }

    function deleteCharBackward() {
        if (cursorPosition.x === 0) return;
        const prevX = cursorPosition.x - GRID_SIZE;
        const currentY = cursorPosition.y;
        delete paperData[`${prevX},${currentY}`];
        const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x >= cursorPosition.x).sort((a, b) => a.x - b.x);
        charsToShift.forEach(item => {
            paperData[`${item.x - GRID_SIZE},${item.y}`] = paperData[item.key];
            delete paperData[item.key];
        });
        cursorPosition.x = prevX;
    }

    function deleteCharForward() {
        const { x: currentX, y: currentY } = cursorPosition;
        delete paperData[`${currentX},${currentY}`];
        const charsToShift = Object.keys(paperData).map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === currentY && item.x > currentX).sort((a, b) => a.x - b.x);
        charsToShift.forEach(item => {
            paperData[`${item.x - GRID_SIZE},${item.y}`] = paperData[item.key];
            delete paperData[item.key];
        });
    }
    
    container.addEventListener('click', (event) => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + container.scrollLeft;
        const y = event.clientY - rect.top + container.scrollTop;
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE;
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE;
        if (currentMode === 'visual' || currentMode === 'arrow') {
            currentMode = 'normal';
            selectionStart = null;
            currentArrowPath = [];
        }
        render();
    });

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
                currentArrowPath = [{ ...cursorPosition }];
            }
            render();
            return;
        }
        const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter'];
        if (controlKeys.includes(e.key)) {
            e.preventDefault();
            if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE);
            if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE;
            if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE);
            if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE;
            if (e.key === 'Enter') {
                insertChar('\n');
                cursorPosition.y += GRID_SIZE;
                cursorPosition.x = 0;
            }
            if (e.key === 'Backspace') deleteCharBackward();
            if (e.key === 'Delete') deleteCharForward();
            render();
        }
    }

    function handleVisualModeKeys(e) {
        e.preventDefault();
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (arrowKeys.includes(e.key)) {
            if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE);
            if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE;
            if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE);
            if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE;
        }
        if (e.key === 'Enter') {
            const rect = getSelectionRect();
            if (rect) {
                boxes.push({ id: `box${nextId++}`, ...rect });
            }
            currentMode = 'normal';
            selectionStart = null;
        }
        if (e.key === 'Escape') {
            currentMode = 'normal';
            selectionStart = null;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const rect = getSelectionRect();
            if (rect) {
                const boxToDelete = boxes.find(box => box.x === rect.x && box.y === rect.y && box.width === rect.width && box.height === rect.height);
                if (boxToDelete) {
                    boxes = boxes.filter(box => box.id !== boxToDelete.id);
                }
                arrows = arrows.filter(arrow => {
                    const isArrowIntersecting = arrow.path.some(p => p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height);
                    return !isArrowIntersecting;
                });
            }
            currentMode = 'normal';
            selectionStart = null;
        }
        render();
    }

    function handleArrowModeKeys(e) {
        e.preventDefault();
        const lastPoint = currentArrowPath[currentArrowPath.length - 1];
        if (!lastPoint) { currentMode = 'normal'; render(); return; }
        let nextPoint = { ...lastPoint };
        if (e.key === 'ArrowUp' && lastPoint.y > 0) nextPoint.y -= GRID_SIZE;
        else if (e.key === 'ArrowDown') nextPoint.y += GRID_SIZE;
        else if (e.key === 'ArrowLeft' && lastPoint.x > 0) nextPoint.x -= GRID_SIZE;
        else if (e.key === 'ArrowRight') nextPoint.x += GRID_SIZE;
        else if (e.key === 'Enter') {
            if (currentArrowPath.length > 1) arrows.push({ id: `arrow${nextId++}`, path: currentArrowPath });
            currentMode = 'normal';
            currentArrowPath = [];
        } else if (e.key === 'Escape') {
            currentMode = 'normal';
            currentArrowPath = [];
        }
        if(nextPoint.x !== lastPoint.x || nextPoint.y !== lastPoint.y) currentArrowPath.push(nextPoint);
        render();
    }
    
    const handleTextInput = (text) => {
        if (text) {
            for (const char of text) { insertChar(char); }
            render();
        }
    };
    
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data; render(); });
    hiddenInput.addEventListener('compositionend', (e) => {
        isComposing = false;
        compositionText = '';
        handleTextInput(e.data);
        e.target.value = '';
    });
    hiddenInput.addEventListener('input', (e) => {
        if (isComposing) return;
        handleTextInput(e.target.value);
        e.target.value = '';
    });
    //(ここまで)

    // 初期描画
    render();
});
