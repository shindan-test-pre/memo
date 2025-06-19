document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    container.appendChild(hiddenInput);

    const GRID_SIZE = 20;

    // --- 状態管理 ---
    let paperData = {}; // 確定した文字データ
    let cursorPosition = { x: 0, y: 0 };
    let isComposing = false; // 変換中かどうかのフラグ
    let compositionText = ''; // 変換中の文字列データ

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    function render() {
        // 1. 描画内容を一旦クリア
        const elementsToRemove = container.querySelectorAll('.char-cell, .cursor');
        elementsToRemove.forEach(el => el.remove());

        // 2. 確定済みの文字を描画
        for (const key in paperData) {
            const [x, y] = key.split(',').map(Number);
            createCharCell(paperData[key], x, y);
        }

        // 3. 【NEW】変換中の文字を描画
        if (isComposing && compositionText) {
            let tempX = cursorPosition.x;
            for (const char of compositionText) {
                createCharCell(char, tempX, cursorPosition.y, true); // isComposingフラグを渡す
                tempX += GRID_SIZE;
            }
        }
        
        // 4. カーソルを描画
        // 変換中は、変換中文字列の末尾にカーソルを置く
        const cursorX = cursorPosition.x + (isComposing ? compositionText.length * GRID_SIZE : 0);
        cursorElement.style.left = `${cursorX}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);

        // 5. 見えない入力欄の位置を更新し、フォーカスを維持
        hiddenInput.style.left = `${cursorX}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        hiddenInput.focus();
    }

    // 文字セルを生成するヘルパー関数
    function createCharCell(char, x, y, isComposingChar = false) {
        const charCell = document.createElement('div');
        charCell.classList.add('char-cell');
        if (isComposingChar) {
            charCell.classList.add('composing-char');
        }
        charCell.style.left = `${x}px`;
        charCell.style.top = `${y}px`;
        charCell.innerText = char;
        container.appendChild(charCell);
    }
    
    // 確定したテキストをデータに書き込む関数
    function typeText(text) {
        if (text) {
            for (const char of text) {
                const key = `${cursorPosition.x},${cursorPosition.y}`;
                paperData[key] = char;
                cursorPosition.x += GRID_SIZE;
            }
        }
    }
    
    container.addEventListener('click', (event) => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + container.scrollLeft;
        const y = event.clientY - rect.top + container.scrollTop;
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE;
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE;
        render();
    });
    
    // --- イベントリスナーの最終構成 ---

    hiddenInput.addEventListener('compositionstart', () => {
        isComposing = true;
        compositionText = '';
    });
    
    // 【NEW】変換の途中経過をリアルタイムで取得
    hiddenInput.addEventListener('compositionupdate', (e) => {
        compositionText = e.data;
        render();
    });

    hiddenInput.addEventListener('compositionend', (e) => {
        isComposing = false;
        compositionText = '';
        typeText(e.data);
        render();
        hiddenInput.value = '';
    });

    hiddenInput.addEventListener('input', (e) => {
        if (isComposing) return;
        typeText(e.target.value);
        render();
        e.target.value = '';
    });

    hiddenInput.addEventListener('keydown', (e) => {
        if (isComposing) return; // 変換中は操作キーを無効化

        const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter'];
        if (controlKeys.includes(e.key)) {
            e.preventDefault();
            
            if (e.key === 'ArrowUp') cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE);
            if (e.key === 'ArrowDown') cursorPosition.y += GRID_SIZE;
            if (e.key === 'ArrowLeft') cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE);
            if (e.key === 'ArrowRight') cursorPosition.x += GRID_SIZE;
            if (e.key === 'Backspace') {
                if (cursorPosition.x > 0) {
                    cursorPosition.x -= GRID_SIZE;
                    const keyToDelete = `${cursorPosition.x},${cursorPosition.y}`;
                    delete paperData[keyToDelete];
                }
            }
            if (e.key === 'Delete') {
                const key = `${cursorPosition.x},${cursorPosition.y}`;
                delete paperData[key];
            }
            if (e.key === 'Enter') {
                cursorPosition.y += GRID_SIZE;
                cursorPosition.x = 0;
            }
            render();
        }
    });

    render();
});
