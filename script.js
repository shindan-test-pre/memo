// ページの読み込みが完了したら実行
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');

    // コンテナがクリックされた時の処理
    container.addEventListener('click', (event) => {
        // クリックされたのがコンテナ自身（他のテキスト上ではない）の場合のみ実行
        if (event.target.id === 'canvas-container') {
            // 既存の入力エリアがあれば、先にそれを確定させる
            const existingTextarea = document.querySelector('.temp-textarea');
            if (existingTextarea) {
                existingTextarea.blur(); // blurイベントを強制的に発火
                return; // 新しい入力エリアは作らない
            }
            // クリックされた位置に新しい入力エリアを作成
            createTemporaryTextarea(event.pageX, event.pageY);
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

        // テキストエリアからフォーカスが外れたら（入力が終わったら）
        textarea.addEventListener('blur', () => {
            // 入力されたテキストが空でなければ、固定テキストを作成
            if (textarea.value.trim() !== '') {
                createTextElement(textarea.value, x, y);
            }
            // 入力エリア自身は削除する
            container.removeChild(textarea);
        });

        // Enterキーで入力を確定（Shift+Enterで改行）
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // デフォルトの改行を防ぐ
                textarea.blur(); // フォーカスを外して入力を確定させる
            }
        });

        // 作成したテキストエリアをコンテナに追加し、すぐにフォーカスする
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
        // テキスト全体を囲む親コンテナを作成
        const textElement = document.createElement('div');
        textElement.classList.add('text-element');
        textElement.style.left = `${x}px`;
        textElement.style.top = `${y}px`;

        // 入力されたテキストを1文字ずつの配列に分解
        const chars = text.split('');

        // 各文字に対して処理を実行
        chars.forEach(char => {
            if (char === '\n') {
                // もし改行文字なら、改行を表現するための要素を追加
                const br = document.createElement('div');
                br.style.flexBasis = '100%'; // 親要素の幅全体を使って改行させる
                br.style.height = '0';
                textElement.appendChild(br);
            } else {
                // 通常の文字なら、1文字を入れるための箱を作成
                const charBox = document.createElement('div');
                charBox.classList.add('char-box');
                charBox.innerText = char;
                textElement.appendChild(charBox);
            }
        });

        container.appendChild(textElement);
    }
});
