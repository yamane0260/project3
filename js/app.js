// アプリケーションの状態
const AppState = {
    currentSection: 'home',
    art: {
        flowerColor: null,
        placement: null,
        softInsert: false,
        angleDeg: 0
    },
    ikebana: {
        items: [], // { id, src, x, y, rotation, role }
        selectedId: null,
        nextId: 1,
        dragging: { id: null, offsetX: 0, offsetY: 0 }
    },
    tech: {
        lightColor: null, // 'red' | 'blue' | 'yellow'
        angleDeg: 0,
        fixed: false,
        isPlaying: false
    },
    science: {
        red: 0,
        blue: 0,
        green: 0
    },
    techSeven: {
        nextWireId: 1,
        orientation: 'h',
        stock: 7,
        selectedWireId: null,
        wires: [] // { id, segKey: 'a'|'b'|..., orient: 'h'|'v' }
    },
    timers: {
        hint: null,
        idle: null
    },
    history: { past: [], future: [] }
};

// 画像ごとの「根元アンカー」設定と初期角度のプリセット
// anchorX/anchorY は [0,1] の割合（要素内のどの位置を根元とみなすか）
// rotate は初期のわずかな傾き（見栄え調整）
const ASSET_ANCHORS = {
    'assets/flowerBlue.png': { anchorX: 0.50, anchorY: 0.98, rotate: -4 },
    'assets/flowerYellow.png': { anchorX: 0.52, anchorY: 0.98, rotate: 0 },
    'assets/flowerRed.png':    { anchorX: 0.48, anchorY: 0.98, rotate: 3 },
    'assets/flowerPink.png':   { anchorX: 0.50, anchorY: 0.98, rotate: -2 },
    'assets/ikebana_branch_tall_1.png': { anchorX: 0.15, anchorY: 1.00, rotate: -8 },
    'assets/ikebana_branch_tall_2.png': { anchorX: 0.85, anchorY: 1.00, rotate: 8 },
    'assets/ikebana_flower_wide_1.png': { anchorX: 0.50, anchorY: 1.00, rotate: 0 },
    'assets/ikebana_flower_wide_2.png': { anchorX: 0.50, anchorY: 1.00, rotate: 0 },
    'assets/ikebana_leaf_small_1.png':  { anchorX: 0.52, anchorY: 1.00, rotate: 2 },
    'assets/ikebana_leaf_small_2.png':  { anchorX: 0.48, anchorY: 1.00, rotate: -2 }
};

function getAnchorForSrc(src) {
    return ASSET_ANCHORS[src] || { anchorX: 0.5, anchorY: 0.98, rotate: 0 };
}

// 設定
const CONFIG = {
    featureFlags: {
        kosen: false // URLパラメータで制御
    },
    timings: {
        hintIdleMs: 7000,
        toastDuration: 3000
    },
    hints: {
        art: "そっと いれてみよう",
        tech: "角度を ちょっとずつ かえてみよう",
        science: '"あお"を 右へ うごかしてみよう'
    }
};

// DOM要素の取得
const elements = {
    sections: document.querySelectorAll('.section'),
    navItems: document.querySelectorAll('.nav-item'),
    cards: document.querySelectorAll('.card'),
    connectionBtns: document.querySelectorAll('.connection-btn'),
    phraseItems: document.querySelectorAll('.phrase-item'),
    toast: document.getElementById('toast'),
    hintModal: document.getElementById('hintModal'),
    hintText: document.getElementById('hintText')
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // URLパラメータをチェック
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('kosen') === '1') {
        CONFIG.featureFlags.kosen = true;
        showKosenSection();
    }

    // 保存された状態を読み込み
    loadState();
    
    // イベントリスナーを設定
    setupEventListeners();
    
    // 初期セクションを表示
    showSection('home');
    
    // PWAサポート
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .catch(err => console.log('SW registration failed'));
    }
}

function setupEventListeners() {
    // ナビゲーション
    if (elements.navItems && elements.navItems.forEach) {
        elements.navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                showSection(target);
            });
        });
    }

    // カード
    elements.cards.forEach(card => {
        card.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            showSection(target);
        });
    });

    // つながりボタン
    elements.connectionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            showSection(target);
            showConnectionToast();
        });
    });

    // 言語切替（ホーム画面）
    const langBtns = document.querySelectorAll('.lang-btn');
    if (langBtns && langBtns.forEach) {
        langBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.getAttribute('data-lang');
                if (window.I18N && typeof window.I18N.setLang === 'function') {
                    window.I18N.setLang(lang);
                }
            });
        });
    }

    // アート体験
    setupArtExperience();
    setupIkebanaExperience();
    
    // テクノロジー体験（7セグ）
    setupSevenSegExperience();
    
    // サイエンス体験
    setupScienceExperience();

    // ヒントモーダルを閉じる
    if (elements.hintModal) {
        elements.hintModal.addEventListener('click', hideHint);
    }

    // ヒント機能は無効化のため、タイマーのリセットは不要

    // スタートボタン（全リセットして最初から）
    const startBtn = document.getElementById('startExperience');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            resetAllState();
            showSection('art');
            showToast(I18N && I18N.t ? I18N.t('toast.start.over') : '最初からはじめます');
        });
    }
}

// セクション表示
function showSection(sectionId) {
    // 前のセクションを隠す
    elements.sections.forEach(section => {
        section.classList.remove('active');
    });

    // 新しいセクションを表示
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        AppState.currentSection = sectionId;
    }

    // ナビゲーションを更新
    if (elements.navItems && elements.navItems.forEach) {
        elements.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.target === sectionId);
        });
    }

    // 合言葉帯を更新
    updatePhraseBar(sectionId);

    // セクション固有の初期化
    initializeSection(sectionId);

    // ヒントタイマーを開始
    startHintTimer();
}

function updatePhraseBar(sectionId) {
    elements.phraseItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });
}

function initializeSection(sectionId) {
    switch (sectionId) {
        case 'art':
            initializeArtSection();
            break;
        case 'tech':
            initializeSevenSegSection();
            break;
        case 'science':
            initializeScienceSection();
            break;
    }
}

