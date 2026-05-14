/* === 基本設定 === */
let characters = []; 
let relationships = []; 
let charIdCounter = 0;
let lineIdCounter = 0;

let isLineMode = false;
let selectedCharId = null;
let editingRelationId = null;

const board = document.getElementById('boardContainer');
const svg = document.getElementById('linesSvg');
let defs = svg.querySelector('defs');
const sizeSlider = document.getElementById('sizeSlider');

/* === イベントリスナー登録 === */
document.getElementById('fileInput').addEventListener('change', function() { addCharacter(this); });
document.getElementById('lineModeBtn').addEventListener('click', toggleLineMode);
document.getElementById('sizeSlider').addEventListener('input', function() { changeCharSize(this.value); });
document.getElementById('bgColorPicker').addEventListener('change', function() { board.style.background = this.value; });
document.getElementById('resetBtn').addEventListener('click', resetBoard);
document.getElementById('btn-save').addEventListener('click', saveImage);
document.getElementById('btn-share').addEventListener('click', nativeShare);

/* === トースト通知機能 === */
function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

/* === カスタム確認モーダル === */
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
let confirmAction = null;

function showConfirmModal(message, action) {
  confirmMessage.innerText = message;
  confirmAction = action;
  confirmModal.style.display = 'flex';
}
document.getElementById('confirmYesBtn').addEventListener('click', () => {
  if (confirmAction) confirmAction();
  confirmModal.style.display = 'none';
  confirmAction = null;
});
document.getElementById('confirmNoBtn').addEventListener('click', () => {
  confirmModal.style.display = 'none';
  confirmAction = null;
});

/* === キャラ追加機能 === */
function addCharacter(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    createCharacterNode(e.target.result);
    showToast("✨ キャラを追加したよ！");
    input.value = ''; 
  };
  reader.readAsDataURL(file);
}

function createCharacterNode(imgSrc) {
  charIdCounter++;
  const id = `char-${charIdCounter}`;
  
  const initialWidth = window.innerWidth <= 600 ? 60 : 80;
  const x = Math.random() * (board.clientWidth - initialWidth - 20);
  const y = Math.random() * (board.clientHeight - initialWidth - 50);

  const node = document.createElement('div');
  node.className = 'char-node';
  node.id = id;
  node.style.left = x + 'px';
  node.style.top = y + 'px';
  node.style.width = initialWidth + 'px'; 
  
  const delBtn = document.createElement('div');
  delBtn.className = 'btn-delete-char';
  delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  delBtn.onclick = (ev) => { 
    ev.stopPropagation(); 
    showConfirmModal("このキャラを削除する？", () => {
      deleteCharacter(id);
    });
  };

  const imgBox = document.createElement('div');
  imgBox.className = 'char-img-box';
  const img = document.createElement('img');
  img.src = imgSrc;
  imgBox.appendChild(img);

  const nameLabel = document.createElement('div');
  nameLabel.className = 'char-name';
  nameLabel.innerText = '名前入力';
  nameLabel.id = `name-${id}`;

  node.appendChild(delBtn);
  node.appendChild(imgBox);
  node.appendChild(nameLabel);
  board.appendChild(node);

  characters.push({ id, element: node });

  setupDraggableAndClick(node, id);
}

/* === 削除機能 === */
function deleteCharacter(id) {
  const index = characters.findIndex(c => c.id === id);
  if (index > -1) {
    characters[index].element.remove();
    characters.splice(index, 1);
    const relatedLines = relationships.filter(r => r.fromId === id || r.toId === id);
    relatedLines.forEach(r => deleteLine(r.id));
  }
  if (selectedCharId === id) {
    selectedCharId = null;
    sizeSlider.disabled = true;
  }
  showToast("🗑️ キャラを削除したよ");
}

/* === サイズ変更機能 === */
function changeCharSize(val) {
  if (!selectedCharId) return;
  const el = document.getElementById(selectedCharId);
  if (el) {
    el.style.width = val + 'px';
    updateLines();
  }
}

