(() => {
  const editableSelector = 'h1,h2,h3,h4,p,nav a,.eyebrow,.brand-copy strong,.brand-copy small,.access,.card-link,.scene-caption,.en,.paper-preview .sub,.paper-side,.paper-hero,.footer-brand,.notice time,.custom-text-block,.free-text-content';
  const selectableSelector = `${editableSelector},.service-card,.notice,.scene-art,.custom-image-block,.free-text-block,.feature-copy,.paper-preview,.section-heading,.hero-copy,.seal-scene,.section,footer`;
  let saveTimer;
  let editing = false;
  let placingFreeText = false;
  let selectedElement = null;
  const resizeObserver = new ResizeObserver(() => { if (editing) scheduleSave(); });

  function pageMarkup() {
    const copy = document.body.cloneNode(true);
    copy.querySelector('#editDock')?.remove();
    copy.querySelector('#heroImageFile')?.remove();
    copy.querySelector('#insertImageFile')?.remove();
    copy.querySelectorAll('[contenteditable]').forEach(node => node.removeAttribute('contenteditable'));
    copy.querySelectorAll('.editor-selected').forEach(node => node.classList.remove('editor-selected'));
    copy.classList.remove('editing');
    return copy.innerHTML;
  }

  async function persist() {
    const status = document.getElementById('editStatus');
    if (status) status.textContent = '正在写入项目文件…';
    try {
      const response = await fetch('/__save-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: pageMarkup() })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存失败');
      if (status) status.textContent = '已保存到项目 index.html';
    } catch (error) {
      if (status) status.textContent = '保存失败：请用项目里的 node dev-server.js 启动预览';
      console.error('Could not save page source:', error);
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 650);
  }

  function isContainer(node) {
    return node.matches('section,footer,.feature-copy,.paper-preview,.hero-copy,.seal-scene,.section-heading');
  }

  function canDelete(node) {
    if (!node || isContainer(node)) return false;
    if (node.closest('.free-text-block')) return true;
    return node.matches('h1,h2,h3,h4,p,nav a,.eyebrow,.brand-copy strong,.brand-copy small,.access,.card-link,.scene-caption,.en,.paper-preview .sub,.paper-side,.paper-hero,.footer-brand,.notice time,.custom-text-block,.custom-image-block,.free-text-content,.free-text-block,.service-card,.notice,.scene-art');
  }

  function selectElement(node) {
    selectedElement?.classList.remove('editor-selected');
    selectedElement = node;
    selectedElement?.classList.add('editor-selected');
    const status = document.getElementById('editSelectionStatus');
    if (status) status.textContent = node ? `已选中：${node.dataset.feature || node.dataset.label || node.tagName.toLowerCase()}` : '还没有选中内容';
    const removeButton = document.getElementById('deleteSelected');
    if (removeButton) removeButton.disabled = !canDelete(node);
    const freeText = node?.closest('.free-text-block') || (node?.matches('.free-text-block') ? node : null);
    const canScale = Boolean(freeText);
    ['scaleDown', 'scaleUp'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = !canScale;
    });
    const scaleLabel = document.getElementById('scaleLabel');
    if (scaleLabel) scaleLabel.textContent = canScale ? `${Math.round(Number(freeText.dataset.scale || 1) * 100)}%` : '缩放';
  }

  function enableEditing(on) {
    editing = on;
    if (!on) {
      placingFreeText = false;
      document.body.classList.remove('placing-free-text');
    }
    document.body.classList.toggle('editing', on);
    document.querySelectorAll(editableSelector).forEach(node => {
      if (on) node.setAttribute('contenteditable', 'true');
      else node.removeAttribute('contenteditable');
    });
    document.querySelectorAll('.service-card,.notice,.custom-text-block,.custom-image-block').forEach(node => node.draggable = on);
    if (!on) selectElement(null);
    const toggle = document.getElementById('editToggle');
    if (toggle) toggle.textContent = on ? '完成编辑' : '✎ 编辑页面';
  }

  function insertAtSelection(node) {
    let anchor = selectedElement;
    if (!anchor || !anchor.isConnected) anchor = document.querySelector('#services .service-grid');
    if (!anchor) return;

    if (isContainer(anchor) || anchor.matches('.service-grid,.notice-grid')) {
      const target = anchor.matches('section') ? (anchor.querySelector('.wrap') || anchor) : anchor;
      target.append(node);
    } else {
      anchor.insertAdjacentElement('afterend', node);
    }
    if (editing) node.draggable = true;
    selectElement(node);
    scheduleSave();
  }

  function addTextBlock() {
    const block = document.createElement('div');
    block.className = 'custom-text-block';
    block.dataset.label = '文字框';
    block.textContent = '点击这里输入文字';
    insertAtSelection(block);
    enableEditing(true);
    block.focus();
    const range = document.createRange();
    range.selectNodeContents(block);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function placeFreeText(event) {
    const stage = document.querySelector('main');
    const rect = stage.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const box = document.createElement('div');
    box.className = 'free-text-block';
    box.dataset.label = '自由文本框';
    box.dataset.scale = '1';
    box.style.left = `${x * 100}%`;
    box.style.top = `${y * 100}%`;
    box.style.setProperty('--free-scale', '1');
    box.innerHTML = '<div class="free-text-handle" title="拖动调整位置">⠿ 拖动</div><div class="free-text-content" contenteditable="true" data-label="自由文本">点击输入文字</div>';
    stage.append(box);
    resizeObserver.observe(box);
    placingFreeText = false;
    document.body.classList.remove('placing-free-text');
    enableEditing(true);
    selectElement(box.querySelector('.free-text-content'));
    box.querySelector('.free-text-content').focus();
    scheduleSave();
  }

  function armFreeTextPlacement() {
    if (!editing) enableEditing(true);
    placingFreeText = true;
    document.body.classList.add('placing-free-text');
    const status = document.getElementById('editSelectionStatus');
    if (status) status.textContent = '点页面中想放文字的位置';
  }

  function changeFreeTextScale(delta) {
    const box = selectedElement?.closest('.free-text-block') || (selectedElement?.matches('.free-text-block') ? selectedElement : null);
    if (!box) return;
    const next = Math.max(.5, Math.min(2.5, Number(box.dataset.scale || 1) + delta));
    box.dataset.scale = next.toFixed(2);
    box.style.setProperty('--free-scale', next.toFixed(2));
    selectElement(selectedElement);
    scheduleSave();
  }

  function addServiceCard() {
    const title = prompt('新功能卡片的名称：', '新功能');
    if (!title) return;
    const summary = prompt('写一句简短说明：', '填写功能说明。') || '';
    const card = document.createElement('a');
    card.className = 'service-card locked';
    card.href = '#';
    card.dataset.number = String(document.querySelectorAll('.service-card').length + 1).padStart(2, '0');
    card.dataset.feature = title;
    card.dataset.userAdded = 'true';
    card.innerHTML = '<div class="card-top"><span class="icon">新</span><span class="access">◈ 需验证和白名单</span></div><h3></h3><p></p><span class="card-link">查看内容　→</span>';
    card.querySelector('h3').textContent = title;
    card.querySelector('p').textContent = summary;
    const grid = document.querySelector('.service-grid');
    grid.append(card);
    enableEditing(true);
    selectElement(card);
    scheduleSave();
  }

  function removeSelected() {
    if (!canDelete(selectedElement)) return;
    const freeText = selectedElement.closest('.free-text-block');
    if (freeText) {
      if (!confirm('删除这个自由文本框？')) return;
      resizeObserver.unobserve(freeText);
      freeText.remove();
      selectElement(null);
      scheduleSave();
      return;
    }
    const userCard = selectedElement.closest('.service-card[data-user-added="true"]');
    const target = userCard || selectedElement;
    if ((target.matches('.service-card,.notice') || target === selectedElement) && !confirm('删除选中的内容？')) return;
    target.remove();
    selectElement(null);
    scheduleSave();
  }

  function exportHtml() {
    const copy = document.documentElement.cloneNode(true);
    copy.querySelector('#editDock')?.remove();
    copy.querySelector('#heroImageFile')?.remove();
    copy.querySelector('#insertImageFile')?.remove();
    copy.querySelectorAll('[contenteditable]').forEach(node => node.removeAttribute('contenteditable'));
    copy.querySelectorAll('.editor-selected').forEach(node => node.classList.remove('editor-selected'));
    copy.querySelector('body')?.classList.remove('editing');
    const blob = new Blob(['<!doctype html>\n' + copy.outerHTML], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '辛辛纳图斯网站预览-自定义版.html';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function readResizedImage(file, callback) {
    const reader = new FileReader();
    reader.onerror = () => alert('图片读取失败，请换一张图片再试。');
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => alert('无法识别这张图片。');
      image.onload = () => {
        const scale = Math.min(1, 1800 / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        callback(canvas.toDataURL(type, .84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function insertImage(file) {
    const anchor = selectedElement;
    readResizedImage(file, dataUrl => {
      const image = document.createElement('img');
      image.className = 'custom-image-block';
      image.dataset.label = '图片';
      image.alt = file.name.replace(/\.[^.]+$/, '');
      image.src = dataUrl;
      selectedElement = anchor;
      insertAtSelection(image);
    });
  }

  function replaceHeroImage(file) {
    readResizedImage(file, dataUrl => {
      const image = document.querySelector('.scene-art');
      image.src = dataUrl;
      selectElement(image);
      scheduleSave();
    });
  }

  function bindPageActions() {
    const modal = document.getElementById('loginModal');
    const openModal = () => modal?.classList.add('open');
    const closeModal = () => modal?.classList.remove('open');
    document.getElementById('loginButton')?.addEventListener('click', openModal);
    document.getElementById('heroLogin')?.addEventListener('click', openModal);
    document.getElementById('modalClose')?.addEventListener('click', closeModal);
    document.getElementById('modalCancel')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    document.getElementById('mockLogin')?.addEventListener('click', () => alert('目前还不能登录。网站正式上线后会跳转到 Microsoft 授权页面。'));
    document.getElementById('menuToggle')?.addEventListener('click', () => document.getElementById('nav')?.classList.toggle('open'));

    document.addEventListener('click', event => {
      if (placingFreeText && editing && event.target.closest('main') && !event.target.closest('#editDock')) {
        event.preventDefault();
        placeFreeText(event);
        return;
      }
      if (editing && !event.target.closest('#editDock,#loginModal')) {
        const candidate = event.target.closest(selectableSelector);
        if (candidate) selectElement(candidate);
      }
      const card = event.target.closest('.locked');
      if (!card) return;
      if (editing) { event.preventDefault(); return; }
      event.preventDefault(); openModal();
    });

    document.getElementById('readPaper')?.addEventListener('click', event => {
      if (editing) { event.preventDefault(); return; }
      event.preventDefault(); alert('这里目前是日报首页预览，完整的日报阅读页还没接入。');
    });
    document.addEventListener('input', event => {
      if (event.target.closest('[contenteditable="true"]')) scheduleSave();
    });
    document.addEventListener('pointerdown', event => {
      const handle = event.target.closest('.free-text-handle');
      if (!editing || !handle) return;
      const box = handle.closest('.free-text-block');
      const stage = box.parentElement;
      const stageRect = stage.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = parseFloat(box.style.left) / 100 * stageRect.width;
      const startTop = parseFloat(box.style.top) / 100 * stageRect.height;
      event.preventDefault();
      selectElement(box.querySelector('.free-text-content'));
      handle.setPointerCapture(event.pointerId);
      const move = moveEvent => {
        const left = Math.max(0, Math.min(stageRect.width - boxRect.width, startLeft + moveEvent.clientX - startX));
        const top = Math.max(0, Math.min(stageRect.height - boxRect.height, startTop + moveEvent.clientY - startY));
        box.style.left = `${left / stageRect.width * 100}%`;
        box.style.top = `${top / stageRect.height * 100}%`;
      };
      const finish = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', finish);
        handle.removeEventListener('pointercancel', finish);
        scheduleSave();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', finish, { once: true });
      handle.addEventListener('pointercancel', finish, { once: true });
    });
    document.addEventListener('dragstart', event => {
      const node = event.target.closest('.service-card,.notice,.custom-text-block,.custom-image-block');
      if (!node) return;
      if (!editing) { event.preventDefault(); return; }
      node.classList.add('dragging');
      event.dataTransfer.setData('text/plain', 'move');
    });
    document.addEventListener('dragend', event => {
      const node = event.target.closest('.dragging');
      if (!node) return;
      node.classList.remove('dragging');
      scheduleSave();
    });
    document.addEventListener('dragover', event => {
      if (!editing) return;
      const node = event.target.closest('.service-card,.notice,.custom-text-block,.custom-image-block');
      const dragged = document.querySelector('.dragging');
      if (!node || !dragged || dragged === node || dragged.parentElement !== node.parentElement) return;
      event.preventDefault();
      const box = node.getBoundingClientRect();
      const after = event.clientY > box.top + box.height / 2;
      node.parentElement.insertBefore(dragged, after ? node.nextSibling : node);
    });
  }

  function mountEditor() {
    const dock = document.createElement('div');
    dock.className = 'edit-dock';
    dock.id = 'editDock';
    dock.innerHTML = '<div class="edit-panel"><strong>页面编辑（本机预览）</strong><p>普通文本框插入在选中内容附近；自由文本框可点选位置放置，再拖动或缩放。</p><div class="edit-actions"><button id="addText">＋ 添加文本框</button><button id="placeText">自由文本框</button><button id="scaleDown" disabled>缩小</button><button id="scaleUp" disabled>放大</button><button id="scaleLabel" disabled>缩放</button><button id="insertImage">插入图片</button><button id="addCard">＋ 添加功能卡</button><button id="deleteSelected" disabled>删除选中内容</button><button id="replaceImage">更换主图</button><button id="saveDraft">保存修改</button><button id="exportPage">导出 HTML</button></div><p id="editSelectionStatus" style="margin:10px 0 0">还没有选中内容</p><p id="editStatus" style="margin:5px 0 0">保存后写入项目 index.html</p></div><button class="edit-toggle" id="editToggle">✎ 编辑页面</button>';
    document.body.append(dock);

    const heroFile = document.createElement('input');
    heroFile.type = 'file'; heroFile.accept = 'image/*'; heroFile.hidden = true; heroFile.id = 'heroImageFile';
    const insertFile = document.createElement('input');
    insertFile.type = 'file'; insertFile.accept = 'image/*'; insertFile.hidden = true; insertFile.id = 'insertImageFile';
    document.body.append(heroFile, insertFile);

    document.getElementById('editToggle').addEventListener('click', () => {
      dock.classList.toggle('open');
      enableEditing(!editing);
    });
    document.getElementById('addText').addEventListener('click', addTextBlock);
    document.getElementById('placeText').addEventListener('click', armFreeTextPlacement);
    document.getElementById('scaleDown').addEventListener('click', () => changeFreeTextScale(-.1));
    document.getElementById('scaleUp').addEventListener('click', () => changeFreeTextScale(.1));
    document.getElementById('insertImage').addEventListener('click', () => insertFile.click());
    document.getElementById('addCard').addEventListener('click', addServiceCard);
    document.getElementById('deleteSelected').addEventListener('click', removeSelected);
    document.getElementById('replaceImage').addEventListener('click', () => heroFile.click());
    heroFile.addEventListener('change', () => { if (heroFile.files[0]) replaceHeroImage(heroFile.files[0]); heroFile.value = ''; });
    insertFile.addEventListener('change', () => { if (insertFile.files[0]) insertImage(insertFile.files[0]); insertFile.value = ''; });
    document.getElementById('saveDraft').addEventListener('click', persist);
    document.getElementById('exportPage').addEventListener('click', exportHtml);
  }

  const isLocalPreview = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);

  document.addEventListener('DOMContentLoaded', () => {
    bindPageActions();
    if (isLocalPreview) mountEditor();
  });
})();