// アート体験のセットアップ
function setupArtExperience() {
    const flowerOptions = document.querySelectorAll('.flower-option');
    const placementOptions = document.querySelectorAll('.placement-option');
    const bambooTube = document.querySelector('.bamboo-tube');
    const angleSlider = document.getElementById('angleSlider');
    const angleValue = document.getElementById('angleValue');

    flowerOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            flowerOptions.forEach(o => o.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            AppState.art.flowerColor = e.currentTarget.dataset.color;
            updateArtVisuals();
            saveState();
        });
    });

    placementOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            placementOptions.forEach(o => o.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            AppState.art.placement = e.currentTarget.dataset.placement;
            updateArtVisuals();
            saveState();
        });
    });

    if (bambooTube) {
        bambooTube.addEventListener('click', () => {
            insertFlower();
        });
    }

    if (angleSlider && angleValue) {
        angleSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            AppState.art.angleDeg = value;
            angleValue.textContent = `${value}°`;
            updateArtVisuals();
            saveState();
        });
        angleValue.textContent = `${AppState.art.angleDeg ?? 0}°`;
    }
}

// いけばな（ドラッグ&ドロップ）
function setupIkebanaExperience() {
    const stage = document.getElementById('ikebanaStage');
    const pedestal = document.getElementById('pedestal');
    const thumbs = document.querySelectorAll('.flower-thumb');
    const rotateSlider = document.getElementById('rotateSlider');
    const rotateValue = document.getElementById('rotateValue');
    const deleteBtn = document.getElementById('deleteSelected');
    const presetBtns = document.querySelectorAll('.preset-btn');

    // サムネイルをタップすると即座に台座付近へ配置（選択状態）
    thumbs.forEach(img => {
        img.addEventListener('click', () => {
            if (!stage) return;
            const src = img.dataset.src || '';
            pushHistory();
            addIkebanaItem(src, stage);
        });
    });

    // ステージをタップすると選択のみ（移動はドラッグで実施）
    if (stage) {
        stage.addEventListener('click', (e) => {
            const target = e.target.closest('.flower-instance');
            if (target) {
                const id = parseInt(target.dataset.id);
                selectIkebanaItem(id);
                const sel = AppState.ikebana.items.find(i => i.id === id);
                updateRotateUI(sel ? sel.rotation : 0);
            }
        });

        // ドラッグ移動（選択状態または任意の花で開始）
        stage.addEventListener('mousedown', ikebanaPointerDown);
        stage.addEventListener('touchstart', ikebanaPointerDown, { passive: false });
    }

    // 回転スライダー
    if (rotateSlider && rotateValue) {
        rotateSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            rotateValue.textContent = `${val}°`;
            setSelectedRotation(val);
            saveState();
        });
    }

    // 削除
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            pushHistory();
            deleteSelectedIkebana();
            saveState();
        });
    }

    // 保存から復元
    renderIkebanaFromState();

    // プリセット（立派）
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!stage) return;
            const preset = btn.dataset.preset;
            applyIkebanaPreset(stage, preset);
            saveState();
            showToast(I18N && I18N.t ? I18N.t('toast.preset.applied') : 'プリセットを適用しました');
        });
    });

    // リサイズに応じてサイズ再計算
    window.addEventListener('resize', () => {
        applyRoleSizing(stage);
    });
}

function addIkebanaItem(src, stage) {
    const id = AppState.ikebana.nextId++;
    const el = document.createElement('div');
    el.className = 'flower-instance';
    el.style.backgroundImage = `url(${src})`;
    el.dataset.id = String(id);

    // 初期位置（台座の上あたり）
    const itemW = 140; // CSS と揃える
    const itemH = 140;
    const x = Math.max(0, (stage.clientWidth - itemW) / 2);
    // 画像ごとの根元位置を考慮してYを決める
    let y;
    const pedestal = document.getElementById('pedestal');
    if (pedestal) {
        const stageRect = stage.getBoundingClientRect();
        const pedestalRect = pedestal.getBoundingClientRect();
        const pedestalTopY = pedestalRect.top - stageRect.top; // ステージ内座標
        const { anchorY, rotate } = getAnchorForSrc(src);
        // 最初の一本（主）は差し込みを浅く、それ以外は標準
        const insertion = (AppState.ikebana.items.length === 0) ? 4 : 20;
        // アンカーポイント（anchorY）を台座上面に insertion px 差し込む
        y = clamp(pedestalTopY - (anchorY * itemH) + insertion, 0, stage.clientHeight - itemH);
        el.style.transform = `rotate(${rotate}deg)`;
    } else {
        // フォールバック（台座がない場合）
        y = Math.max(0, stage.clientHeight - itemH - 30);
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    stage.appendChild(el);

    AppState.ikebana.items.push({ id, src, x, y, rotation: 0, role: 'support' });
    assignRoles();
    applyRoleSizing(stage);
    selectIkebanaItem(id);
    updateRotateUI(0);
    saveState();
}

function addIkebanaItemAt(src, stage, x, y) {
    const id = AppState.ikebana.nextId++;
    const el = document.createElement('div');
    el.className = 'flower-instance';
    el.style.backgroundImage = `url(${src})`;
    el.dataset.id = String(id);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    stage.appendChild(el);
    AppState.ikebana.items.push({ id, src, x, y, rotation: 0, role: 'support' });
    assignRoles();
    applyRoleSizing(stage);
    updateRotateUI(0);
    return id;
}

function selectIkebanaItem(id) {
    AppState.ikebana.selectedId = id;
    document.querySelectorAll('.flower-instance').forEach(n => n.classList.remove('selected'));
    const el = document.querySelector(`.flower-instance[data-id="${id}"]`);
    if (el) el.classList.add('selected');
    // 上部オーバーレイは廃止、下部ボタンで操作
    // 何もしない
}

function getSelectedItem() {
    const id = AppState.ikebana.selectedId;
    if (id == null) return null;
    const item = AppState.ikebana.items.find(i => i.id === id);
    const el = document.querySelector(`.flower-instance[data-id="${id}"]`);
    return item && el ? { item, el } : null;
}

function updateRotateUI(value) {
    const slider = document.getElementById('rotateSlider');
    const label = document.getElementById('rotateValue');
    if (slider) slider.value = String(value || 0);
    if (label) label.textContent = `${value || 0}°`;
}

function setSelectedRotation(deg) {
    const selected = getSelectedItem();
    if (!selected) return;
    selected.item.rotation = deg;
    selected.el.style.transform = `rotate(${deg}deg)`;
}

function deleteSelectedIkebana() {
    const selected = getSelectedItem();
    if (!selected) return;
    selected.el.remove();
    AppState.ikebana.items = AppState.ikebana.items.filter(i => i.id !== selected.item.id);
    AppState.ikebana.selectedId = null;
    updateRotateUI(0);
    // 役割を再割り当てしてサイズ反映
    const stage = document.getElementById('ikebanaStage');
    assignRoles();
    applyRoleSizing(stage);
    detachItemControls();
}

function renderIkebanaFromState() {
    const stage = document.getElementById('ikebanaStage');
    if (!stage) return;
    // 既存をクリア（台座は保持）
    stage.querySelectorAll('.flower-instance').forEach(n => n.remove());
    AppState.ikebana.items.forEach(({ id, src, x, y, rotation, role }) => {
        const el = document.createElement('div');
        el.className = 'flower-instance';
        el.style.backgroundImage = `url(${src})`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        // アンカーに基づく微調整と回転
        const { rotate } = getAnchorForSrc(src);
        const base = typeof rotation === 'number' ? rotation : 0;
        el.style.transform = `rotate(${base + rotate}deg)`;
        el.dataset.id = String(id);
        stage.appendChild(el);
    });
    applyRoleSizing(stage);
    if (AppState.ikebana.selectedId != null) {
        selectIkebanaItem(AppState.ikebana.selectedId);
        const sel = AppState.ikebana.items.find(i => i.id === AppState.ikebana.selectedId);
        updateRotateUI(sel ? sel.rotation : 0);
    }
}

// 選択中の要素に操作オーバーレイを付与
function attachItemControls() {
    // 互換のため空実装
}

function detachItemControls() {
    // 空実装
}

// 下部グローバルコントロール（回転・削除）
document.addEventListener('DOMContentLoaded', () => {
    const rotateLeft = document.getElementById('rotateLeft');
    const rotateRight = document.getElementById('rotateRight');
    const deleteBtnBottom = document.getElementById('deleteBtnBottom');
    const step = 5;
    if (rotateLeft) {
        rotateLeft.addEventListener('click', () => {
            const sel = getSelectedItem();
            if (!sel) return;
            pushHistory();
            const next = (sel.item.rotation || 0) - step;
            sel.item.rotation = next;
            sel.el.style.transform = `rotate(${next}deg)`;
            saveState();
        });
    }
    if (rotateRight) {
        rotateRight.addEventListener('click', () => {
            const sel = getSelectedItem();
            if (!sel) return;
            pushHistory();
            const next = (sel.item.rotation || 0) + step;
            sel.item.rotation = next;
            sel.el.style.transform = `rotate(${next}deg)`;
            saveState();
        });
    }
    if (deleteBtnBottom) {
        deleteBtnBottom.addEventListener('click', () => {
            pushHistory();
            deleteSelectedIkebana();
            saveState();
        });
    }

    // Undo / Redo
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            if (AppState.history.past.length === 0) return;
            const current = snapshotIkebana();
            const prev = AppState.history.past.pop();
            AppState.history.future.push(current);
            restoreIkebanaSnapshot(prev);
            saveState();
        });
    }
    if (redoBtn) {
        redoBtn.addEventListener('click', () => {
            if (AppState.history.future.length === 0) return;
            const current = snapshotIkebana();
            const next = AppState.history.future.pop();
            AppState.history.past.push(current);
            restoreIkebanaSnapshot(next);
            saveState();
        });
    }
});

