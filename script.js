document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const GRID_SIZE = 20;

    // 新規作成：何もない場所をクリックした時の処理
    container.addEventListener('click', (event) => {
        if (event.target.id === 'canvas-container') {
            const existingTextarea = document.querySelector('.temp-textarea');
            if (existingTextarea) {
                existingTextarea.blur();
                return;
            }
            const rect = container.getBoundingClientRect();
            const x = event.clientX - rect.left + container.scrollLeft;
            const y = event.clientY - rect.top + container.scrollTop;
            const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
            const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;
            createTemporaryTextarea(snappedX, snappedY);
        }
    });

    /**
     * テキスト入力エリアを作成する（新規・編集兼用）
     * @param {number} x - 位置(left)
     * @param {number} y - 位置(top)
     * @param {string} [initialValue=''] - 初期値（編集時に使用）
     */
    function createTemporaryTextarea(x, y, initialValue = '') {
        const textarea = document.createElement('textarea');
        textarea.classList.add('temp-textarea');
        textarea.value = initialValue;
        textarea.style.left = `${x}px`;
        textarea.style.top = `${y}px`;
        
        // 【UI改善】背景の方眼がズレないように位置を調整
        textarea.style.backgroundPosition = `-${x % GRID_SIZE}px -${y % GRID_SIZE}px`;

        const onBlur = () => {
            if (textarea.value.trim() !== '') {
                createTextElement(textarea.value, x, y);
            }
            // 親要素からtextareaを削除（存在確認も行う）
            if (textarea.parentElement) {
                textarea.parentElement.removeChild(textarea);
            }
        };
        textarea.addEventListener('blur', onBlur);

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textarea.blur();
            }
        });
        
        const adjustTextareaSize = () => {
            textarea.style.height = 'auto';
            textarea.style.width = 'auto';
            // 最低でもGRID_SIZE分の幅と高さを確保
            textarea.style.height = `${Math.max(textarea.scrollHeight, GRID_SIZE)}px`;
            textarea.style.width = `${Math.max(textarea.scrollWidth, GRID_SIZE)}px`;
        };
        textarea.addEventListener('input', adjustTextareaSize);

        container.appendChild(textarea);
        textarea.focus();
        // 初期値がある場合、初期表示のサイズを調整
        if (initialValue) {
            adjustTextareaSize();
        }
    }

    /**
     * 確定したテキストブロックを画面に配置する
     */
    function createTextElement(text, x, y) {
        const textElement = document.createElement('div');
        textElement.classList.add('text-element');
        textElement.style.left = `${x}px`;
        textElement.style.top = `${y}px`;

        // テキスト内容を保持させておく（編集時に利用）
        textElement.dataset.text = text;

        const chars = text.split('');
        chars.forEach(char => {
            const charBox = document.createElement('div');
            charBox.classList.add('char-box');
            if (char === '\n') {
                charBox.style.flexBasis = '100%';
                charBox.style.height = '0';
            } else {
                charBox.innerText = char;
            }
            textElement.appendChild(charBox);
        });

        // 【編集機能】ダブルクリックで編集モードに入る
        textElement.addEventListener('dblclick', (e) => {
            e.stopPropagation(); // 親コンテナへのイベント伝播を停止
            enterEditMode(textElement);
        });

        container.appendChild(textElement);
    }

    /**
     * 編集モードを開始する
     * @param {HTMLElement} textElement - 編集対象のテキストブロック
     */
    function enterEditMode(textElement) {
        const text = textElement.dataset.text;
        const x = parseInt(textElement.style.left, 10);
        const y = parseInt(textElement.style.top, 10);

        // 元のテキストブロックを削除
        textElement.parentElement.removeChild(textElement);
        // 同じ場所に同じ内容で入力エリアを作成
        createTemporaryTextarea(x, y, text);
    }
});
