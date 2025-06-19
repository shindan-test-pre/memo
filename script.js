// script.js (最終版)

// ページの読み込みが完了したら実行
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const GRID_SIZE = 20; // 方眼のサイズを定数で管理

    // コンテナがクリックされた時の処理
    container.addEventListener('click', (event) => {
        // クリックされたのがコンテナ自身（他のテキスト上ではない）の場合のみ実行
        if (event.target.id === 'canvas-container') {
            const existingTextarea = document.querySelector('.temp-textarea');
            if (existingTextarea) {
                existingTextarea.blur(); // blurイベントを強制的に発火
                return; // 新しい入力エリアは作らない
            }
            
            //【新しい正確な座標計算】
            // 1. 方眼紙エリアの画面上の絶対位置とサイズを取得
            const rect = container.getBoundingClientRect();

            // 2. クリックされた位置から、方眼紙エリアの左上の位置を引く
            //    container.scrollLeft/Top を足すことで、コンテナ内のスクロール量も考慮する
            const x = event.clientX - rect.left + container.scrollLeft;
            const y = event.clientY - rect.top + container.scrollTop;

            // 3. 算出した相対座標を、最も近いグリッドにスナップさせる
            const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
            const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;

            // スナップされた座標を使って新しい入力エリアを作成
            createTemporaryTextarea(snappedX, snappedY);
        }
    });

    /**
     * 指定した位置に一時的なテキスト入力エリアを作成する関数
     * @param {number} x - 画面の左からの位置 (px)
     * @param {number} y - 画面の上からの位置 (px)
     */
    function createTemporaryTextarea(x, y) {
        const textarea = document.createElement('textarea');
        textarea.classList.add('temp-textarea');
        textarea.style.left = `${x}px`;
        textarea.style.top = `${y}px`;

        textarea.addEventListener('blur', () => {
            if (textarea.value.trim() !== '') {
                createTextElement(textarea.value, x, y);
            }
            container.removeChild(textarea);
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textarea.blur();
            }
        });
        
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
            textarea.style.width = 'auto';
            textarea.style.width = `${textarea.scrollWidth}px`;
        });

        container.appendChild(textarea);
        textarea.focus();
    }

    /**
     * 入力が確定したテキストを1文字ずつ分解し、マス目に配置する関数
     * @param {string} text - 入力された文字列
     * @param {number} x - 画面の左からの位置 (px)
     * @param {number} y - 画面の上からの位置 (px)
     */
    function createTextElement(text, x, y) {
        const textElement = document.createElement('div');
        textElement.classList.add('text-element');
        textElement.style.left = `${x}px`;
        textElement.style.top = `${y}px`;

        const chars = text.split('');

        chars.forEach(char => {
            if (char === '\n') {
                const br = document.createElement('div');
                br.style.flexBasis = '100%';
                br.style.height = '0';
                textElement.appendChild(br);
            } else {
                const charBox = document.createElement('div');
                charBox.classList.add('char-box');
                charBox.innerText = char;
                textElement.appendChild(charBox);
            }
        });

        container.appendChild(textElement);
    }
});