// 役割の割当て（追加順）: 1:主, 2:副, 3以降:控
function assignRoles() {
    const items = AppState.ikebana.items;
    items.forEach((it, idx) => {
        if (idx === 0) it.role = 'main';
        else if (idx === 1) it.role = 'sub';
        else it.role = 'support';
    });
}

function applyRoleSizing(stage) {
    if (!stage) return;
    // ステージ幅に応じてスケール
    const base = 360; // 基準幅
    const scale = Math.max(0.7, Math.min(1.0, stage.clientWidth / base));
    const SIZE_MAP = { main: 180, sub: 140, support: 115 }; // px（基準）
    AppState.ikebana.items.forEach(({ id, role }) => {
        const el = stage.querySelector(`.flower-instance[data-id="${id}"]`);
        if (!el) return;
        const size = (SIZE_MAP[role] || 140) * scale;
        el.style.width = `${Math.round(size)}px`;
        el.style.height = `${Math.round(size)}px`;
    });
}

// プリセット定義と適用
function getPresetDefinition(presetKey, stage) {
    // ステージサイズから相対配置（%ベース）で座標を決定
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const px = (p) => Math.round(p * W);
    const py = (p) => Math.round(p * H);
    // 台座上面のY座標（ステージ内）を取得し、刺さり量を一定にする
    let pedestalTopY = Math.round(H * 0.85); // フォールバック
    const pedestal = document.getElementById('pedestal');
    if (pedestal) {
        const stageRect = stage.getBoundingClientRect();
        const pedRect = pedestal.getBoundingClientRect();
        pedestalTopY = pedRect.top - stageRect.top;
    }
    // 役割ごとの見え方に合わせて、台座からの差し込み量（px）を調整
    const insertDepth = {
        main: 3,    // 主は浅く（上に見せる）
        sub: 14,    // 副は中
        accent: 10  // 控は浅め
    };
    // 新アセット（主/副/控）
    const mainCandidates = [
        'assets/ikebana_branch_tall_1.png',
        'assets/ikebana_branch_tall_2.png'
    ];
    const subCandidates = [
        'assets/ikebana_flower_wide_1.png',
        'assets/ikebana_flower_wide_2.png'
    ];
    const accentCandidates = [
        'assets/ikebana_leaf_small_1.png',
        'assets/ikebana_leaf_small_2.png'
    ];
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    if (presetKey === 'sogetsu') {
        // 草月流 基本形イメージ: 主枝（高・斜め上）、副枝（低・水平気味）、控え（低・前）
        return [
            // xは比率、yは台座上面から差し込んだ位置に揃える
            { src: pick(mainCandidates),   x: px(0.60), y: pedestalTopY - 140 + insertDepth.main,   rotation: -32 },
            { src: pick(subCandidates),    x: px(0.40), y: pedestalTopY - 120 + insertDepth.sub,    rotation: 6 },
            { src: pick(accentCandidates), x: px(0.52), y: pedestalTopY - 110 + insertDepth.accent, rotation: 20 }
        ];
    }
    if (presetKey === 'ohara') {
        // 小原流 基本形イメージ: 直立正風に近い安定三角
        return [
            { src: pick(mainCandidates),   x: px(0.52), y: pedestalTopY - 140 + insertDepth.main,   rotation: -12 },
            { src: pick(subCandidates),    x: px(0.34), y: pedestalTopY - 125 + insertDepth.sub,    rotation: 8 },
            { src: pick(accentCandidates), x: px(0.62), y: pedestalTopY - 115 + insertDepth.accent, rotation: 24 }
        ];
    }
    return [];
}

