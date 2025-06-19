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
    
    // 【NEW】行のデータを再構築する方式に全面変更
    function rebaseLine(y, cursorIndex, textToInsert = '') {
        // 1. 対象行の文字をすべて取得し、x座標でソート
        const lineChars = Object.keys(paperData)
            .map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) }))
            .filter(item => item.y === y)
            .sort((a, b) => a.x - b.x);

        // 2. 行の文字列を再構築
        let lineText = lineChars.map(item => paperData[item.key]).join('');
        
        // 3. 文字列に新しい文字を挿入
        const charIndex = Math.floor(cursorIndex / GRID_SIZE);
        lineText = lineText.slice(0, charIndex) + textToInsert + lineText.slice(charIndex);

        // 4. 対象行の古いデータをすべて削除
        lineChars.forEach(item => delete paperData[item.key]);

        // 5. 新しい文字列でデータを再構築
        for (let i = 0; i < lineText.length; i++) {
            const char = lineText[i];
            const newKey = `${i * GRID_SIZE},${y}`;
            paperData[newKey] = char;
        }
    }

    // --- イベントリスナー ---
    
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
        
        // 【NEW】枠線削除のショートカットを Shift + Delete に変更
        if (e.key === 'Delete' && e.shiftKey) {
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

            // 【NEW】Backspace と Delete のロジックを行の再構築方式に変更
            if (e.key === 'Backspace') {
                if (cursorPosition.x > 0) {
                    rebaseLine(cursorPosition.y, cursorPosition.x - GRID_SIZE, '');
                    cursorPosition.x -= GRID_SIZE;
                }
            }
            if (e.key === 'Delete') {
                rebaseLine(cursorPosition.y, cursorPosition.x, '');
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
    
    // 【NEW】文字入力イベントを行の再構築方式に変更
    const handleTextInput = (text) => {
        if (text) {
            rebaseLine(cursorPosition.y, cursorPosition.x, text);
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
