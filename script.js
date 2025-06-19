document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    container.appendChild(hiddenInput);

    const GRID_SIZE = 20;

    // データ：アプリの唯一の信頼できる情報源 (Single Source of Truth)
    let paperData = {}; // 例: { "20,40": "A" }
    let cursorPosition = { x: 0, y: 0 };

    // --- 描画関連 ---
    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    function render() {
        // 1. コンテナを一旦クリア（カーソルと非表示inputを除く）
        while (container.firstChild && container.firstChild !== hiddenInput) {
            container.removeChild(container.firstChild);
        }

        // 2. paperDataに基づいて文字を再描画
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

        // 3. カーソルを再描画
        cursorElement.style.left = `${cursorPosition.x}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);
    }
    
    // --- イベントハンドラ ---

    // クリック時の処理
    container.addEventListener('click', (event) => {
        // キーボード入力を受け付けるために非表示のinputにフォーカスを当てる
        hiddenInput.focus();

        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + container.scrollLeft;
        const y = event.clientY - rect.top + container.scrollTop;
        
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE;
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE;
        
        render();
    });

    // キー入力時の処理
    hiddenInput.addEventListener('keydown', (e) => {
        e.preventDefault(); // ブラウザのデフォルト動作をキャンセル
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
                // カーソルの左の文字を消す（カーソルが左端でなければ）
                if (cursorPosition.x > 0) {
                    cursorPosition.x -= GRID_SIZE;
                    const keyToDelete = `${cursorPosition.x},${cursorPosition.y}`;
                    delete paperData[keyToDelete];
                }
                break;
            case 'Delete':
                // カーソル位置の文字を消す
                delete paperData[key];
                break;
            case 'Enter':
                 // カーソルを次の行の先頭に移動
                cursorPosition.y += GRID_SIZE;
                cursorPosition.x = 0;
                break;
            default:
                // 通常の文字入力（1文字の場合のみ）
                if (e.key.length === 1) {
                    paperData[key] = e.key;
                    cursorPosition.x += GRID_SIZE; // 入力後、カーソルを右に移動
                }
                break;
        }
        render(); // どんな操作後も必ず再描画
    });

    // --- 初期化 ---
    hiddenInput.focus(); // 初期状態でフォーカス
    render(); // アプリケーションの初回描画
});