function applyIkebanaPreset(stage, presetKey) {
    // 既存要素をクリア
    stage.querySelectorAll('.flower-instance').forEach(n => n.remove());
    AppState.ikebana.items = [];
    AppState.ikebana.selectedId = null;

    const defs = getPresetDefinition(presetKey, stage);
    defs.forEach(def => {
        pushHistory();
        const id = addIkebanaItemAt(def.src, stage, def.x, def.y);
        // 回転を反映
        const node = document.querySelector(`.flower-instance[data-id="${id}"]`);
        const item = AppState.ikebana.items.find(i => i.id === id);
        if (node && item) {
            item.rotation = def.rotation || 0;
            node.style.transform = `rotate(${item.rotation}deg)`;
        }
    });
}

function ikebanaPointerDown(e) {
    const stage = document.getElementById('ikebanaStage');
    if (!stage) return;
    const point = getPoint(e);
    const target = e.target.closest('.flower-instance');
    if (!target) return;
    e.preventDefault();
    const id = parseInt(target.dataset.id);
    selectIkebanaItem(id);

    const elRect = target.getBoundingClientRect();
    AppState.ikebana.dragging.id = id;
    AppState.ikebana.dragging.offsetX = point.x - elRect.left;
    AppState.ikebana.dragging.offsetY = point.y - elRect.top;

    document.addEventListener('mousemove', ikebanaPointerMove);
    document.addEventListener('touchmove', ikebanaPointerMove, { passive: false });
    document.addEventListener('mouseup', ikebanaPointerUp);
    document.addEventListener('touchend', ikebanaPointerUp);
}

function ikebanaPointerMove(e) {
    const stage = document.getElementById('ikebanaStage');
    if (!stage) return;
    const id = AppState.ikebana.dragging.id;
    if (id == null) return;
    const { item, el } = getSelectedItem() || {};
    if (!item || !el) return;

    e.preventDefault();
    const point = getPoint(e);
    const rect = stage.getBoundingClientRect();
    const newX = clamp(point.x - rect.left - AppState.ikebana.dragging.offsetX, 0, stage.clientWidth - el.offsetWidth);
    // キャンバス内であればどこでも配置可能
    const newY = clamp(point.y - rect.top - AppState.ikebana.dragging.offsetY, 0, stage.clientHeight - el.offsetHeight);
    el.style.left = `${newX}px`;
    el.style.top = `${newY}px`;
    item.x = newX;
    item.y = newY;
}

function ikebanaPointerUp() {
    AppState.ikebana.dragging.id = null;
    document.removeEventListener('mousemove', ikebanaPointerMove);
    document.removeEventListener('touchmove', ikebanaPointerMove);
    document.removeEventListener('mouseup', ikebanaPointerUp);
    document.removeEventListener('touchend', ikebanaPointerUp);
    saveState();
}

