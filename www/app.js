let isAdmin = false;
let currentTab = 'brands';
let currentBrandId = null;
let fontScale = 1;
let appName = '电梯维修助手';
const ADMIN_PASSWORD = '101111';
const DELETE_PASSWORD = '8888';
const FONT_STEPS = [
  { scale: 0.85, label: '超小' },
  { scale: 0.95, label: '小' },
  { scale: 1.00, label: '标准' },
  { scale: 1.15, label: '大' },
  { scale: 1.30, label: '超大' },
  { scale: 1.45, label: '特大' }
];
const AVATAR_COLORS = [
  '#1a73e8', '#e8710a', '#0f9d58', '#d93025',
  '#9334e6', '#1e8e3e', '#c5221f', '#1967d2',
  '#00897b', '#5e35b1'
];

async function init() {
  await loadData();
  await loadFontScale();
  await loadAppName();
  renderBrands();
  bindEvents();
}

async function loadData() {
  let raw = await localforage.getItem('elevatorData');
  if (!raw) raw = { brands: [], favorites: [], experiences: [], debug: [] };
  window.appData = JSON.parse(JSON.stringify(raw));
  if (!window.appData.brands) window.appData.brands = [];
  if (!window.appData.favorites) window.appData.favorites = [];
  if (!window.appData.experiences) window.appData.experiences = [];
  if (!window.appData.debug) window.appData.debug = [];
}

async function saveData() {
  await localforage.setItem('elevatorData', window.appData);
}

/* ---------- 自定义输入弹窗（替代 prompt） ---------- */
function showInput(title, placeholder, defaultValue = '') {
  return new Promise((resolve) => {
    const modal = document.getElementById('inputModal');
    document.getElementById('inputTitle').textContent = title;
    const field = document.getElementById('inputField');
    field.placeholder = placeholder || '';
    field.value = defaultValue || '';
    modal.classList.add('show');

    setTimeout(() => field.focus(), 100);

    const confirmBtn = document.getElementById('inputConfirm');
    const cancelBtn = document.getElementById('inputCancel');
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.replaceWith(newConfirm);
    cancelBtn.replaceWith(newCancel);

    newConfirm.onclick = () => {
      modal.classList.remove('show');
      resolve(field.value.trim());
    };
    newCancel.onclick = () => {
      modal.classList.remove('show');
      resolve(null);
    };
  });
}

/* ---------- 应用名称 ---------- */
async function loadAppName() {
  const saved = await localforage.getItem('appName');
  if (saved) appName = saved;
  applyAppName();
}

function applyAppName() {
  document.getElementById('appTitle').textContent = appName;
  document.title = appName;
}

async function renameApp() {
  const newName = await showInput('修改应用名称', '请输入新的名称', appName);
  if (!newName) return;
  appName = newName;
  applyAppName();
  await localforage.setItem('appName', appName);
  alert('✅ 已修改首页显示名称');
}

/* ---------- 字体大小 ---------- */
async function loadFontScale() {
  const saved = await localforage.getItem('fontScale');
  if (saved) fontScale = saved;
  applyFontScale();
}

function applyFontScale() {
  document.documentElement.style.fontSize = (16 * fontScale) + 'px';
  const step = FONT_STEPS.reduce((prev, cur) =>
    Math.abs(cur.scale - fontScale) < Math.abs(prev.scale - fontScale) ? cur : prev
  );
  const el = document.getElementById('fontLabel');
  if (el) el.textContent = step.label;
}

async function changeFontScale(delta) {
  const idx = FONT_STEPS.findIndex(s => s.scale === fontScale);
  let newIdx;
  if (idx === -1) newIdx = delta > 0 ? 3 : 2;
  else newIdx = Math.max(0, Math.min(FONT_STEPS.length - 1, idx + delta));
  fontScale = FONT_STEPS[newIdx].scale;
  applyFontScale();
  await localforage.setItem('fontScale', fontScale);
}

