document.addEventListener('DOMContentLoaded', () => {

    // DOM要素の取得
    const container = document.getElementById('canvas-container');
    const svgLayer = document.getElementById('arrow-svg-layer');
    const helpModal = document.getElementById('help-modal');
    const closeHelpModalBtn = document.getElementById('close-help-modal');

    // 隠し入力要素の作成
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.classList.add('hidden-input');
    hiddenInput.setAttribute('autocomplete', 'off');
    hiddenInput.setAttribute('autocorrect', 'off');
    hiddenInput.setAttribute('spellcheck', 'false');
    container.appendChild(hiddenInput);

    // 定数
    const GRID_SIZE = 20;
    const ARROW_DIRECTIONS = { 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right' };
    const LOCAL_STORAGE_KEY = 'simpleMemoAppState';

    // 状態管理
    let paperData = {}; // ★colorDataはここに統合される
    let boxes = [];
    let arrows = [];
    let nextId = 0;
    let cursorPosition = { x: 0, y: 0 };
    let currentMode = 'normal';
    let selectionStart = null;
    let currentArrowPath = [];
    let isComposing = false;
    let compositionText = '';
    const cursorElement = document.createElement('div');
    cursorElement.classList.add('cursor');

    // --- ヘルパー関数群 ---
    function parsePosition(key) { try { const [x, y] = key.split(',').map(Number); if (isNaN(x) || isNaN(y)) return null; return { x, y }; } catch (error) { console.warn('Position parsing error:', error); return null; } }
    function positionToKey(x, y) { return `${x},${y}`; }
    function moveCursor(dx, dy) { cursorPosition.x = Math.max(0, cursorPosition.x + dx); cursorPosition.y = Math.max(0, cursorPosition.y + dy); }
    function createArrowMarker() { const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker'); marker.id = 'arrowhead'; marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '8'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5'); marker.setAttribute('orient', 'auto-start-reverse'); const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path'); pathEl.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); pathEl.setAttribute('fill', '#333'); marker.appendChild(pathEl); defs.appendChild(marker); return defs; }

    // 【★修正★】文字オブジェクトを受け取るように変更
    function createCharCell(charObject, x, y, isComposingChar = false) {
        const charCell = document.createElement('div');
        charCell.className = 'char-cell';
        if (isComposingChar) {
            charCell.classList.add('composing-char');
        }
        const color = charObject.color;
        if (color) {
            charCell.classList.add(`text-${color}`);
        }
        const char = charObject.char;
        charCell.style.left = `${x}px`;
        charCell.style.top = `${y}px`;
        charCell.innerText = char === '\n' ? '' : char;
        container.appendChild(charCell);
    }
    function getSelectionRect() { if (!selectionStart) return null; const x1 = Math.min(selectionStart.x, cursorPosition.x); const y1 = Math.min(selectionStart.y, cursorPosition.y); const x2 = Math.max(selectionStart.x, cursorPosition.x); const y2 = Math.max(selectionStart.y, cursorPosition.y); return { x: x1, y: y1, width: x2 - x1 + GRID_SIZE, height: y2 - y1 + GRID_SIZE }; }

    // 【★修正★】文字オブジェクトを作成して保存するように変更
    function insertChar(char) {
        const currentKey = positionToKey(cursorPosition.x, cursorPosition.y);
        const currentY = cursorPosition.y;
        const charsToShift = Object.keys(paperData).map(key => parsePosition(key)).filter(item => item && item.y === currentY && item.x >= cursorPosition.x).sort((a, b) => b.x - a.x);
        charsToShift.forEach(item => {
            const oldKey = positionToKey(item.x, item.y);
            const newKey = positionToKey(item.x + GRID_SIZE, item.y);
            paperData[newKey] = paperData[oldKey];
            delete paperData[oldKey];
        });
        paperData[currentKey] = { char: char, color: null }; // デフォルトは色なし
        moveCursor(GRID_SIZE, 0);
    }
    function deleteCharBackward() { if (cursorPosition.x === 0) return; moveCursor(-GRID_SIZE, 0); deleteCharForward(); }
    function deleteCharForward() { const currentKey = positionToKey(cursorPosition.x, cursorPosition.y); const currentY = cursorPosition.y; delete paperData[currentKey]; const charsToShift = Object.keys(paperData).map(key => parsePosition(key)).filter(item => item && item.y === currentY && item.x > cursorPosition.x).sort((a, b) => a.x - b.x); charsToShift.forEach(item => { const oldKey = positionToKey(item.x, item.y); const newKey = positionToKey(item.x - GRID_SIZE, item.y); paperData[newKey] = paperData[oldKey]; delete paperData[oldKey]; }); }
    function updateCanvasSize() { const buffer = 300; let maxX = 0; let maxY = 0; const allPositions = [ ...Object.keys(paperData).map(parsePosition), ...boxes.flatMap(b => [{x: b.x + b.width, y: b.y + b.height}]), ...arrows.flatMap(a => a.path) ].filter(p => p); allPositions.forEach(p => { if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }); const newWidth = maxX + buffer; const newHeight = maxY + buffer; const minWidth = container.parentNode.clientWidth; const minHeight = container.parentNode.clientHeight; container.style.width = `${Math.max(minWidth, newWidth)}px`; container.style.height = `${Math.max(minHeight, newHeight)}px`; svgLayer.setAttribute('width', container.scrollWidth); svgLayer.setAttribute('height', container.scrollHeight); }

    /** メモ全体をリセットする関数 */
    function resetMemo() {
        if (confirm('すべてのメモ内容が消去され、元に戻せません。\n本当によろしいですか？')) {
            paperData = {};
            // colorDataは不要に
            boxes = [];
            arrows = [];
            nextId = 0;
            cursorPosition = { x: 0, y: 0 };
            currentMode = 'normal';
            selectionStart = null;
            currentArrowPath = [];
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            render();
            console.log("メモがリセットされました。");
        } else {
            console.log("リセットがキャンセルされました。");
        }
    }

    /** PDF書き出し（印刷プレビュー）を呼び出す関数 */
    function exportToPdf() { window.print(); }
    /** ヘルプモーダルを開く関数 */
    function openHelpModal() { currentMode = 'modal'; helpModal.classList.add('is-visible'); helpModal.setAttribute('aria-hidden', 'false'); }
    /** ヘルプモーダルを閉じる関数 */
    function closeHelpModal() { currentMode = 'normal'; helpModal.classList.remove('is-visible'); helpModal.setAttribute('aria-hidden', 'true'); hiddenInput.focus(); }
            
    /** メイン描画関数 */
    function render() {
        const elementsToRemove = container.querySelectorAll('.char-cell, .cursor, .selection-highlight, .border-box');
        elementsToRemove.forEach(el => el.remove());
        svgLayer.innerHTML = '';
        svgLayer.appendChild(createArrowMarker());
        const drawArrowPath = (path, isPreview = false) => {
            if (path.length < 2) return;
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            const points = path.map(p => `${p.x + GRID_SIZE / 2},${p.y + GRID_SIZE / 2}`).join(' ');
            polyline.setAttribute('points', points);
            polyline.setAttribute('class', 'arrow-line');
            polyline.setAttribute('fill', 'none');
            if (isPreview) { polyline.style.opacity = '0.5'; } else { polyline.setAttribute('marker-end', 'url(#arrowhead)'); }
            svgLayer.appendChild(polyline);
        };
        arrows.forEach(arrow => drawArrowPath(arrow.path));
        if (currentMode === 'arrow') drawArrowPath(currentArrowPath, true);
        boxes.forEach(box => { const boxEl = document.createElement('div'); boxEl.classList.add('border-box'); boxEl.style.left = `${box.x}px`; boxEl.style.top = `${box.y}px`; boxEl.style.width = `${box.width}px`; boxEl.style.height = `${box.height}px`; container.appendChild(boxEl); });

        // 【★修正★】paperData[key]がオブジェクトであることを前提にcreateCharCellを呼ぶ
        Object.keys(paperData).forEach(key => { const pos = parsePosition(key); if (pos) createCharCell(paperData[key], pos.x, pos.y); });
        if (currentMode === 'visual' && selectionStart) { const rect = getSelectionRect(); if (rect) { const highlightEl = document.createElement('div'); highlightEl.classList.add('selection-highlight'); highlightEl.style.left = `${rect.x}px`; highlightEl.style.top = `${rect.y}px`; highlightEl.style.width = `${rect.width}px`; highlightEl.style.height = `${rect.height}px`; container.appendChild(highlightEl); } }
        if (isComposing && compositionText) { let tempX = cursorPosition.x; for (const char of compositionText) { createCharCell({ char: char, color: null }, tempX, cursorPosition.y, true); tempX += GRID_SIZE; } }
        const cursorX = cursorPosition.x + (isComposing ? compositionText.length * GRID_SIZE : 0);
        cursorElement.style.left = `${cursorX}px`;
        cursorElement.style.top = `${cursorPosition.y}px`;
        container.appendChild(cursorElement);
        hiddenInput.style.left = `${cursorX}px`;
        hiddenInput.style.top = `${cursorPosition.y}px`;
        if (currentMode === 'normal') { hiddenInput.focus({ preventScroll: true }); } else { container.focus({ preventScroll: true }); }
        updateCanvasSize();
    }

    // --- データ保存・読み込み関連 ---

    // 【★修正★】colorDataを削除
    function serializeState() { return JSON.stringify({ paperData, boxes, arrows, nextId }); }
    function deserializeState(jsonString) { 
        try { 
            const state = JSON.parse(jsonString);
            if (state && typeof state.paperData === 'object' && Array.isArray(state.boxes) && Array.isArray(state.arrows)) {
                paperData = state.paperData;
                boxes = state.boxes; 
                arrows = state.arrows; 
                nextId = state.nextId || 0;

                // 【★追加★】古いデータ形式との互換性を保つための処理
                for (const key in paperData) {
                    if (typeof paperData[key] === 'string') {
                        const char = paperData[key];
                        paperData[key] = { char: char, color: null };
                        // 昔のcolorDataも存在すれば、そこから色情報を復元する
                        if (state.colorData && state.colorData[key]) {
                            paperData[key].color = state.colorData[key];
                        }
                    }
                }
                return true; 
            } else { alert('無効なファイル形式です。'); return false; } 
        } catch (error) { alert('ファイルの読み込みに失敗しました。'); console.error("Failed to parse state:", error); return false; } 
    }
    function saveToLocalStorage() { try { localStorage.setItem(LOCAL_STORAGE_KEY, serializeState()); } catch (error) { console.error("Failed to save to localStorage:", error); } }
    function loadFromLocalStorage() { const stateJson = localStorage.getItem(LOCAL_STORAGE_KEY); if (stateJson) { return deserializeState(stateJson); } return false; }
    function exportToFile() { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0'); const defaultFileName = `memo-${year}-${month}-${day}.json`; const fileNameInput = prompt("ファイル名を入力して保存してください:", defaultFileName); if (fileNameInput === null) { console.log("保存がキャンセルされました。"); return; } let finalFileName = fileNameInput.trim(); if (finalFileName === "") { finalFileName = defaultFileName; } if (!finalFileName.toLowerCase().endsWith('.json')) { finalFileName += '.json'; } const stateJson = serializeState(); const blob = new Blob([stateJson], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = finalFileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
    function importFromFile() { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = (event) => { const file = event.target.files[0]; if (!file) return; if (!confirm('現在の内容は上書きされます。よろしいですか？')) return; const reader = new FileReader(); reader.onload = (e) => { if (deserializeState(e.target.result)) { render(); } }; reader.readAsText(file); }; input.click(); }

    // --- キーボードイベントハンドラ ---
    function handleNormalModeKeys(e) {
        if ((e.key === 'e' || e.key === 'l') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const scrollX = window.scrollX;
            const scrollY = window.scrollY;
            if (e.key === 'e') { currentMode = 'visual'; selectionStart = { ...cursorPosition }; } 
            else if (e.key === 'l') { currentMode = 'arrow'; currentArrowPath = [{...cursorPosition}]; }
            render();
            window.scrollTo(scrollX, scrollY);
        } else {
            const controlKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter'];
            if (controlKeys.includes(e.key)) {
                e.preventDefault();
                switch (e.key) {
                    case 'ArrowUp': moveCursor(0, -GRID_SIZE); break;
                    case 'ArrowDown': moveCursor(0, GRID_SIZE); break;
                    case 'ArrowLeft': moveCursor(-GRID_SIZE, 0); break;
                    case 'ArrowRight': moveCursor(GRID_SIZE, 0); break;
                    case 'Enter': cursorPosition.y += GRID_SIZE; cursorPosition.x = 0; break;
                    case 'Backspace': deleteCharBackward(); break;
                    case 'Delete': deleteCharForward(); break;
                }
                render();
                saveToLocalStorage();
            }
        }
    }

// handleVisualModeKeys 関数を丸ごと置き換え
function handleVisualModeKeys(e) {
    e.preventDefault();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const colorKeys = { 'KeyR': 'red', 'KeyG': 'green', 'KeyB': 'blue' };
    const returnToNormal = () => { currentMode = 'normal'; selectionStart = null; saveToLocalStorage(); };

    if (e.key === 'Escape') { 
        returnToNormal();
    } else if (e.key === 'Enter') {
        const rect = getSelectionRect();
        if (rect) { boxes.push({ id: `box${nextId++}`, ...rect }); }
        returnToNormal();
    } else if (colorKeys[e.code] || e.code === 'KeyD') {
        const rect = getSelectionRect();
        if (rect) {
            for (let y = rect.y; y < rect.y + rect.height; y += GRID_SIZE) {
                for (let x = rect.x; x < rect.x + rect.width; x += GRID_SIZE) {
                    const key = positionToKey(x, y);
                    if (paperData[key]) {
                        if (e.code === 'KeyD') {
                            paperData[key].color = null;
                        } else {
                            paperData[key].color = colorKeys[e.code];
                        }
                    }
                }
            }
        }
        returnToNormal();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const rect = getSelectionRect();
        if (rect) {
            boxes = boxes.filter(box => !(box.x >= rect.x && box.y >= rect.y && (box.x + box.width) <= (rect.x + rect.width) && (box.y + box.height) <= (rect.y + rect.height)));
            arrows = arrows.filter(arrow => !arrow.path.some(p => p.x >= rect.x && p.x < rect.x + rect.width && p.y >= rect.y && p.y < rect.y + rect.height));
        }
        returnToNormal();
    } else if (ARROW_DIRECTIONS[e.key]) { 
        switch (e.key) {
            case 'ArrowUp': moveCursor(0, -GRID_SIZE); break;
            case 'ArrowDown': moveCursor(0, GRID_SIZE); break;
            case 'ArrowLeft': moveCursor(-GRID_SIZE, 0); break;
            case 'ArrowRight': moveCursor(GRID_SIZE, 0); break;
        }
    }
    render();
    // ★追加：記憶した位置にスクロールを強制的に戻す
    // ただし、矢印キーで範囲選択している最中はスクロールを戻さない
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
        window.scrollTo(scrollX, scrollY);
    }
}
    function handleArrowModeKeys(e) {
        e.preventDefault();
        const lastPoint = currentArrowPath[currentArrowPath.length - 1];
        if (!lastPoint) { currentMode = 'normal'; render(); return; }
        if (ARROW_DIRECTIONS[e.key]) {
            let nextPoint = { ...lastPoint };
            switch (e.key) {
                case 'ArrowUp': if (lastPoint.y > 0) nextPoint.y -= GRID_SIZE; break;
                case 'ArrowDown': nextPoint.y += GRID_SIZE; break;
                case 'ArrowLeft': if (lastPoint.x > 0) nextPoint.x -= GRID_SIZE; break;
                case 'ArrowRight': nextPoint.x += GRID_SIZE; break;
            }
            if (nextPoint.x !== lastPoint.x || nextPoint.y !== lastPoint.y) {
                currentArrowPath.push(nextPoint);
                cursorPosition.x = nextPoint.x;
                cursorPosition.y = nextPoint.y;
            }
        } else if (e.key === 'Enter') {
            if (currentArrowPath.length > 1) {
                arrows.push({ id: `arrow${nextId++}`, path: currentArrowPath });
                saveToLocalStorage();
            }
            currentMode = 'normal';
            currentArrowPath = [];
        } else if (e.key === 'Escape') {
            currentMode = 'normal';
            currentArrowPath = [];
        }
        render();
    }
    function handleTextInput(text) {
        if (currentMode !== 'normal') return; 
        if (text) {
            for (const char of text) { insertChar(char); }
            render();
            saveToLocalStorage();
        }
    }

    // --- イベントリスナー群 ---
    window.addEventListener('keydown', (e) => {
        if (currentMode === 'modal') {
            if (e.key === 'Escape') { closeHelpModal(); }
            return;
        }
        if ((e.ctrlKey || e.metaKey)) {
            if (e.key === 's' || e.key === 'o') { e.preventDefault(); if (e.key === 's') exportToFile(); if (e.key === 'o') importFromFile(); }
            if (e.shiftKey && e.key === 'Backspace') { e.preventDefault(); resetMemo(); }
            if (e.key === '/') { e.preventDefault(); openHelpModal(); }
            if (e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); exportToPdf(); }
        }
    });

    // テキスト入力関連のイベントは hiddenInput で処理
    hiddenInput.addEventListener('keydown', (e) => {
        if (isComposing || currentMode !== 'normal') return;
        handleNormalModeKeys(e);
    });
    hiddenInput.addEventListener('compositionstart', () => { isComposing = true; compositionText = ''; });
    hiddenInput.addEventListener('compositionupdate', (e) => { compositionText = e.data || ''; render(); });
    hiddenInput.addEventListener('compositionend', (e) => { isComposing = false; compositionText = ''; handleTextInput(e.data || ''); e.target.value = ''; });
    hiddenInput.addEventListener('input', (e) => { if (isComposing) return; handleTextInput(e.target.value); e.target.value = ''; });

    // コマンド系のイベントは container で処理
    container.addEventListener('keydown', (e) => {
        if (currentMode === 'visual') {
            handleVisualModeKeys(e);
        } else if (currentMode === 'arrow') {
            handleArrowModeKeys(e);
        }
    });

    // クリックイベント
    container.addEventListener('click', (event) => { 
        const rect = container.getBoundingClientRect(); 
        const x = event.clientX - rect.left + container.scrollLeft; 
        const y = event.clientY - rect.top + container.scrollTop; 
        cursorPosition.x = Math.floor(x / GRID_SIZE) * GRID_SIZE; 
        cursorPosition.y = Math.floor(y / GRID_SIZE) * GRID_SIZE; 
        if (currentMode !== 'normal') {
            currentMode = 'normal';
            selectionStart = null;
            currentArrowPath = [];
        }
        render(); 
    });
    closeHelpModalBtn.addEventListener('click', closeHelpModal);
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) { closeHelpModal(); }
    });
    
    // --- 初期化 ---
    loadFromLocalStorage();
    render();
    window.scrollTo(0, 0);
});