function getPoint(e) {
    if (e.touches && e.touches[0]) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function initializeArtSection() {
    // 前のセクションの設定を引き継ぎ
    if (AppState.art.flowerColor || AppState.art.placement) {
        showToast(I18N && I18N.t ? I18N.t('toast.carryover') : '前の設定を引き継ぎました（変更OK）');
    }
    updateArtVisuals();
    // いけばなUIの復元（セクション切替時に念のため）
    renderIkebanaFromState();
}

function updateArtVisuals() {
    const insertedFlower = document.querySelector('.inserted-flower');
    const shadowEffect = document.querySelector('.shadow-effect');
    const resultVisual = document.querySelector('.result-visual');
    const bambooTube = document.querySelector('.bamboo-tube');
    const angleSlider = document.getElementById('angleSlider');
    const angleValue = document.getElementById('angleValue');

    // 角度の反映（いつでも視覚化）
    const rotation = `${AppState.art.angleDeg || 0}deg`;
    if (bambooTube) {
        bambooTube.style.setProperty('--flower-rotation', rotation);
        bambooTube.classList.add('rotated');
    }
    if (insertedFlower) {
        insertedFlower.style.setProperty('--flower-rotation', rotation);
    }
    if (angleSlider && angleValue) {
        angleSlider.value = String(AppState.art.angleDeg || 0);
        angleValue.textContent = `${AppState.art.angleDeg || 0}°`;
    }

    if (insertedFlower && shadowEffect && resultVisual && AppState.art.flowerColor && AppState.art.placement) {
        // 花の色を設定
        let flowerEmoji = '🌸';
        if (AppState.art.flowerColor === 'blue') flowerEmoji = '🌸';
        else if (AppState.art.flowerColor === 'pink') flowerEmoji = '🌺';
        else if (AppState.art.flowerColor === 'white') flowerEmoji = '🤍';

        insertedFlower.textContent = flowerEmoji;
        insertedFlower.style.opacity = '1';
        shadowEffect.style.opacity = '1';

        // 結果表示
        if (resultVisual) {
            resultVisual.textContent = flowerEmoji;
            resultVisual.style.background = '#e3f2fd';
            resultVisual.style.border = '2px solid var(--primary-blue)';
        }

        // ミッション達成チェック
        // 達成条件: 青 + ななめ + そっと + 角度が 30〜60°（絶対値）
        const angleOk = Math.abs(AppState.art.angleDeg || 0) >= 30 && Math.abs(AppState.art.angleDeg || 0) <= 60;
        if (AppState.art.flowerColor === 'blue' && AppState.art.placement === 'tilt' && AppState.art.softInsert && angleOk) {
            showSuccessMessage('アート', '青い花を そっと ななめに、角度もきめました！');
        }
    }
}

function insertFlower() {
    if (!AppState.art.flowerColor || !AppState.art.placement) {
        showToast(I18N && I18N.t ? I18N.t('toast.need.select') : '花と いけ方を 選んでください');
        return;
    }

    // そっと入れる判定（簡単化）
    AppState.art.softInsert = true;
    updateArtVisuals();
    saveState();
    
    showToast(I18N && I18N.t ? I18N.t('toast.soft.inserted') : 'そっと いけました！');
}

// --- 7セグLED 体験: セットアップ ---
function setupSevenSegExperience() {
    const breadboard = document.getElementById('breadboard');
    const orientH = null;
    const orientV = null;
    const wireDeleteBtn = null; // 削除ボタンは廃止
    const wireTemplate = document.getElementById('wireTemplate');
    const wireInventory = document.getElementById('wireInventory');
    const wireCount = document.getElementById('wireCount');
    const wireResetBtn = document.getElementById('wireReset');

    if (!breadboard || !wireInventory) return;

    // 在庫UI初期化
    const updateInvEnabled = () => {
        const remain = AppState.techSeven.stock;
        const invs = wireInventory ? Array.from(wireInventory.querySelectorAll('.inv-wire')) : [];
        invs.forEach((node, idx) => {
            node.classList.toggle('disabled', idx >= remain);
            node.setAttribute('aria-disabled', String(idx >= remain));
        });
    };

    const resetInventoryUI = () => {
        const invs = wireInventory ? Array.from(wireInventory.querySelectorAll('.inv-wire')) : [];
        invs.forEach(n => { n.classList.remove('used'); n.style.visibility = ''; n.classList.remove('disabled'); n.removeAttribute('aria-disabled'); });
    };

    // 向き切替
    const setOrientation = (o) => { AppState.techSeven.orientation = o; };

    // ユーティリティ
    function isPointInside(el, clientX, clientY) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    }

    // 在庫アイコン群からドラッグ&ドロップ（PC: DnD / モバイル: touch系）
    let ghost = null;
    let draggingWireId = null; // モバイル用: 既設ドラッグ中のID
    function createGhost(e) {
        // 既設ワイヤのドラッグ時は向きをDOMクラスから取得
        let orient = AppState.techSeven.orientation;
        const draggingPlaced = e.target && e.target.classList && e.target.classList.contains('wire') && e.target.classList.contains('placed');
        if (draggingPlaced) {
            orient = e.target.classList.contains('vertical') ? 'v' : 'h';
        }
        const g = document.createElement('div');
        g.className = 'wire ghost' + (orient === 'v' ? ' vertical' : '');
        g.style.width = orient === 'h' ? '120px' : '12px';
        g.style.height = orient === 'h' ? '12px' : '120px';
        document.body.appendChild(g);
        ghost = g;
        moveGhost(e);
        highlightNearestSlot(e);
    }
    function moveGhost(e) {
        if (!ghost) return;
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - (ghost.offsetWidth/2);
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - (ghost.offsetHeight/2);
        ghost.style.left = x + 'px';
        ghost.style.top = y + 'px';
    }
    function destroyGhost() { if (ghost) { ghost.remove(); ghost = null; } }

    function highlightNearestSlot(e) {
        if (!breadboard) return;
        // 向きに依存せず、全スロットから最寄りを選ぶ
        const slots = Array.from(breadboard.querySelectorAll('.seg-slot'));
        slots.forEach(s => s.classList.remove('target'));
        const bb = breadboard.getBoundingClientRect();
        const px = (e.touches ? e.touches[0].clientX : e.clientX) - bb.left;
        const py = (e.touches ? e.touches[0].clientY : e.clientY) - bb.top;
        let best = null; let bestDist = Infinity;
        slots.forEach(s => {
            const r = s.getBoundingClientRect();
            const cx = (r.left + r.right)/2; const cy = (r.top + r.bottom)/2;
            const d = Math.hypot((e.touches?e.touches[0].clientX:e.clientX)-cx, (e.touches?e.touches[0].clientY:e.clientY)-cy);
            if (d < bestDist) { bestDist = d; best = s; }
        });
        if (best) best.classList.add('target');
    }

    function bindInventoryDrag(node) {
        node.addEventListener('dragstart', (e) => {
            if (AppState.techSeven.stock <= 0) { e.preventDefault(); showToast(I18N && I18N.t ? I18N.t('toast.no.stock') : '在庫がありません'); return; }
            // 向きは在庫では固定せず、ドロップ先スロットの orient で判定
            e.dataTransfer.setData('text/plain', 'wire');
            e.dataTransfer.effectAllowed = 'copy';
            createGhost(e);
        });
        node.addEventListener('touchstart', (e) => {
            if (AppState.techSeven.stock <= 0) { return; }
            e.preventDefault(); // スクロール・選択を抑止
            createGhost(e);
        }, { passive: false });
    }
    if (wireInventory) {
        wireInventory.querySelectorAll('.inv-wire').forEach(n => bindInventoryDrag(n));
    }
    window.addEventListener('touchmove', (e) => { try { if (ghost) { e.preventDefault(); moveGhost(e); highlightNearestSlot(e); } } catch(_){} }, { passive: false });
    window.addEventListener('mousemove', (e) => { if (ghost) { moveGhost(e); highlightNearestSlot(e); } });
    window.addEventListener('touchend', (e) => {
        try {
            if (!ghost) return;
            const cx = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
            const cy = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : 0);
            // 盤面にドロップ（最寄りスロットへ）
            const target = breadboard.querySelector('.seg-slot.target');
            if (target) target.classList.remove('target');
            // もう一度最近傍を選定
            highlightNearestSlot({ touches: [{ clientX: cx, clientY: cy }] });
            const near = breadboard.querySelector('.seg-slot.target');
            if (near) {
                const segKey = near.getAttribute('data-seg');
                const orient = near.getAttribute('data-orient') || 'h';
                placeWireAtSlot(breadboard, segKey, orient);
                near.classList.remove('target');
            }
        } catch(_) { /* noop */ }
        finally {
            const dragging = document.querySelector('.wire.dragging');
            if (dragging) dragging.classList.remove('dragging');
            draggingWireId = null;
            destroyGhost();
        }
    });
    window.addEventListener('mouseup', () => destroyGhost());

    // 盤面クリックで選択解除
    breadboard.addEventListener('click', (e) => {
        if (!(e.target instanceof Element)) return;
        if (!e.target.classList.contains('wire')) {
            clearWireSelection();
        }
    });

    // ドロップ受け入れ
    breadboard.addEventListener('dragover', (e) => {
        e.preventDefault();
        highlightNearestSlot(e);
    });
    breadboard.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
    breadboard.addEventListener('touchmove', (e) => { try { e.preventDefault(); if (ghost) { moveGhost(e); highlightNearestSlot(e); } } catch(_){} }, { passive: false });
    breadboard.addEventListener('drop', (e) => {
        try {
            e.preventDefault();
            const target = breadboard.querySelector('.seg-slot.target');
            if (target) {
                target.classList.remove('target');
                const segKey = target.getAttribute('data-seg');
                // ドロップ先のスロットの向きから自動判定
                const orient = target.getAttribute('data-orient') || 'h';
                placeWireAtSlot(breadboard, segKey, orient);
            }
        } catch (err) {
            console.error('drop handler error', err);
        } finally {
            destroyGhost();
        }
    });

    // 在庫へ戻す処理は廃止（リセットのみ）

    // 削除ボタンは廃止

    // 復元
    renderSevenFromState();
    evaluateSegments();
    updateInvEnabled();
}

