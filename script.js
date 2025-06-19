document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('canvas-container');
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    // 初期位置を設定しておく
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
        
        // カーソルと入力欄の位置を更新
        cursorElement.style.left = `${cursorPosition.x}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        hiddenInput.style.left = `${cursorPosition.x}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        
        container.appendChild(cursorElement);
        
        // フォーカスを当てる（入力の受付準備）
        hiddenInput.focus();
    }
    
    container.addEventListener('click', (event) => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + container.scrollLeft;
        const y = event.clientY - rect.top + container.scrollTop;
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE;
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE;
        render();
    });
    
    hiddenInput.addEventListener('compositionstart', () => {
        isComposing = true;
    });
    hiddenInput.addEventListener('compositionend', () => {
        isComposing = false;
        // inputイベントハンドラに処理を任せるため、ここでは何もしない
    });

    hiddenInput.addEventListener('input', (e) => {
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
        e.target.value = '';
    });

    hiddenInput.addEventListener('keydown', (e) => {
        if (isComposing) return;

        const controlKeys = [
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'Backspace', 'Delete', 'Enter'
        ];

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
