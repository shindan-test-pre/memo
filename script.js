document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
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
        container.appendChild(cursorElement);
    }
    
    container.addEventListener('click', (event) => {
        hiddenInput.focus();
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + container.scrollLeft;
        const y = event.clientY - rect.top + container.scrollTop;
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE;
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE;
        render();
    });
    
    // --- イベントリスナーの再構築 ---

    // 1. 日本語入力の「変換中」状態を管理
    hiddenInput.addEventListener('compositionstart', () => {
        isComposing = true;
    });
    hiddenInput.addEventListener('compositionend', () => {
        isComposing = false;
        // inputイベントが直後に発火するので、ここでは何もしない
    });

    // 2. 「文字の書き込み」はすべてこのinputイベントに一本化
    hiddenInput.addEventListener('input', (e) => {
        // 変換途中は処理しない
        if (isComposing) {
            return;
        }

        const text = e.target.value;
        if (text) {
            for (const char of text) {
                const key = `${cursorPosition.x},${cursorPosition.y}`;
                paperData[key] = char;
                cursorPosition.x += GRID_SIZE;
            }
            render();
        }
        // 処理が終わったら入力フィールドをクリア
        e.target.value = '';
    });

    // 3. 「操作」系のキー入力のみを担当
    hiddenInput.addEventListener('keydown', (e) => {
        // 文字入力に関する default ケースを削除し、操作のみを記述
        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'Backspace':
            case 'Delete':
            case 'Enter':
                e.preventDefault(); // ブラウザのデフォルト動作をキャンセル
                const key = `${cursorPosition.x},${cursorPosition.y}`;
                
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
                    delete paperData[key];
                }
                if (e.key === 'Enter') {
                    cursorPosition.y += GRID_SIZE;
                    cursorPosition.x = 0;
                }
                render();
                break;
        }
    });

    // --- 初期化 ---
    hiddenInput.focus();
    render();
});