function initializeSevenSegSection() {
    // セクション入場時の表示更新のみ
    renderSevenFromState();
    evaluateSegments();
    const btn = document.getElementById('wireReset');
    if (btn) {
        btn.onclick = () => {
            // 盤面のワイヤを全消去して在庫復帰
            const breadboard = document.getElementById('breadboard');
            if (breadboard) breadboard.querySelectorAll('.wire').forEach(n => n.remove());
            AppState.techSeven.wires = [];
            AppState.techSeven.selectedWireId = null;
            AppState.techSeven.stock = 7;
            updateWireStockUI();
            const inv = document.getElementById('wireInventory');
            if (inv) {
                inv.querySelectorAll('.inv-wire').forEach(n => { n.classList.remove('used'); n.style.visibility = ''; n.classList.remove('disabled'); n.removeAttribute('aria-disabled'); });
            }
            evaluateSegments();
            saveState();
        };
    }
}

// 在庫→配置モード開始
function startPlacingWire(breadboard) {
    // 最寄りスロットにスナップ配置
    const orient = AppState.techSeven.orientation;
    const slotSelector = `.seg-slot[data-orient="${orient}"]`;
    const slots = Array.from(breadboard.querySelectorAll(slotSelector));
    // 最初は未配置、スロットにクリックで決定
    function onClick(e) {
        const target = e.target.closest('.seg-slot');
        if (!target) return;
        const segKey = target.getAttribute('data-seg');
        placeWireAtSlot(breadboard, segKey, orient);
        breadboard.removeEventListener('click', onClick);
    }
    breadboard.addEventListener('click', onClick);
}

function placeWireAtSlot(breadboard, segKey, orient) {
    if (AppState.techSeven.stock <= 0) { showToast(I18N && I18N.t ? I18N.t('toast.no.stock') : '在庫がありません'); return; }
    // 同じセグに既にワイヤがある場合は置き換え
    const exists = AppState.techSeven.wires.find(w => w.segKey === segKey);
    if (exists) {
        // 置き換え禁止: 同じエリアに重複配置しない
        showToast(I18N && I18N.t ? I18N.t('toast.wire.exists') : 'この場所にはすでにワイヤがあります');
        return;
    }
    AppState.techSeven.stock -= 1;
    const id = AppState.techSeven.nextWireId++;
    AppState.techSeven.wires.push({ id, segKey, orient });
    addWireDom(breadboard, id, segKey, orient);
    updateWireStockUI();
    // 在庫一覧から使用済みの一本を消す（最後尾から）
    const inv = document.getElementById('wireInventory');
    if (inv) {
        const nodes = Array.from(inv.querySelectorAll('.inv-wire')).filter(n => !n.classList.contains('used'));
        const useNode = nodes[0];
        if (useNode) {
            useNode.classList.add('used');
            useNode.style.visibility = 'hidden';
        }
    }
    saveState();
    evaluateSegments();
}

function addWireDom(breadboard, id, segKey, orient) {
    const slot = breadboard.querySelector(`.seg-slot.${segKey}`);
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    const bb = breadboard.getBoundingClientRect();
    const wire = document.createElement('div');
    wire.className = 'wire placed' + (orient === 'v' ? ' vertical' : '');
    wire.dataset.id = String(id);
    wire.setAttribute('data-seg', segKey);
    wire.style.left = `${rect.left - bb.left + 2}px`;
    wire.style.top = `${rect.top - bb.top + 2}px`;
    if (orient === 'h') {
        wire.style.width = `${rect.width - 4}px`;
        wire.style.height = `12px`;
    } else {
        wire.style.height = `${rect.height - 4}px`;
        wire.style.width = `12px`;
    }
    // 再移動は廃止: 既設ワイヤはドラッグ不可
    wire.removeAttribute('draggable');
    wire.addEventListener('click', (e) => {
        e.stopPropagation();
        selectWire(id);
    });
    breadboard.appendChild(wire);
}

function removeWireDom(id) {
    const node = document.querySelector(`.wire[data-id="${id}"]`);
    if (node) node.remove();
}

// 既設ワイヤを別スロットへ移動
function moveExistingWire(id, segKey, orient, breadboard) {
    // 既に対象スロットにワイヤがある場合は禁止
    const dup = AppState.techSeven.wires.find(w => w.segKey === segKey);
    if (dup) { showToast(I18N && I18N.t ? I18N.t('toast.wire.exists') : 'この場所にはすでにワイヤがあります'); return; }
    const item = AppState.techSeven.wires.find(w => w.id === id);
    if (!item) return;
    removeWireDom(id);
    item.segKey = segKey;
    item.orient = orient;
    addWireDom(breadboard, id, segKey, orient);
    evaluateSegments();
    saveState();
}

// 在庫に戻す
function returnWireToInventory(id) {
    const idx = AppState.techSeven.wires.findIndex(w => w.id === id);
    if (idx < 0) return;
    removeWireDom(id);
    AppState.techSeven.wires.splice(idx, 1);
    AppState.techSeven.selectedWireId = null;
    AppState.techSeven.stock += 1;
    updateWireStockUI();
    const inv = document.getElementById('wireInventory');
    if (inv) {
        const used = inv.querySelector('.inv-wire.used');
        if (used) { used.classList.remove('used'); used.style.visibility = ''; }
    }
    evaluateSegments();
    saveState();
}

function selectWire(id) {
    AppState.techSeven.selectedWireId = id;
    document.querySelectorAll('.wire').forEach(n => n.classList.remove('selected'));
    const node = document.querySelector(`.wire[data-id="${id}"]`);
    if (node) node.classList.add('selected');
}

function clearWireSelection() {
    AppState.techSeven.selectedWireId = null;
    document.querySelectorAll('.wire').forEach(n => n.classList.remove('selected'));
}

