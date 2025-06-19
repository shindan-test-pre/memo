document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    hiddenInput.style.left = '0px';
    hiddenInput.style.top = '0px';
    container.appendChild(hiddenInput);

    const GRID_SIZE = 20;

    let paperData = {};
    let cursorPosition = { x: 0, y: 0 };
    let isComposing = false;

    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    function render() {
        while (container.firstChild && container.firstChild !== hiddenInput) {
            container.removeChild(container.firstChild);
        }
        for (const key in paperData) {
            const [x, y] = key.split(',').map(Number);
            const char = paperData[key];
            const charCell = document.createElement('div');
            charCell.classList.add('char-cell');
            charCell.style.left = `${x}px`;
            charCell.style.top = `${y}px`;
            charCell.innerText = char;
            container.appendChild(charCell);
        }
        cursorElement.style.left = `${cursorPosition.x}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        hiddenInput.style.left = `${cursorPosition.x}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);
        hiddenInput.focus();
    }

    function typeText(text) {
        if (text) {
            for (const char of text) {
                const key = `${cursorPosition.x},${cursorPosition.y}`;
                paperData[key] = char;
                cursorPosition.x += GRID_SIZE;
            }
            render();
        }
    }
    
    container.addEventListener('click', () => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + container.scrollLeft;
        const y = event.clientY - rect.top + container.scrollTop;
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE;
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE;
        render();
    });
    
    // --- イベントリスナーの最終構成 ---

    // 1. 日本語入力の「変換中」フラグを管理
    hiddenInput.addEventListener('compositionstart', () => {
        isComposing = true;
    });

    // 2. 日本語入力の「確定」を専門に担当
    hiddenInput.addEventListener('compositionend', (e) => {
        isComposing = false;
        // 確定した文字列（e.data）で文字入力処理を呼び出す
        typeText(e.data);
        // `input`イベントでの二重処理を防ぐため、値をクリア
        e.target.value = '';
    });

    // 3. 半角英数などの「直接入力」を専門に担当
    hiddenInput.addEventListener('input', (e) => {
        // 変換中はなにもしない
        if (isComposing) {
            return;
        }
        // `compositionend`で処理済みの場合は、valueがクリアされているので、
        // このハンドラは実質的に半角文字入力の場合のみ動作する
        typeText(e.target.value);
        e.target.value = '';
    });

    // 4. キーボードでの「操作」を担当
    hiddenInput.addEventListener('keydown', (e) => {
        if (isComposing) return;

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