/* ---------- 工具 ---------- */
function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name) {
  if (!name) return '?';
  const first = name.trim().charAt(0);
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- 管理员 ---------- */
function showAdminModal() {
  document.getElementById('adminModal').classList.add('show');
  document.getElementById('adminPassword').value = '';
}

function verifyAdminPassword() {
  const input = document.getElementById('adminPassword').value;
  if (input === ADMIN_PASSWORD) {
    isAdmin = true;
    document.getElementById('lockIcon').textContent = '🔓';
    document.getElementById('adminModal').classList.remove('show');
    document.getElementById('addBtn').style.display = 'flex';
    document.getElementById('addCodeBtn').style.display = 'block';
    renderBrands();
    renderContentArea();
    if (currentBrandId) renderCodeList();
    alert('✅ 管理员模式已开启');
  } else {
    alert('❌ 密码错误');
    document.getElementById('adminPassword').value = '';
  }
}

function confirmDelete(callback) {
  const modal = document.getElementById('deleteModal');
  modal.classList.add('show');
  document.getElementById('deletePassword').value = '';
  const confirmBtn = document.getElementById('deleteConfirm');
  const cancelBtn = document.getElementById('deleteCancel');
  const newConfirm = confirmBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  confirmBtn.replaceWith(newConfirm);
  cancelBtn.replaceWith(newCancel);
  newConfirm.onclick = () => {
    if (document.getElementById('deletePassword').value === DELETE_PASSWORD) {
      modal.classList.remove('show');
      callback();
    } else {
      alert('❌ 删除密码错误');
    }
  };
  newCancel.onclick = () => modal.classList.remove('show');
}

/* ---------- 品牌列表 ---------- */
function renderBrands(filter = '') {
  const container = document.getElementById('brandList');
  const brands = window.appData.brands
    .filter(b => !filter || b.name.includes(filter) ||
      b.codes.some(c => c.code.includes(filter) || c.definition.includes(filter)))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh', { numeric: true, sensitivity: 'base' }));

  if (brands.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="emoji-big">🏢</span>
        <p>${isAdmin ? '还没有品牌<br>点击右下角 + 添加' : '还没有品牌<br>点击右上角 🔒 解锁编辑'}</p>
      </div>`;
    return;
  }

  container.innerHTML = brands.map(b => {
    const color = getAvatarColor(b.name);
    const initial = escapeHtml(getInitial(b.name));
    return `
      <div class="brand-item" data-id="${b.id}">
        <div class="item-left">
          <div class="avatar" style="background:${color};">${initial}</div>
          <div class="item-text">
            <div class="item-title">${escapeHtml(b.name)}</div>
            <div class="item-sub">共 ${b.codes.length} 个故障码</div>
          </div>
        </div>
        <div class="item-right">
          <div class="item-actions">
            ${isAdmin ? `<button class="btn-edit" onclick="event.stopPropagation(); editBrand('${b.id}')">✏️</button>
                         <button class="btn-delete" onclick="event.stopPropagation(); deleteBrand('${b.id}')">🗑️</button>` : ''}
          </div>
          <span class="arrow">›</span>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.brand-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.item-actions')) return;
      openBrand(el.dataset.id);
    });
  });
}

function bindSearch() {
  document.getElementById('searchInput').addEventListener('input', (e) => {
    renderBrands(e.target.value.trim());
  });
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.bottom-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('brandList').style.display = tab === 'brands' ? 'block' : 'none';
  renderContentArea();
}