/* === ドラッグ＆クリック機能 === */
function setupDraggableAndClick(el, id) {
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;
  let moveDistance = 0;
  let lastTapTime = 0;

  const doDrag = (e) => {
    if (!isDragging) return;
    e.preventDefault(); 
    
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;
    moveDistance = Math.sqrt(dx*dx + dy*dy); 

    if (!isLineMode) {
      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;
      const maxW = board.clientWidth - el.offsetWidth;
      const maxH = board.clientHeight - el.offsetHeight;
      el.style.left = Math.max(0, Math.min(newLeft, maxW)) + 'px';
      el.style.top = Math.max(0, Math.min(newTop, maxH)) + 'px';
      updateLines();
    }
  };

  const stopDrag = (e) => {
    if (!isDragging) return;
    isDragging = false;
    el.style.zIndex = '';

    window.removeEventListener('mousemove', doDrag);
    window.removeEventListener('touchmove', doDrag);
    window.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('touchend', stopDrag);

    if (moveDistance < 10) {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTapTime;
      
      if (!isLineMode && tapLength < 300 && tapLength > 0) {
        openNameModal(id);
        lastTapTime = 0; 
      } else {
        handleCharClick(id);
        lastTapTime = currentTime;
      }
    }
  };

  const startDrag = (e) => {
    if(e.target.closest('.btn-delete-char')) return;
    
    isDragging = true;
    moveDistance = 0;
    
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;
    initialLeft = parseFloat(el.style.left || 0);
    initialTop = parseFloat(el.style.top || 0);
    
    if(!isLineMode) el.style.zIndex = 100;

    window.addEventListener('mousemove', doDrag, {passive: false});
    window.addEventListener('touchmove', doDrag, {passive: false});
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchend', stopDrag);
  };

  el.addEventListener('mousedown', startDrag);
  el.addEventListener('touchstart', startDrag, {passive: false});
}

/* === 選択・線結び機能 === */
function toggleLineMode() {
  isLineMode = !isLineMode;
  const btn = document.getElementById('lineModeBtn');
  deselectAll();

  if (isLineMode) {
    btn.classList.add('active');
    btn.innerHTML = '<i class="fa-solid fa-check"></i> 終了';
    sizeSlider.disabled = true;
    showToast("🔗 繋げたいキャラを2人タップしてね！");
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '<i class="fa-solid fa-link"></i> 関係を結ぶ';
  }
}

function deselectAll() {
  if (selectedCharId) {
    const el = document.getElementById(selectedCharId);
    if(el) el.classList.remove('selected');
    selectedCharId = null;
  }
  sizeSlider.disabled = true;
}

let tempFromId = null;
let tempToId = null;

function handleCharClick(id) {
  const el = document.getElementById(id);

  if (isLineMode) {
    if (!selectedCharId) {
      selectedCharId = id;
      el.classList.add('selected');
    } else {
      if (selectedCharId !== id) {
        tempFromId = selectedCharId;
        tempToId = id;
        document.getElementById(selectedCharId).classList.remove('selected');
        selectedCharId = null;
        openRelationModal(); 
      } else {
        el.classList.remove('selected');
        selectedCharId = null;
      }
    }
  } else {
    if (selectedCharId && selectedCharId !== id) {
      const prevEl = document.getElementById(selectedCharId);
      if(prevEl) prevEl.classList.remove('selected');
    }
    
    if (selectedCharId === id) {
      el.classList.remove('selected');
      selectedCharId = null;
      sizeSlider.disabled = true;
    } else {
      selectedCharId = id;
      el.classList.add('selected');
      sizeSlider.value = parseFloat(el.style.width);
      sizeSlider.disabled = false;
    }
  }
}

/* === モーダル管理 === */
const relationModal = document.getElementById('relationModal');
const nameModal = document.getElementById('nameModal');
const relationInput = document.getElementById('relationText');
const nameInput = document.getElementById('nameInput');
const colorInput = document.getElementById('lineColorInput');
const arrowCheck = document.getElementById('arrowCheck');
const relationModalTitle = document.getElementById('relationModalTitle');
const deleteRelationBtn = document.getElementById('deleteRelationBtn');
let targetNameId = null;