function deleteSelectedWire() {
    const id = AppState.techSeven.selectedWireId;
    if (id == null) return;
    const idx = AppState.techSeven.wires.findIndex(w => w.id === id);
    if (idx >= 0) {
        AppState.techSeven.wires.splice(idx, 1);
        removeWireDom(id);
        AppState.techSeven.selectedWireId = null;
        // 在庫復活
        AppState.techSeven.stock += 1;
        updateWireStockUI();
        const inv = document.getElementById('wireInventory');
        if (inv) {
            const used = inv.querySelector('.inv-wire.used');
            if (used) {
                used.classList.remove('used');
                used.style.visibility = '';
            }
        }
    }
}

function updateWireStockUI() {
    const wireCount = document.getElementById('wireCount');
    if (wireCount) wireCount.textContent = String(AppState.techSeven.stock);
}

function renderSevenFromState() {
    const breadboard = document.getElementById('breadboard');
    if (!breadboard) return;
    // 既存をクリア
    breadboard.querySelectorAll('.wire').forEach(n => n.remove());
    AppState.techSeven.wires.forEach(({ id, segKey, orient }) => addWireDom(breadboard, id, segKey, orient));
    updateWireStockUI();
}

// 7セグの認識と表示更新
function evaluateSegments() {
    const segments = ['a','b','c','d','e','f','g'];
    const on = new Set(AppState.techSeven.wires.map(w => w.segKey));
    // 表示
    segments.forEach(k => {
        const node = document.querySelector(`.segment[data-seg="${k}"]`);
        if (node) node.classList.toggle('on', on.has(k));
    });
    // 数字判定
    const digit = determineDigit(on);
    const res = document.getElementById('sevensegResult');
    if (res) res.textContent = digit == null ? '?' : String(digit);
}

function determineDigit(onSet) {
    // 厳密一致: 0~9 の a-g セット
    const map = {
        0: ['a','b','c','d','e','f'],
        1: ['b','c'],
        2: ['a','b','g','e','d'],
        3: ['a','b','g','c','d'],
        4: ['f','g','b','c'],
        5: ['a','f','g','c','d'],
        6: ['a','f','g','e','c','d'],
        7: ['a','b','c'],
        8: ['a','b','c','d','e','f','g'],
        9: ['a','b','c','d','f','g']
    };
    const on = Array.from(onSet).sort().join('');
    for (const [d, arr] of Object.entries(map)) {
        if (arr.slice().sort().join('') === on) return Number(d);
    }
    return null;
}

// サイエンス体験のセットアップ
function setupScienceExperience() {
    const sliders = {
        red: document.getElementById('redSlider'),
        blue: document.getElementById('blueSlider'),
        green: document.getElementById('greenSlider')
    };

    Object.entries(sliders).forEach(([color, slider]) => {
        if (slider) {
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                AppState.science[color] = value;
                updateSliderValue(color, value);
                updateScienceVisuals();
                saveState();
            });
        }
    });
}

function initializeScienceSection() {
    updateScienceVisuals();
}

function updateSliderValue(color, value) {
    const sliderItem = document.querySelector(`.${color}-slider`).closest('.slider-item');
    const valueSpan = sliderItem.querySelector('.slider-value');
    if (valueSpan) {
        valueSpan.textContent = value;
    }
}

function updateScienceVisuals() {
    const beamR = document.getElementById('beamR');
    const beamG = document.getElementById('beamG');
    const beamB = document.getElementById('beamB');
    const diamondGlow = document.querySelector('.diamond-glow');
    const diamondCore = document.querySelector('.diamond-core');
    const sparkleEffect = document.querySelector('.sparkle-effect');
    const successMessage = document.getElementById('successMessage');

    // 各色懐中電灯ビームの不透明度を個別反映
    const rIntensity = Math.max(0, Math.min(1, AppState.science.red / 100));
    const gIntensity = Math.max(0, Math.min(1, AppState.science.green / 100));
    const bIntensity = Math.max(0, Math.min(1, AppState.science.blue / 100));
    if (beamR) beamR.style.opacity = String(rIntensity);
    if (beamG) beamG.style.opacity = String(gIntensity);
    if (beamB) beamB.style.opacity = String(bIntensity);

    // 青の値に基づいて蛍光効果を計算（30%以上で立ち上がり）
    const fluorescence = Math.max(0, AppState.science.blue - 30) / 70;

    if (diamondGlow && diamondCore && sparkleEffect) {
        if (fluorescence > 0) {
            // 外周の赤グローとコアの強い赤発光を段階的に強める
            diamondGlow.style.opacity = String(Math.min(1, fluorescence * 1.1));
            diamondCore.style.opacity = String(Math.min(1, 0.25 + fluorescence * 0.9));
            if (fluorescence > 0.7) {
                sparkleEffect.style.opacity = '1';
                if (successMessage && !successMessage.classList.contains('visible')) {
                    successMessage.classList.remove('hidden');
                    successMessage.classList.add('visible');
                    showSuccessMessage('サイエンス', (I18N && I18N.t ? I18N.t('sci.success') : '成功！ あかく ひかったよ ✨'));
                }
            } else {
                sparkleEffect.style.opacity = '0';
                // 閾値未満なら成功メッセージは非表示に戻す
                if (successMessage) {
                    successMessage.classList.add('hidden');
                    successMessage.classList.remove('visible');
                }
            }
        } else {
            diamondGlow.style.opacity = '0';
            diamondCore.style.opacity = '0';
            sparkleEffect.style.opacity = '0';
            // 完全にオフの場合も成功メッセージを非表示へ
            if (successMessage) {
                successMessage.classList.add('hidden');
                successMessage.classList.remove('visible');
            }
        }
    }
}

// 米子高専セクションの表示
function showKosenSection() {
    const kosenSection = document.getElementById('kosen');
    if (kosenSection) {
        kosenSection.style.display = 'block';
        
        // ナビに高専ボタンを追加
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            const kosenNavItem = document.createElement('button');
            kosenNavItem.className = 'nav-item';
            kosenNavItem.dataset.target = 'kosen';
            kosenNavItem.innerHTML = `
                <span class="nav-icon">🏫</span>
                <span class="nav-label">高専</span>
            `;
            kosenNavItem.addEventListener('click', () => showSection('kosen'));
            bottomNav.appendChild(kosenNavItem);
        }
    }
}

