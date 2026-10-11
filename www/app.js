let isAdmin = false;
let currentTab = 'brands';
let currentBrandId = null;
let fontScale = 1;
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

async function init() {
  await loadData();
  await loadFontScale();
  renderBrands();
  bindEvents();
}

async function loadData() {
  let raw = await localforage.getItem('elevatorData');
  if (!raw) {
    raw = { brands: [], favorites: [], experiences: [], debug: [] };
  }
  window.appData = JSON.parse(JSON.stringify(raw));
  if (!window.appData.brands) window.appData.brands = [];
  if (!window.appData.favorites) window.appData.favorites = [];
  if (!window.appData.experiences) window.appData.experiences = [];
  if (!window.appData.debug) window.appData.debug = [];
}

async function saveData() {
  await localforage.setItem('elevatorData', window.appData);
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
  if (idx === -1) {
    newIdx = delta > 0 ? 3 : 2;
  } else {
    newIdx = Math.max(0, Math.min(FONT_STEPS.length - 1, idx + delta));
  }
  fontScale = FONT_STEPS[newIdx].scale;
  applyFontScale();
  await localforage.setItem('fontScale', fontScale);
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
    document.getElementById('addBtn').style.display = 'block';
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
    container.innerHTML = '<p style="text-align:center;color:#999;padding:30px;">暂无品牌，' +
      (isAdmin ? '点击右下角 + 添加' : '点击右上角锁图标解锁编辑') + '</p>';
    return;
  }
  container.innerHTML = brands.map(b => `
    <div class="brand-item" data-id="${b.id}">
      <span>${b.name} <small style="color:#999;">(${b.codes.length}个故障码)</small></span>
      <div class="item-actions">
        ${isAdmin ? `<button class="btn-edit" onclick="event.stopPropagation(); editBrand('${b.id}')">✏️</button>
                     <button class="btn-delete" onclick="event.stopPropagation(); deleteBrand('${b.id}')">🗑️</button>` : ''}
        <span class="arrow">›</span>
      </div>
    </div>
  `).join('');
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

/* ---------- 收藏/经验/调试 列表 ---------- */
function renderContentArea() {
  const area = document.getElementById('contentArea');
  if (currentTab === 'brands') { area.innerHTML = ''; return; }
  const keyMap = { favorites: 'favorites', experience: 'experiences', debug: 'debug' };
  const key = keyMap[currentTab];
  const items = (window.appData[key] || []).sort((a, b) =>
    a.title.localeCompare(b.title, 'zh', { numeric: true, sensitivity: 'base' }));
  if (items.length === 0) {
    area.innerHTML = `<p style="text-align:center;color:#999;padding:30px;">暂无内容</p>`;
    return;
  }
  area.innerHTML = items.map(item => `
    <div class="brand-item" data-id="${item.id}">
      <span>${item.title}</span>
      <div class="item-actions">
        ${isAdmin ? `<button class="btn-delete" onclick="event.stopPropagation(); deleteContent('${key}','${item.id}')">🗑️</button>` : ''}
        <span class="arrow">›</span>
      </div>
    </div>
  `).join('');
  area.querySelectorAll('.brand-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.item-actions')) return;
      openContentDetail(key, el.dataset.id);
    });
  });
}

function openContentDetail(key, id) {
  const item = window.appData[key].find(i => i.id === id);
  if (!item) return;

  document.getElementById('contentTitle').textContent = item.title;
  document.getElementById('contentBody').textContent = item.content || '（无内容）';

  const editBtn = document.getElementById('contentEditBtn');
  if (isAdmin) {
    editBtn.style.display = 'block';
    editBtn.onclick = () => {
      const newTitle = prompt('修改标题：', item.title);
      if (newTitle === null) return;
      const newContent = prompt('修改内容：', item.content);
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

function renderCodeList() {
  const brand = window.appData.brands.find(b => b.id === currentBrandId);
  if (!brand) return;
  const container = document.getElementById('codeList');
  if (brand.codes.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#999;padding:30px;">暂无故障码${isAdmin ? '，点击右上角添加' : ''}</p>`;
    return;
  }
  const sorted = [...brand.codes].sort((a, b) =>
    a.code.localeCompare(b.code, 'zh', { numeric: true, sensitivity: 'base' })
  );
  container.innerHTML = sorted.map(c => `
    <div class="brand-item">
      <div>
        <span style="font-weight:600;color:#d93025;">${c.code}</span>
        <p style="font-size:0.875rem;color:#555;margin-top:4px;">${c.definition}</p>
      </div>
      ${isAdmin ? `<div class="item-actions">
        <button class="btn-edit" onclick="editCode('${c.id}')">✏️</button>
        <button class="btn-delete" onclick="deleteCode('${c.id}')">🗑️</button>
      </div>` : ''}
    </div>
  `).join('');
}

function addCode() {
  const brand = window.appData.brands.find(b => b.id === currentBrandId);
  if (!brand) return;
  const code = prompt('请输入故障码（如 E01）：');
  if (!code) return;
  const definition = prompt('请输入故障定义：') || '';
  brand.codes.push({ id: Date.now().toString(), code, definition });
  saveData();
  renderCodeList();
}

function editCode(codeId) {
  const brand = window.appData.brands.find(b => b.id === currentBrandId);
  const c = brand.codes.find(x => x.id === codeId);
  if (!c) return;
  const newCode = prompt('修改故障码：', c.code);
  if (newCode === null) return;
  const newDef = prompt('修改故障定义：', c.definition);
  if (newDef === null) return;
  c.code = newCode;
  c.definition = newDef;
  saveData();
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

function addBrand() {
  const name = prompt('请输入品牌名称：');
  if (!name) return;
  window.appData.brands.push({ id: Date.now().toString(), name, codes: [] });
  saveData();
  renderBrands();
}

function editBrand(id) {
  const brand = window.appData.brands.find(b => b.id === id);
  if (!brand) return;
  const newName = prompt('修改品牌名称：', brand.name);
  if (newName && newName !== brand.name) {
    brand.name = newName;
    saveData();
    renderBrands();
  }
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
  const fileName = `电梯维修助手_${date}.xlsx`;

  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
      const result = await window.Capacitor.Plugins.Filesystem.writeFile({
        path: fileName,
        data: wbout,
        directory: 'CACHE'
      });

      if (window.Capacitor.Plugins.Share) {
        await window.Capacitor.Plugins.Share.share({
          title: '电梯维修助手 - 数据导出',
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

      let addedBrands = 0;
      let addedCodes = 0;
      let updatedCodes = 0;
      let addedItems = 0;
      let updatedItems = 0;

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
              brand.codes.push({
                id: Date.now().toString() + Math.random(),
                code,
                definition
              });
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
              title: bName,
              content: definition
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

  document.getElementById('addBtn').onclick = () => {
    if (currentTab === 'brands') addBrand();
    else {
      const title = prompt('请输入标题：');
      if (!title) return;
      const content = prompt('请输入内容：') || '';
      const keyMap = { favorites: 'favorites', experience: 'experiences', debug: 'debug' };
      window.appData[keyMap[currentTab]].push({
        id: Date.now().toString(), title, content
      });
      saveData();
      renderContentArea();
    }
  };

  document.getElementById('backBtn').onclick = closeBrand;
  document.getElementById('addCodeBtn').onclick = addCode;

  document.querySelectorAll('.bottom-nav button').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
}

init();