function openRelationModal(relId = null) {
  editingRelationId = relId;

  if (relId) {
    const rel = relationships.find(r => r.id === relId);
    relationModalTitle.innerText = '関係を編集 ✏️';
    relationInput.value = rel.text;
    colorInput.value = rel.color;
    arrowCheck.checked = rel.isArrow;
    deleteRelationBtn.style.display = 'block'; 
  } else {
    relationModalTitle.innerText = '関係性を入力 🔗';
    relationInput.value = '';
    arrowCheck.checked = false;
    colorInput.value = '#ffb7c5';
    deleteRelationBtn.style.display = 'none'; 
  }
  relationModal.style.display = 'flex';
}

document.getElementById('cancelRelationBtn').addEventListener('click', () => {
  relationModal.style.display = 'none';
  tempFromId = null; tempToId = null; editingRelationId = null;
});

document.getElementById('confirmRelationBtn').addEventListener('click', () => {
  const text = relationInput.value || '関係';
  const color = colorInput.value;
  const isArrow = arrowCheck.checked;

  if (editingRelationId) {
    const rel = relationships.find(r => r.id === editingRelationId);
    const fId = rel.fromId;
    const tId = rel.toId;
    deleteLine(editingRelationId);
    createLine(fId, tId, text, color, isArrow);
    showToast("✏️ 関係を更新したよ！");
  } else {
    createLine(tempFromId, tempToId, text, color, isArrow);
    tempFromId = null; tempToId = null;
    showToast("💞 関係を結んだよ！");
  }
  
  relationModal.style.display = 'none';
  editingRelationId = null;
});

document.getElementById('deleteRelationBtn').addEventListener('click', () => {
  showConfirmModal("この関係を削除する？", () => {
    deleteLine(editingRelationId);
    relationModal.style.display = 'none';
    editingRelationId = null;
    showToast("✂️ 関係を削除したよ");
  });
});

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    relationInput.value = btn.getAttribute('data-text');
  });
});

function openNameModal(id) {
  targetNameId = `name-${id}`;
  const currentName = document.getElementById(targetNameId).innerText;
  nameInput.value = currentName === '名前入力' ? '' : currentName;
  nameModal.style.display = 'flex';
  nameInput.focus();
}
document.getElementById('cancelNameBtn').addEventListener('click', () => {
  nameModal.style.display = 'none';
  targetNameId = null;
});
document.getElementById('confirmNameBtn').addEventListener('click', () => {
  if (targetNameId) {
    const newName = nameInput.value.trim() || '名前なし';
    document.getElementById(targetNameId).innerText = newName;
    showToast("🔤 名前を変更したよ！");
  }
  nameModal.style.display = 'none';
  targetNameId = null;
});

/* === 線の描画・管理 (直線から曲線へ！) === */
function createLine(fromId, toId, text, color, isArrow) {
  lineIdCounter++;
  const id = `line-${lineIdCounter}`;
  const markerId = `marker-${lineIdCounter}`;

  if (isArrow) {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto'); 
    
    const pathMarker = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathMarker.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    pathMarker.setAttribute('fill', color);
    marker.appendChild(pathMarker);
    defs.appendChild(marker);
  }

  // 👇 <line> じゃなくて <path> に変更！
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('id', id);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('fill', 'none'); // 👇 塗りつぶさないように設定
  if (isArrow) line.setAttribute('marker-end', `url(#${markerId})`);
  svg.appendChild(line);

  const label = document.createElement('div');
  label.className = 'relation-label';
  label.id = 'label-' + id;
  label.innerText = text;
  label.style.borderColor = color;
  label.style.color = color;
  
  label.onclick = () => {
    openRelationModal(id);
  };
  
  board.appendChild(label);
  relationships.push({ id, fromId, toId, text, color, isArrow, markerId, lineEl: line, labelEl: label });
  updateLines();
}

function deleteLine(id) {
  const index = relationships.findIndex(r => r.id === id);
  if(index > -1) {
    const rel = relationships[index];
    rel.lineEl.remove();
    rel.labelEl.remove();
    if(rel.isArrow) {
      const m = document.getElementById(rel.markerId);
      if(m) m.remove();
    }
    relationships.splice(index, 1);
  }
}