/* ---------- 收藏/经验/调试 ---------- */
function renderContentArea() {
  const area = document.getElementById('contentArea');
  if (currentTab === 'brands') { area.innerHTML = ''; return; }
  const keyMap = { favorites: 'favorites', experience: 'experiences', debug: 'debug' };
  const key = keyMap[currentTab];
  const emojiMap = { favorites: '⭐', experiences: '📝', debug: '🔧' };
  const emptyTextMap = { favorites: '暂无收藏', experiences: '暂无经验', debug: '暂无调试资料' };

  const items = (window.appData[key] || []).sort((a, b) =>
    a.title.localeCompare(b.title, 'zh', { numeric: true, sensitivity: 'base' }));

  if (items.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <span class="emoji-big">${emojiMap[key]}</span>
        <p>${emptyTextMap[key]}<br>${isAdmin ? '点击右下角 + 添加' : '点击右上角 🔒 解锁编辑'}</p>
      </div>`;
    return;
  }

  area.innerHTML = items.map(item => `
    <div class="brand-item" data-id="${item.id}">
      <div class="item-left">
        <div class="avatar emoji">${emojiMap[key]}</div>
        <div class="item-text">
          <div class="item-title">${escapeHtml(item.title)}</div>
          <div class="item-sub">${escapeHtml((item.content || '').slice(0, 20))}${(item.content || '').length > 20 ? '...' : ''}</div>
        </div>
      </div>
      <div class="item-right">
        <div class="item-actions">
          ${isAdmin ? `<button class="btn-delete" onclick="event.stopPropagation(); deleteContent('${key}','${item.id}')">🗑️</button>` : ''}
        </div>
        <span class="arrow">›</span>
      </div>
    </div>`).join('');

  area.querySelectorAll('.brand-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.item-actions')) return;
      openContentDetail(key, el.dataset.id);
    });
  });
}

async function openContentDetail(key, id) {
  const item = window.appData[key].find(i => i.id === id);
  if (!item) return;
  document.getElementById('contentTitle').textContent = item.title;
  document.getElementById('contentBody').textContent = item.content || '（无内容）';

  const editBtn = document.getElementById('contentEditBtn');
  if (isAdmin) {
    editBtn.style.display = 'block';
    editBtn.onclick = async () => {
      const newTitle = await showInput('修改标题', '标题', item.title);
      if (newTitle === null || !newTitle) return;
      const newContent = await showInput('修改内容', '内容', item.content);
      if (newContent === null) return;
      item.title = newTitle;
      item.content = newContent;
      saveData();
      document.getElementById('contentModal').classList.remove('show');
      renderContentArea();
    };
  } else {
    editBtn.style.display = 'none';
  }
  document.getElementById('contentModal').classList.add('show');
}

/* ---------- 品牌详情 ---------- */
function openBrand(id) {
  currentBrandId = id;
  const brand = window.appData.brands.find(b => b.id === id);
  if (!brand) return;
  document.getElementById('mainPage').style.display = 'none';
  document.getElementById('bottomNav').style.display = 'none';
  document.getElementById('settingsPage').style.display = 'none';
  document.getElementById('brandDetail').style.display = 'block';
  document.getElementById('detailBrandName').textContent = brand.name;
  document.getElementById('addCodeBtn').style.display = isAdmin ? 'block' : 'none';
  const si = document.getElementById('codeSearchInput');
  if (si) si.value = '';
  renderCodeList();
}

function closeBrand() {
  currentBrandId = null;
  document.getElementById('mainPage').style.display = 'block';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('brandDetail').style.display = 'none';
  renderBrands();
  renderContentArea();
}

function renderCodeList(filter = '') {
  const brand = window.appData.brands.find(b => b.id === currentBrandId);
  if (!brand) return;
  const container = document.getElementById('codeList');

  let codes = brand.codes;
  if (filter) {
    const f = filter.toLowerCase();
    codes = codes.filter(c =>
      (c.code || '').toLowerCase().includes(f) ||
      (c.definition || '').toLowerCase().includes(f)
    );
  }

  if (codes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="emoji-big">${filter ? '🔍' : '📋'}</span>
        <p>${filter ? '未找到匹配的故障码' : '暂无故障码' + (isAdmin ? '<br>点击右上角 + 添加' : '')}</p>
      </div>`;
    return;
  }

  const sorted = [...codes].sort((a, b) =>
    a.code.localeCompare(b.code, 'zh', { numeric: true, sensitivity: 'base' }));

  container.innerHTML = sorted.map(c => `
    <div class="code-card">
      <div class="code-left">
        <div class="code-badge">${escapeHtml(c.code)}</div>
        <div class="code-text">
          <div class="code-def">${escapeHtml(c.definition || '（无定义）')}</div>
        </div>
      </div>
      ${isAdmin ? `<div class="item-actions">
        <button class="btn-edit" onclick="editCode('${c.id}')">✏️</button>
        <button class="btn-delete" onclick="deleteCode('${c.id}')">🗑️</button>
      </div>` : ''}
    </div>`).join('');
}

async function addCode() {
  const brand = window.appData.brands.find(b => b.id === currentBrandId);
  if (!brand) return;
  const code = await showInput('添加故障码', '请输入故障码（如 E01）');
  if (!code) return;
  const definition = await showInput('添加故障定义', '请输入故障含义') || '';
  brand.codes.push({
    id: Date.now().toString(),
    code: code,
    definition: definition
  });
  await saveData();
  renderCodeList();
}

