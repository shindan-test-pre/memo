document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    container.appendChild(hiddenInput);

    const GRID_SIZE = 20;

    let paperData = {};
    let boxes = []; 
    let nextBoxId = 0;

    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal';
    let selectionStart = null;

    let isComposing = false;
    let compositionText = '';

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    function render() {
        const elementsToRemove = container.querySelectorAll('.char-cell, .cursor, .selection-highlight, .border-box');
        elementsToRemove.forEach(el => el.remove());

        boxes.forEach(box => {
            const boxEl = document.createElement('div');
            boxEl.classList.add('border-box');
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
        return {
            x: x1,
            y: y1,
            width: x2 - x1 + GRID_SIZE,
            height: y2 - y1 + GRID_SIZE,
        };
    }

    // 【NEW】文字の「挿入」を行う新しい関数
    function insertText(text) {
        if (!text) return;

        for (const char of text) {
            const currentX = cursorPosition.x;
            const currentY = cursorPosition.y;

            // 1. 同じ行で、カーソル位置より右にある文字を取得し、x座標の大きい順（右から）にソート
            const charsToShift = Object.keys(paperData)
                .map(key => ({ key, ...JSON.parse(`{"x":${key.split(',')[0]},"y":${key.split(',')[1]}}`) }))
                .filter(item => item.y === currentY && item.x >= currentX)
                .sort((a, b) => b.x - a.x);
            
            // 2. 取得した文字を1マスずつ右にずらす
            charsToShift.forEach(item => {
                const charToMove = paperData[item.key];
                const newKey = `${item.x + GRID_SIZE},${item.y}`;
                paperData[newKey] = charToMove;
            });
            
            // 3. カーソル位置に新しい文字を挿入
            const newCharKey = `${currentX},${currentY}`;
            paperData[newCharKey] = char;

            // 4. カーソルを右に移動
            cursorPosition.x += GRID_SIZE;
        }
    }
    
    container.addEventListener('click', (event) => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + container.scrollLeft;
        const y = event.clientY - rect.top + container.scrollTop;
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE;
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE;
        if (currentMode === 'visual') {
            currentMode = 'normal';
            selectionStart = null;
        }
        render();
    });

    hiddenInput.addEventListener('keydown', (e) => {
        if (isComposing) return;
        if (currentMode === 'normal') handleNormalModeKeys(e);
        else if (currentMode === 'visual') handleVisualModeKeys(e);
    });

    function handleNormalModeKeys(e) {
        if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            currentMode = 'visual';
            selectionStart = { ...cursorPosition };
            render();
            return;
        }
        
        // 【NEW】枠線削除のショートカット
        if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const boxToDelete = boxes.find(box => 
                cursorPosition.x >= box.x && cursorPosition.x < box.x + box.width &&
                cursorPosition.y >= box.y && cursorPosition.y < box.y + box.height
            );
            if (boxToDelete) {
                boxes = boxes.filter(box => box.id !== boxToDelete.id);
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
                cursorPosition.y += GRID_SIZE;
                cursorPosition.x = 0;
            }

            // 【NEW】Backspace と Delete のロジックを「文字ずらし」に対応
            if (e.key === 'Backspace') {
                if (cursorPosition.x > 0) {
                    cursorPosition.x -= GRID_SIZE;
                    const keyToDelete = `${cursorPosition.x},${cursorPosition.y}`;
                    delete paperData[keyToDelete];
                    // 後続の文字を左に詰める
                    const charsToShift = Object.keys(paperData)
                        .map(key => ({ key, ...JSON.parse(`{"x":${key.split(',')[0]},"y":${key.split(',')[1]}}`) }))
                        .filter(item => item.y === cursorPosition.y && item.x > cursorPosition.x)
                        .sort((a, b) => a.x - b.x); // x座標の小さい順（左から）
                    
                    charsToShift.forEach(item => {
                        const charToMove = paperData[item.key];
                        paperData[`${item.x - GRID_SIZE},${item.y}`] = charToMove;
                        delete paperData[item.key];
                    });
                }
            }
            if (e.key === 'Delete') {
                const keyToDelete = `${cursorPosition.x},${cursorPosition.y}`;
                delete paperData[keyToDelete];
                 // 後続の文字を左に詰める（同上）
                const charsToShift = Object.keys(paperData)
                    .map(key => ({ key, ...JSON.parse(`{"x":${key.split(',')[0]},"y":${key.split(',')[1]}}`) }))
                    .filter(item => item.y === cursorPosition.y && item.x > cursorPosition.x)
                    .sort((a, b) => a.x - b.x);
                
                charsToShift.forEach(item => {
                    const charToMove = paperData[item.key];
                    paperData[`${item.x - GRID_SIZE},${item.y}`] = charToMove;
                    delete paperData[item.key];
                });
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
        render();
    }
    
    // 日本語入力関連は、文字入力を insertText 関数に渡すように変更
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data; render(); });
    hiddenInput.addEventListener('compositionend', (e) => {
        isComposing = false;
        compositionText = '';
        insertText(e.data); // typeText -> insertText
        render();
        hiddenInput.value = '';
    });
    hiddenInput.addEventListener('input', (e) => {
        if (isComposing) return;
        insertText(e.target.value); // typeText -> insertText
        render();
        e.target.value = '';
    });

    render();
});