// ヒント機能
function startHintTimer() {
    // ヒント表示は無効化
    clearTimeout(AppState.timers.hint);
}

function resetHintTimer() {
    // ヒント表示は無効化
    clearTimeout(AppState.timers.hint);
}

function showHint() {
    // 非表示にするため何もしない
}

function hideHint() {
    // 非表示にするため何もしない
}

// トースト通知
function showToast(message) {
    if (elements.toast) {
        elements.toast.textContent = message;
        elements.toast.classList.remove('hidden');
        
        setTimeout(() => {
            elements.toast.classList.add('hidden');
        }, CONFIG.timings.toastDuration);
    }
}

function showConnectionToast() {
    // 接続トーストは不要のため何もしない
}

function showSuccessMessage(section, message) {
    showToast(`✨ ${message}`);
    
    // 30秒ミッション達成の視覚的フィードバック
    const missionBox = document.querySelector(`#${AppState.currentSection} .mission-box`);
    if (missionBox) {
        missionBox.style.background = 'linear-gradient(135deg, var(--success) 0%, #66bb6a 100%)';
        setTimeout(() => {
            missionBox.style.background = '';
        }, 2000);
    }
}

// 状態管理
function resetAllState() {
    // いけばな
    AppState.art = { flowerColor: null, placement: null, softInsert: false, angleDeg: 0 };
    AppState.ikebana = { items: [], selectedId: null, nextId: 1, dragging: { id: null, offsetX: 0, offsetY: 0 } };
    // テク（7セグ）
    AppState.tech = { lightColor: null, angleDeg: 0, fixed: false, isPlaying: false };
    AppState.techSeven = { nextWireId: 1, orientation: 'h', stock: 7, selectedWireId: null, wires: [] };
    // サイエンス
    AppState.science = { red: 0, blue: 0, green: 0 };
    // 履歴
    AppState.history = { past: [], future: [] };

    // DOMの視覚を初期化
    try {
        // いけばなステージクリア
        const stage = document.getElementById('ikebanaStage');
        if (stage) stage.querySelectorAll('.flower-instance').forEach(n => n.remove());
        const rotateVal = document.getElementById('rotateValue'); if (rotateVal) rotateVal.textContent = '0°';
        // 7セグクリア
        const breadboard = document.getElementById('breadboard');
        if (breadboard) breadboard.querySelectorAll('.wire').forEach(n => n.remove());
        evaluateSegments();
        const inv = document.getElementById('wireInventory');
        if (inv) inv.querySelectorAll('.inv-wire').forEach(n => { n.classList.remove('used'); n.style.visibility=''; n.classList.remove('disabled'); n.removeAttribute('aria-disabled'); });
        updateWireStockUI();
        // サイエンスUI
        ['red','blue','green'].forEach(c => updateSliderValue(c, 0));
        // 成功メッセージ・発光を確実にオフ
        const successMessage = document.getElementById('successMessage');
        if (successMessage) { successMessage.classList.add('hidden'); successMessage.classList.remove('visible'); }
        const diamondGlow = document.querySelector('.diamond-glow'); if (diamondGlow) diamondGlow.style.opacity = '0';
        const diamondCore = document.querySelector('.diamond-core'); if (diamondCore) diamondCore.style.opacity = '0';
        const sparkleEffect = document.querySelector('.sparkle-effect'); if (sparkleEffect) sparkleEffect.style.opacity = '0';
        updateScienceVisuals();
    } catch(_) {}

    // 保存領域クリア
    try { localStorage.removeItem('goki'); } catch(_) {}
}
function saveState() {
    try {
        const stateToSave = {
            art: AppState.art,
            tech: AppState.tech,
            science: AppState.science,
            techSeven: AppState.techSeven,
            ikebana: {
                items: AppState.ikebana.items,
                selectedId: AppState.ikebana.selectedId,
                nextId: AppState.ikebana.nextId
            }
        };
        localStorage.setItem('goki', JSON.stringify(stateToSave));
    } catch (e) {
        console.warn('状態の保存に失敗しました:', e);
    }
}

function snapshotIkebana() {
    return JSON.parse(JSON.stringify({
        items: AppState.ikebana.items,
        selectedId: AppState.ikebana.selectedId,
        nextId: AppState.ikebana.nextId
    }));
}

function pushHistory() {
    AppState.history.past.push(snapshotIkebana());
    AppState.history.future = [];
}

function restoreIkebanaSnapshot(snap) {
    AppState.ikebana.items = snap.items || [];
    AppState.ikebana.selectedId = snap.selectedId ?? null;
    AppState.ikebana.nextId = snap.nextId ?? 1;
    renderIkebanaFromState();
}

function loadState() {
    try {
        const saved = localStorage.getItem('goki');
        if (saved) {
            const state = JSON.parse(saved);
            AppState.art = { ...AppState.art, ...state.art };
            AppState.tech = { ...AppState.tech, ...state.tech };
            AppState.science = { ...AppState.science, ...state.science };
            if (state.techSeven) {
                AppState.techSeven = { ...AppState.techSeven, ...state.techSeven };
            }
            if (state.ikebana) {
                AppState.ikebana.items = Array.isArray(state.ikebana.items) ? state.ikebana.items : [];
                AppState.ikebana.selectedId = state.ikebana.selectedId ?? null;
                AppState.ikebana.nextId = state.ikebana.nextId ?? 1;
            }
        }
    } catch (e) {
        console.warn('状態の読み込みに失敗しました:', e);
    }
}

// エラーハンドリング
window.addEventListener('error', (e) => {
    const isCoarse = (typeof window.matchMedia === 'function') && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    // リソース読み込みエラーなど、実害の少ないものはトーストを出さない
    const isResourceError = !e.error && (!!(e.target && (e.target.src || e.target.href)));
    console.error('アプリケーションエラー:', e.error || e.message);
    // スマホ環境ではグローバルエラーでトーストを出さない（誤検知対策）
    if (isCoarse) return;
    if (isResourceError) return;
    showToast(I18N && I18N.t ? I18N.t('err.generic') : 'エラーが発生しました。ページを再読み込みしてください。');
});

// 未処理のPromise拒否もログのみに留める（特にモバイル誤検知対策）
window.addEventListener('unhandledrejection', (e) => {
    console.error('未処理のエラー:', e.reason);
});

// パフォーマンス最適化
if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
        // 非必要な初期化を遅延実行
        console.log('バックグラウンド初期化完了');
    });
}