async function editCode(codeId) {
  const brand = window.appData.brands.find(b => b.id === currentBrandId);
  const c = brand.codes.find(x => x.id === codeId);
  if (!c) return;
  const newCode = await showInput('修改故障码', '故障码', c.code);
  if (newCode === null || !newCode) return;
  const newDef = await showInput('修改故障定义', '故障含义', c.definition);
  if (newDef === null) return;
  c.code = newCode;
  c.definition = newDef;
  await saveData();
  renderCodeList();
}

function deleteCode(codeId) {
  confirmDelete(() => {
    const brand = window.appData.brands.find(b => b.id === currentBrandId);
    brand.codes = brand.codes.filter(c => c.id !== codeId);
    saveData();
    renderCodeList();
  });
}

function deleteBrand(id) {
  confirmDelete(() => {
    window.appData.brands = window.appData.brands.filter(b => b.id !== id);
    saveData();
    renderBrands();
  });
}

function deleteContent(key, id) {
  confirmDelete(() => {
    window.appData[key] = window.appData[key].filter(i => i.id !== id);
    saveData();
    renderContentArea();
  });
}

async function addBrand() {
  const name = await showInput('添加品牌', '请输入品牌名称');
  if (!name) return;
  window.appData.brands.push({ id: Date.now().toString(), name: name, codes: [] });
  await saveData();
  renderBrands();
}

async function editBrand(id) {
  const brand = window.appData.brands.find(b => b.id === id);
  if (!brand) return;
  const newName = await showInput('修改品牌名称', '品牌名称', brand.name);
  if (!newName || newName === brand.name) return;
  brand.name = newName;
  await saveData();
  renderBrands();
}

/* ---------- 设置页 ---------- */
function openSettings() {
  document.getElementById('mainPage').style.display = 'none';
  document.getElementById('bottomNav').style.display = 'none';
  document.getElementById('brandDetail').style.display = 'none';
  document.getElementById('settingsPage').style.display = 'block';
}

function closeSettings() {
  document.getElementById('settingsPage').style.display = 'none';
  document.getElementById('mainPage').style.display = 'block';
  document.getElementById('bottomNav').style.display = 'flex';
}

