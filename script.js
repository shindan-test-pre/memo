document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    container.appendChild(hiddenInput);

    const GRID_SIZE = 20;

    // データ：アプリの唯一の信頼できる情報源
    let paperData = {};
    let cursorPosition = { x: 0, y: 0 };
    let isComposing = false; // 日本語入力中かどうかの状態を管理するフラグ

    // --- 描画関連 ---
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
    
    // --- イベントハンドラ ---

    // クリック時の処理
    container.addEventListener('click', (event) => {
        hiddenInput.focus();
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + container.scrollLeft;
        const y = event.clientY - rect.top + container.scrollTop;
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE;
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE;
        render();
    });

    // --- 日本語入力対応 ---
    hiddenInput.addEventListener('compositionstart', () => {
        isComposing = true; // 変換開始
    });

    hiddenInput.addEventListener('compositionend', (e) => {
        isComposing = false; // 変換終了
        const text = e.data; // 確定した文字列を取得
        if (text) {
            // 確定した文字列を1文字ずつ書き込む
            for (const char of text) {
                const key = `${cursorPosition.x},${cursorPosition.y}`;
                paperData[key] = char;
                cursorPosition.x += GRID_SIZE; // 1文字書くごとにカーソルを右へ
            }
            render();
        }
    });


    // キー入力時の処理
    hiddenInput.addEventListener('keydown', (e) => {
        // 日本語入力中は、制御キー以外のキー入力を無視する
        if (isComposing) {
            // ただし、変換を確定するEnterキーなどは通す必要があるため、ここでは何もしない
            // compositionendイベントで処理されるのを待つ
            return;
        }

        e.preventDefault(); 
        const key = `${cursorPosition.x},${cursorPosition.y}`;

        switch (e.key) {
            case 'ArrowUp':
                cursorPosition.y = Math.max(0, cursorPosition.y - GRID_SIZE);
                break;
            case 'ArrowDown':
                cursorPosition.y += GRID_SIZE;
                break;
            case 'ArrowLeft':
                cursorPosition.x = Math.max(0, cursorPosition.x - GRID_SIZE);
                break;
            case 'ArrowRight':
                cursorPosition.x += GRID_SIZE;
                break;
            case 'Backspace':
                if (cursorPosition.x > 0) {
                    cursorPosition.x -= GRID_SIZE;
                    const keyToDelete = `${cursorPosition.x},${cursorPosition.y}`;
                    delete paperData[keyToDelete];
                }
                break;
            case 'Delete':
                delete paperData[key];
                break;
            case 'Enter':
                cursorPosition.y += GRID_SIZE;
                cursorPosition.x = 0;
                break;
            default:
                // 半角英数字などの直接入力
                if (e.key.length === 1) {
                    paperData[key] = e.key;
                    cursorPosition.x += GRID_SIZE;
                }
                break;
        }
        render();
    });

    // --- 初期化 ---
    hiddenInput.focus();
    render();
});