function updateLines() {
  relationships.forEach(rel => {
    const fromEl = document.getElementById(rel.fromId);
    const toEl = document.getElementById(rel.toId);
    if (!fromEl || !toEl) return;

    const x1_c = fromEl.offsetLeft + fromEl.offsetWidth / 2;
    const y1_c = fromEl.offsetTop + fromEl.offsetHeight / 2;
    const x2_c = toEl.offsetLeft + toEl.offsetWidth / 2;
    const y2_c = toEl.offsetTop + toEl.offsetHeight / 2;

    const r1 = fromEl.offsetWidth / 2;
    const r2 = toEl.offsetWidth / 2;

    const dx = x2_c - x1_c;
    const dy = y2_c - y1_c;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return;

    const offset2 = rel.isArrow ? r2 + 15 : r2; 
    const startX = x1_c + (dx / dist) * r1;
    const startY = y1_c + (dy / dist) * r1;
    const endX = x2_c - (dx / dist) * offset2;
    const endY = y2_c - (dy / dist) * offset2;

    // 👇 ここから魔法の計算！(ベクトルの法線を出す)
    // 線の真ん中を計算
    const mx = (startX + endX) / 2;
    const my = (startY + endY) / 2;

    // 線の直角方向（法線）を計算
    const nx = -dy / dist;
    const ny = dx / dist;

    // カーブのふくらみ具合（30pxくらい膨らませる）
    const curveOffset = 30;
    
    // カーブの引っ張りポイント（制御点）
    const cx = mx + nx * curveOffset;
    const cy = my + ny * curveOffset;

    // 👇 Q（二次ベジェ曲線）を使ってカーブを描く！
    rel.lineEl.setAttribute('d', `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`);

    // 👇 ラベルの位置も、カーブの膨らみの半分に合わせる
    const labelX = mx + nx * (curveOffset / 2);
    const labelY = my + ny * (curveOffset / 2);

    rel.labelEl.style.left = labelX + 'px';
    rel.labelEl.style.top = labelY + 'px';
  });
}

/* === その他機能 === */
function resetBoard() {
  showConfirmModal("ボードを全てリセットする？", () => {
    while (svg.lastChild) svg.removeChild(svg.lastChild);
    const newDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(newDefs);
    defs = newDefs; 

    characters.forEach(c => c.element.remove());
    relationships.forEach(r => r.labelEl.remove());

    characters = []; relationships = [];
    charIdCounter = 0; lineIdCounter = 0;
    isLineMode = false; selectedCharId = null;
    
    const btn = document.getElementById('lineModeBtn');
    btn.classList.remove('active');
    btn.innerHTML = '<i class="fa-solid fa-link"></i> 関係を結ぶ';
    showToast("🧹 ボードをリセットしたよ！");
  });
}

/* === 保存・共有 === */
function saveImage() {
  const btn = document.getElementById('btn-save');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 作成中...';
  
  const selected = document.querySelector('.selected');
  if(selected) selected.classList.remove('selected');

  html2canvas(board, { scale: 2, backgroundColor: null }).then(canvas => {
    const dataURL = canvas.toDataURL('image/png');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      const area = document.getElementById('longpressSaveArea');
      area.innerHTML = '';
      const img = document.createElement('img');
      img.src = dataURL;
      img.style.width = '100%';
      img.style.borderRadius = '10px';
      img.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
      const msg = document.createElement('p');
      msg.innerHTML = '☝️ <strong>画像を長押しして保存</strong>してね！';
      msg.style.color = 'var(--theme-color)';
      area.appendChild(msg);
      area.appendChild(img);
      area.style.display = 'block';
      area.scrollIntoView({behavior: 'smooth'});
      showToast("📸 下に画像ができたよ！");
    } else {
      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `soukanzu-${Date.now()}.png`;
      link.click();
      showToast("📸 画像を保存したよ！");
    }
    btn.innerHTML = originalText;
    if(selected) selected.classList.add('selected');
  });
}

function nativeShare() {
  if (navigator.share) {
    navigator.share({
      title: 'オリキャラ相関図メーカー',
      text: 'うちの子の関係性をまとめました！ #オリキャラ相関図メーカー #オリキャラ',
      url: location.href
    });
  } else {
    navigator.clipboard.writeText(location.href);
    showToast("📋 URLをコピーしたよ！");
  }
}