/* ---------- Excel 导出 ---------- */
async function exportExcel() {
  const rows = [];
  window.appData.brands.forEach(b => {
    if (b.codes.length === 0) {
      rows.push({ 类型: '品牌', 品牌: b.name, 故障码: '', 定义: '' });
    } else {
      b.codes.forEach(c => {
        rows.push({ 类型: '品牌', 品牌: b.name, 故障码: c.code, 定义: c.definition });
      });
    }
  });
  ['favorites', 'experiences', 'debug'].forEach(key => {
    (window.appData[key] || []).forEach(item => {
      rows.push({ 类型: key, 品牌: item.title, 故障码: '', 定义: item.content });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '电梯维修数据');

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${appName}_${date}.xlsx`;

  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
      const result = await window.Capacitor.Plugins.Filesystem.writeFile({
        path: fileName, data: wbout, directory: 'CACHE'
      });
      if (window.Capacitor.Plugins.Share) {
        await window.Capacitor.Plugins.Share.share({
          title: appName + ' - 数据导出',
          text: '数据备份文件',
          files: [result.uri]
        });
      } else {
        alert('文件已保存到：' + result.uri);
      }
    } else {
      XLSX.writeFile(wb, fileName);
    }
  } catch (err) {
    alert('❌ 导出失败：' + (err.message || err));
    console.error(err);
  }
}

/* ---------- Excel 导入（合并模式） ---------- */
function importExcel(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      const beforeBrands = window.appData.brands.length;
      const beforeCodes = window.appData.brands.reduce((s, b) => s + b.codes.length, 0);

      let addedBrands = 0, addedCodes = 0, updatedCodes = 0, addedItems = 0, updatedItems = 0;

      rows.forEach(row => {
        const type = (row['类型'] || '').toString().trim();
        const bName = (row['品牌'] || '').toString().trim();
        const code = row['故障码'] ? String(row['故障码']).trim() : '';
        const definition = row['定义'] ? String(row['定义']).trim() : '';

        if (type === '品牌') {
          if (!bName) return;
          let brand = window.appData.brands.find(b => (b.name || '').trim() === bName);
          if (!brand) {
            brand = { id: Date.now().toString() + Math.random(), name: bName, codes: [] };
            window.appData.brands.push(brand);
            addedBrands++;
          }
          if (code) {
            const existing = brand.codes.find(c => (c.code || '').trim() === code);
            if (existing) {
              if ((existing.definition || '').trim() !== definition) {
                existing.definition = definition;
                updatedCodes++;
              }
            } else {
              brand.codes.push({ id: Date.now().toString() + Math.random(), code, definition });
              addedCodes++;
            }
          }
        } else if (['favorites', 'experiences', 'debug'].includes(type)) {
          if (!bName) return;
          const existing = window.appData[type].find(i => (i.title || '').trim() === bName);
          if (existing) {
            if ((existing.content || '').trim() !== definition) {
              existing.content = definition;
              updatedItems++;
            }
          } else {
            window.appData[type].push({
              id: Date.now().toString() + Math.random(),
              title: bName, content: definition
            });
            addedItems++;
          }
        }
      });

      saveData();
      renderBrands();
      renderContentArea();

      const afterBrands = window.appData.brands.length;
      const afterCodes = window.appData.brands.reduce((s, b) => s + b.codes.length, 0);

      alert(
        `✅ 导入完成（合并模式）\n\n` +
        `【导入前】${beforeBrands} 个品牌 / ${beforeCodes} 个故障码\n` +
        `【导入后】${afterBrands} 个品牌 / ${afterCodes} 个故障码\n\n` +
        `新增品牌：${addedBrands}\n` +
        `新增故障码：${addedCodes}\n` +
        `更新故障码：${updatedCodes}\n` +
        `新增收藏/经验/调试：${addedItems}\n` +
        `更新收藏/经验/调试：${updatedItems}`
      );
    } catch (err) {
      alert('❌ 导入失败：' + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ---------- 事件绑定 ---------- */
function bindEvents() {
  bindSearch();

  document.getElementById('lockIcon').addEventListener('click', () => {
    if (isAdmin) alert('🔓 当前已是管理员模式');
    else showAdminModal();
  });

  document.getElementById('settingsIcon').addEventListener('click', openSettings);
  document.getElementById('settingsBack').onclick = closeSettings;

  document.getElementById('renameBtn').onclick = renameApp;
  document.getElementById('fontMinus').onclick = () => changeFontScale(-1);
  document.getElementById('fontPlus').onclick = () => changeFontScale(1);

  document.getElementById('exportBtn').onclick = exportExcel;
  document.getElementById('importBtn').onclick = () =>
    document.getElementById('importFile').click();
  document.getElementById('importFile').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (confirm('导入将与现有数据合并（同品牌同故障码以新文件为准），是否继续？')) {
      importExcel(file);
    }
    e.target.value = '';
  };

  document.getElementById('adminConfirm').onclick = verifyAdminPassword;
  document.getElementById('adminCancel').onclick = () =>
    document.getElementById('adminModal').classList.remove('show');

  document.getElementById('contentClose').onclick = () =>
    document.getElementById('contentModal').classList.remove('show');

  document.getElementById('addBtn').onclick = async () => {
    if (currentTab === 'brands') addBrand();
    else {
      const title = await showInput('添加标题', '请输入标题');
      if (!title) return;
      const content = await showInput('添加内容', '请输入内容') || '';
      const keyMap = { favorites: 'favorites', experience: 'experiences', debug: 'debug' };
      window.appData[keyMap[currentTab]].push({
        id: Date.now().toString(), title: title, content: content
      });
      saveData();
      renderContentArea();
    }
  };

  document.getElementById('backBtn').onclick = closeBrand;
  document.getElementById('addCodeBtn').onclick = addCode;

  const codeSearchInput = document.getElementById('codeSearchInput');
  if (codeSearchInput) {
    codeSearchInput.addEventListener('input', (e) => {
      renderCodeList(e.target.value.trim());
    });
  }

  document.querySelectorAll('.bottom-nav button').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
}

init();
