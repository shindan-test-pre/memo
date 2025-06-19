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

    // 【修正】文字の挿入・削除を行う、よりシンプルで堅牢な関数
    function operateOnLine(y, charIndex, deleteCount, textToInsert = '') {
        const lineChars = Object.keys(paperData)
            .map(key => ({ key, x: parseInt(key.split(',')[0]), y: parseInt(key.split(',')[1]) }))
            .filter(item => item.y === y)
            .sort((a, b) => a.x - b.x);

        let lineText = lineChars.map(item => paperData[item.key]).join('');
        
        const textArray = lineText.split('');
        textArray.splice(charIndex, deleteCount, ...textToInsert.split(''));
        lineText = textArray.join('');

        lineChars.forEach(item => delete paperData[item.key]);

        for (let i = 0; i < lineText.length; i++) {
            const char = lineText[i];
            const newKey = `${i * GRID_SIZE},${y}`;
            paperData[newKey] = char;
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
        
        const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter'];
        if (controlKeys.includes(e.key)) {
            e.preventDefault();
            if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE);
            if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE;
            if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE);
            if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE;
            if (e.key === 'Enter') {
                const charIndex = Math.floor(cursorPosition.x / GRID_SIZE);
                operateOnLine(cursorPosition.y, charIndex, 0, '\n'); // Enterは改行文字として扱う
                cursorPosition.y += GRID_SIZE;
                cursorPosition.x = 0;
            }

            // 【修正】Backspace と Delete のロジックを修正
            const charIndex = Math.floor(cursorPosition.x / GRID_SIZE);
            if (e.key === 'Backspace') {
                if (cursorPosition.x > 0 || charIndex > 0) { // 行頭でも前の行と結合するなどの場合は、さらに複雑なロジックが必要だが、まずは行内削除を完璧にする
                    operateOnLine(cursorPosition.y, charIndex - 1, 1, '');
                    cursorPosition.x -= GRID_SIZE;
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
        // 【修正】枠線削除のキーを Backspace と Delete の両方に対応
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const rect = getSelectionRect();
            if (rect) {
                boxes = boxes.filter(box => 
                    !(box.x === rect.x && box.y === rect.y && box.width === rect.width && box.height === rect.height)
                );
            }
            currentMode = 'normal';
            selectionStart = null;
        }
        render();
    }
    
    // 【修正】文字入力のロジックを、汎用関数operateOnLineを呼び出すように統一
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
