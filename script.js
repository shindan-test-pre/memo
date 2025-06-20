document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const svgLayer = document.getElementById('arrow-svg-layer');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    container.appendChild(hiddenInput);

    const GRID_SIZE = 20;

    // --- データ管理 ---
    let paperData = {};
    let boxes = [];
    let arrows = [];
    let nextBoxId = 0;

    // --- 状態管理 ---
    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal';
    let selectionStart = null;
    let arrowStartBoxId = null;

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
        marker.setAttribute('id', 'arrowhead');
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

        arrows.forEach(arrow => {
            const fromBox = boxes.find(b => b.id === arrow.from);
            const toBox = boxes.find(b => b.id === arrow.to);
            if (fromBox && toBox) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const x1 = fromBox.x + fromBox.width / 2;
                const y1 = fromBox.y + fromBox.height / 2;
                const x2 = toBox.x + toBox.width / 2;
                const y2 = toBox.y + toBox.height / 2;
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('class', 'arrow-line');
                line.setAttribute('marker-end', 'url(#arrowhead)');
                svgLayer.appendChild(line);
            }
        });

        boxes.forEach(box => {
            const boxEl = document.createElement('div');
            boxEl.classList.add('border-box');
            if (currentMode === 'arrow' && box.id === arrowStartBoxId) {
                boxEl.classList.add('arrow-start');
            }
            boxEl.style.left = `${box.x}px`;
            boxEl.style.top = `${box.y}px`;
            boxEl.style.width = `${box.width}px`;
            boxEl.style.height = `${box.height}px`;
            container.appendChild(boxEl);
        });

        for (const key in paperData) {
            const [x, y] = key.split(',').map(Number);
            createCharCell(paperData[key], x, y);
        }

        if (currentMode === 'visual' && selectionStart) {
            const { x, y, width, height } = getSelectionRect();
            const highlightEl = document.createElement('div');
            highlightEl.classList.add('selection-highlight');
            highlightEl.style.left = `${x}px`;
            highlightEl.style.top = `${y}px`;
            highlightEl.style.width = `${width}px`;
            highlightEl.style.height = `${height}px`;
            container.appendChild(highlightEl);
        }

        if (isComposing && compositionText) {
            let tempX = cursorPosition.x;
            for (const char of compositionText) {
                createCharCell(char, tempX, cursorPosition.y, true);
                tempX += GRID_SIZE;
            }
        }

        const cursorX = cursorPosition.x + (isComposing ? compositionText.length * GRID_SIZE : 0);
        cursorElement.style.left = `${cursorX}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);

        hiddenInput.style.left = `${cursorX}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        hiddenInput.focus();
    }

    function createCharCell(char, x, y, isComposingChar = false) {
        const charCell = document.createElement('div');
        charCell.classList.add('char-cell');
        if (isComposingChar) charCell.classList.add('composing-char');
        charCell.style.left = `${x}px`;
        charCell.style.top = `${y}px`;
        charCell.innerText = char;
        container.appendChild(charCell);
    }

    function getSelectionRect() {
        if (!selectionStart) return null;
        const x1 = Math.min(selectionStart.x, cursorPosition.x);
        const y1 = Math.min(selectionStart.y, cursorPosition.y);
        const x2 = Math.max(selectionStart.x, cursorPosition.x);
        const y2 = Math.max(selectionStart.y, cursorPosition.y);
        return { x: x1, y: y1, width: x2 - x1 + GRID_SIZE, height: y2 - y1 + GRID_SIZE };
    }

    function operateOnLine(y, charIndex, deleteCount, textToInsert = '') {
        const lineChars = Object.keys(paperData).map(key => ({ x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) })).filter(item => item.y === y).sort((a, b) => a.x - b.x);
        let lineText = lineChars.map(item => paperData[`${item.x},${item.y}`]).join('');
        const textArray = lineText.split('');
        textArray.splice(charIndex, deleteCount, ...textToInsert.split(''));
        lineText = textArray.join('');
        lineChars.forEach(item => delete paperData[`${item.x},${item.y}`]);
        for (let i = 0; i < lineText.length; i++) {
            paperData[`${i * GRID_SIZE},${y}`] = lineText[i];
        }
    }

    function findBoxAtCursor() {
        return boxes.find(box =>
            cursorPosition.x >= box.x && cursorPosition.x < box.x + box.width &&
            cursorPosition.y >= box.y && cursorPosition.y < box.y + box.height
        );
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
            arrowStartBoxId = null;
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
        if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            currentMode = 'visual';
            selectionStart = { ...cursorPosition };
            render();
            return;
        }
        if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const startBox = findBoxAtCursor();
            if (startBox) {
                currentMode = 'arrow';
                arrowStartBoxId = startBox.id;
                render();
            }
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
                const charIndex = Math.floor(cursorPosition.x / GRID_SIZE);
                operateOnLine(cursorPosition.y, charIndex, 0, '\n');
                cursorPosition.y += GRID_SIZE;
                cursorPosition.x = 0;
            }

            const charIndex = Math.floor(cursorPosition.x / GRID_SIZE);
            if (e.key === 'Backspace') {
                if (cursorPosition.x > 0 || charIndex > 0) {
                    operateOnLine(cursorPosition.y, charIndex - 1, 1, '');
                    if (cursorPosition.x > 0) cursorPosition.x -= GRID_SIZE;
                }
            }
            if (e.key === 'Delete') {
                operateOnLine(cursorPosition.y, charIndex, 1, '');
            }
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
                boxes.push({ id: `box${nextBoxId++}`, ...rect });
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
                boxes = boxes.filter(box => !(box.x === rect.x && box.y === rect.y && box.width === rect.width && box.height === rect.height));
            }
            currentMode = 'normal';
            selectionStart = null;
        }
        render();
    }

    function handleArrowModeKeys(e) {
        e.preventDefault();
        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (arrowKeys.includes(e.key)) {
            if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE);
            if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE;
            if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE);
            if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE;
        }
        if (e.key === 'Enter') {
            const endBox = findBoxAtCursor();
            if (endBox && endBox.id !== arrowStartBoxId) {
                arrows.push({ from: arrowStartBoxId, to: endBox.id });
            }
            currentMode = 'normal';
            arrowStartBoxId = null;
        }
        if (e.key === 'Escape') {
            currentMode = 'normal';
            arrowStartBoxId = null;
        }
        render();
    }

    const handleTextInput = (text) => {
        if (text) {
            const charIndex = Math.floor(cursorPosition.x / GRID_SIZE);
            operateOnLine(cursorPosition.y, charIndex, 0, text);
            cursorPosition.x += text.length * GRID_SIZE;
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

    render();
});
