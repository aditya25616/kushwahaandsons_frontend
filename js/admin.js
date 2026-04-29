/**
 * js/admin.js  –  Admin Dashboard Logic
 * Handles: auth, all CRUD operations, page switching, modals
 */

// ── State ─────────────────────────────────────────────────────────────────────
let authToken = localStorage.getItem('adminToken') || null;
let allClients = [];
let allOrders = [];
let allProducts = [];
let allMaterials = [];
let allEmployees = [];
let currentOrderItems = [];  // Items for the order being created

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set topbar date
  const dateEl = document.getElementById('topbarDate');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  // Set today as default attendance date
  const attDateEl = document.getElementById('attendanceDate');
  if (attDateEl) attDateEl.value = new Date().toISOString().split('T')[0];

  if (authToken) {
    verifyAndBoot();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  const text = document.getElementById('loginText');
  const spinner = document.getElementById('loginSpinner');

  if (!username || !password) {
    errEl.textContent = 'Please enter credentials.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  text.textContent = 'Signing in…';
  spinner.style.display = 'inline-block';
  errEl.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      authToken = data.token;
      localStorage.setItem('adminToken', authToken);
      document.getElementById('loginScreen').style.display = 'none';
      bootApp(data.username);
    } else {
      errEl.textContent = data.message || 'Login failed.';
      errEl.style.display = 'block';
    }
  } catch {
    errEl.textContent = 'Server error. Is the backend running?';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    text.textContent = 'Sign In';
    spinner.style.display = 'none';
  }
}

async function verifyAndBoot() {
  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.valid) {
      document.getElementById('loginScreen').style.display = 'none';
      bootApp(data.user.username);
    } else {
      doLogout();
    }
  } catch { doLogout(); }
}

function bootApp(username) {
  document.getElementById('app').style.display = 'block';
  document.getElementById('sidebarUser').textContent = username;
  document.getElementById('adminAvatar').textContent = username[0].toUpperCase();
  loadDashboard();
}

function doLogout() {
  localStorage.removeItem('adminToken');
  authToken = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

// Allow Enter key on login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') doLogin();
});

// ── Navigation ─────────────────────────────────────────────────────────────────
const pageTitles = { dashboard: 'Dashboard', clients: 'Clients', orders: 'Orders', products: 'Products', materials: 'Raw Materials', employees: 'Employees', attendance: 'Attendance' };
const pageLoaders = { clients: loadClients, orders: loadOrders, products: loadProducts, materials: loadMaterials, employees: loadEmployees, attendance: loadAttendance };

function showPage(page) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`)?.classList.add('active');
  document.getElementById('topbarTitle').textContent = pageTitles[page] || page;
  if (pageLoaders[page]) pageLoaders[page]();
}

// ── Modal Helpers ─────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ── Auth Header ───────────────────────────────────────────────────────────────
function authHeader() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` };
}

// ── Status Badge Helpers ──────────────────────────────────────────────────────
const orderStatusClass = { pending: 'badge-amber', confirmed: 'badge-blue', 'in-production': 'badge-purple', shipped: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red' };
const paymentClass = { unpaid: 'badge-red', partial: 'badge-amber', paid: 'badge-green' };
const clientStatusClass = { active: 'badge-green', inactive: 'badge-red', prospect: 'badge-amber' };
const deptColor = { production: 'badge-blue', quality: 'badge-green', logistics: 'badge-purple', admin: 'badge-amber', maintenance: 'badge-red', sales: 'badge-blue' };

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/stats`, { headers: authHeader() });
    const data = await res.json();

    document.getElementById('statRevenue').textContent = '₹' + (data.totalRevenue || 0).toLocaleString('en-IN');
    document.getElementById('statOrders').textContent = data.totalOrders || 0;
    document.getElementById('statClients').textContent = data.totalClients || 0;
    document.getElementById('statEmployees').textContent = data.totalEmployees || 0;

    // Recent orders table
    const tbody = document.getElementById('recentOrdersBody');
    if (!data.recentOrders?.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center;padding:24px;">No orders yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.recentOrders.map(o => `
      <tr>
        <td><span class="mono text-accent">${o.orderNumber}</span></td>
        <td>${o.client?.name || '—'}</td>
        <td class="fw-600">₹${o.totalAmount.toLocaleString('en-IN')}</td>
        <td><span class="badge ${orderStatusClass[o.status] || 'badge-gray'}">${o.status}</span></td>
        <td class="text-muted">${formatDate(o.createdAt)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Dashboard load failed:', err);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════════════════════════════════════
async function loadClients() {
  const tbody = document.getElementById('clientsTableBody');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;"><div class="spinner"></div></td></tr>`;
  try {
    const res = await fetch(`${API_BASE}/clients`, { headers: authHeader() });
    allClients = await res.json();
    renderClients(allClients);
  } catch { tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align:center;padding:24px;">Failed to load clients.</td></tr>`; }
}

function renderClients(list) {
  const tbody = document.getElementById('clientsTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-users"></i></div><p>No clients found.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr>
      <td class="fw-600">${c.name}</td>
      <td>${c.email}</td>
      <td>${c.phone || '—'}</td>
      <td>${c.company || '—'}</td>
      <td><span class="badge ${clientStatusClass[c.status] || 'badge-gray'}">${c.status}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editClient('${c._id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteClient('${c._id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function filterClients() {
  const q = document.getElementById('clientSearch').value.toLowerCase();
  renderClients(allClients.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q) ||
    (c.company || '').toLowerCase().includes(q)
  ));
}

function editClient(id) {
  const c = allClients.find(x => x._id === id);
  if (!c) return;
  document.getElementById('clientModalTitle').textContent = 'Edit Client';
  document.getElementById('clientId').value = c._id;
  document.getElementById('cName').value = c.name;
  document.getElementById('cEmail').value = c.email;
  document.getElementById('cPhone').value = c.phone || '';
  document.getElementById('cCompany').value = c.company || '';
  document.getElementById('cStatus').value = c.status;
  document.getElementById('cMessage').value = c.message || '';
  openModal('clientModal');
}

async function saveClient() {
  const id = document.getElementById('clientId').value;
  const body = {
    name: document.getElementById('cName').value.trim(),
    email: document.getElementById('cEmail').value.trim(),
    phone: document.getElementById('cPhone').value.trim(),
    company: document.getElementById('cCompany').value.trim(),
    status: document.getElementById('cStatus').value,
    message: document.getElementById('cMessage').value.trim()
  };
  if (!body.name || !body.email) { showToast('Name and email are required.', 'error'); return; }

  try {
    const url = id ? `${API_BASE}/clients/${id}` : `${API_BASE}/clients`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
    if (res.ok) {
      showToast(id ? 'Client updated!' : 'Client added!', 'success');
      closeModal('clientModal');
      document.getElementById('clientId').value = '';
      document.getElementById('clientModalTitle').textContent = 'Add Client';
      loadClients();
    } else {
      const d = await res.json();
      showToast(d.message || 'Save failed.', 'error');
    }
  } catch { showToast('Network error.', 'error'); }
}

async function deleteClient(id) {
  if (!confirm('Delete this client?')) return;
  try {
    await fetch(`${API_BASE}/clients/${id}`, { method: 'DELETE', headers: authHeader() });
    showToast('Client deleted.', 'success');
    loadClients();
  } catch { showToast('Delete failed.', 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ══════════════════════════════════════════════════════════════════════════════
async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;"><div class="spinner"></div></td></tr>`;
  try {
    const res = await fetch(`${API_BASE}/orders`, { headers: authHeader() });
    allOrders = await res.json();
    renderOrders(allOrders);
  } catch { tbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:24px;">Failed to load orders.</td></tr>`; }
}

function renderOrders(list) {
  const tbody = document.getElementById('ordersTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-box-open"></i></div><p>No orders found.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(o => `
    <tr>
      <td><span class="mono text-accent">${o.orderNumber}</span></td>
      <td>${o.client?.name || '—'}</td>
      <td class="fw-600">₹${o.totalAmount.toLocaleString('en-IN')}</td>
      <td><span class="badge ${orderStatusClass[o.status] || 'badge-gray'}">${o.status}</span></td>
      <td><span class="badge ${paymentClass[o.paymentStatus] || 'badge-gray'}">${o.paymentStatus}</span></td>
      <td class="text-muted">${formatDate(o.createdAt)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editOrder('${o._id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteOrder('${o._id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function filterOrders() {
  const q = document.getElementById('orderSearch').value.toLowerCase();
  const st = document.getElementById('orderStatusFilter').value;
  renderOrders(allOrders.filter(o =>
    (!q || o.orderNumber.toLowerCase().includes(q) || (o.client?.name || '').toLowerCase().includes(q)) &&
    (!st || o.status === st)
  ));
}

async function addNewOrder() {
  if (!allClients.length) {
    try {
      const res = await fetch(`${API_BASE}/clients`, { headers: authHeader() });
      allClients = await res.json();
    } catch { showToast('Failed to load clients.', 'error'); return; }
  }

  document.getElementById('orderModalTitle').textContent = 'Add New Order';
  document.getElementById('orderModalBtn').textContent = 'Create Order';
  document.getElementById('orderId').value = '';
  document.getElementById('oClient').value = '';
  document.getElementById('oDeliveryDate').value = '';
  document.getElementById('oNotes').value = '';
  document.getElementById('oProdName').value = '';
  document.getElementById('oProdQty').value = '';
  document.getElementById('oProdPrice').value = '';

  currentOrderItems = [];  // Reset items

  const clientSel = document.getElementById('oClient');
  clientSel.innerHTML = '<option value="">-- Select Client --</option>' +
    allClients.map(c => `<option value="${c._id}">${c.name}</option>`).join('');

  renderOrderItems();
  document.getElementById('newOrderFields').style.display = 'block';
  document.getElementById('editOrderFields').style.display = 'none';

  openModal('orderModal');
}

function editOrder(id) {
  const o = allOrders.find(x => x._id === id);
  if (!o) return;

  document.getElementById('orderModalTitle').textContent = 'Update Order Status';
  document.getElementById('orderModalBtn').textContent = 'Update Order';
  document.getElementById('orderId').value = o._id;
  document.getElementById('oStatus').value = o.status;
  document.getElementById('oPayment').value = o.paymentStatus;
  document.getElementById('oNotes').value = o.notes || '';

  const clientSel = document.getElementById('oClient');
  clientSel.innerHTML = `<option value="${o.client?._id}">${o.client?.name || 'Unknown'}</option>`;

  document.getElementById('newOrderFields').style.display = 'none';
  document.getElementById('editOrderFields').style.display = 'block';

  openModal('orderModal');
}

// Add item to current order
function addOrderItem() {
  const productName = document.getElementById('oProdName').value.trim();
  const quantity = parseInt(document.getElementById('oProdQty').value) || 0;
  const unitPrice = parseFloat(document.getElementById('oProdPrice').value) || 0;

  if (!productName || quantity <= 0 || unitPrice < 0) {
    showToast('Enter product name, quantity, and price.', 'error');
    return;
  }

  // Add to items (no product ID needed, just the name)
  currentOrderItems.push({
    productName: productName,
    quantity: quantity,
    unitPrice: unitPrice
  });

  // Reset inputs
  document.getElementById('oProdName').value = '';
  document.getElementById('oProdQty').value = '';
  document.getElementById('oProdPrice').value = '';

  renderOrderItems();
  showToast(`${productName} added to order.`, 'success');
}

// Remove item from current order
function removeOrderItem(index) {
  if (index >= 0 && index < currentOrderItems.length) {
    currentOrderItems.splice(index, 1);
    renderOrderItems();
    showToast('Item removed.', 'success');
  }
}

// Render items list
function renderOrderItems() {
  const container = document.getElementById('orderItemsList');

  if (currentOrderItems.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:6px;">No items added yet (optional)</div>';
    return;
  }

  let html = '<div style="font-size:0.85rem;">';
  currentOrderItems.forEach((item, idx) => {
    const subtotal = (item.quantity * item.unitPrice).toFixed(2);
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div>
          <div style="font-weight:500;">${item.productName}</div>
          <div style="color:var(--text-muted); font-size:0.8rem;">Qty: ${item.quantity} × ₹${item.unitPrice.toFixed(2)} = ₹${subtotal}</div>
        </div>
        <button class="btn btn-sm" onclick="removeOrderItem(${idx})" style="padding:4px 8px; font-size:0.8rem; background:rgba(255,59,48,0.1); color:#ff3b30;">Remove</button>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

async function saveOrder() {
  const id = document.getElementById('orderId').value;
  const isNewOrder = !id;

  if (isNewOrder) {
    // Creating new order
    const clientId = document.getElementById('oClient').value.trim();
    const deliveryDate = document.getElementById('oDeliveryDate').value;

    if (!clientId) {
      showToast('Client is required.', 'error');
      return;
    }

    const body = { client: clientId, items: currentOrderItems, deliveryDate, notes: document.getElementById('oNotes').value };
    try {
      const res = await fetch(`${API_BASE}/orders`, { method: 'POST', headers: authHeader(), body: JSON.stringify(body) });
      if (res.ok) {
        showToast('Order created!', 'success');
        closeModal('orderModal');
        currentOrderItems = [];
        loadOrders(); loadDashboard();
      } else {
        const d = await res.json();
        showToast(d.message || 'Create failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
  } else {
    // Updating existing order
    const body = {
      status: document.getElementById('oStatus').value,
      paymentStatus: document.getElementById('oPayment').value,
      notes: document.getElementById('oNotes').value
    };
    try {
      const res = await fetch(`${API_BASE}/orders/${id}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify(body) });
      if (res.ok) {
        showToast('Order updated!', 'success');
        closeModal('orderModal');
        loadOrders(); loadDashboard();
      } else {
        showToast('Update failed.', 'error');
      }
    } catch { showToast('Network error.', 'error'); }
  }
}

async function deleteOrder(id) {
  if (!confirm('Delete this order?')) return;
  try {
    await fetch(`${API_BASE}/orders/${id}`, { method: 'DELETE', headers: authHeader() });
    showToast('Order deleted.', 'success');
    loadOrders(); loadDashboard();
  } catch { showToast('Delete failed.', 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ══════════════════════════════════════════════════════════════════════════════
async function loadProducts() {
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;"><div class="spinner"></div></td></tr>`;
  try {
    const res = await fetch(`${API_BASE}/products`, { headers: authHeader() });
    allProducts = await res.json();
    renderProducts(allProducts);
  } catch { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;" class="text-muted">Failed to load.</td></tr>`; }
}

function renderProducts(list) {
  const tbody = document.getElementById('productsTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-cubes"></i></div><p>No products found.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><span class="mono" style="font-size:0.8rem; color:var(--text-muted);">${p.sku}</span></td>
      <td class="fw-600">${p.name}</td>
      <td>${p.category || '—'}</td>
      <td class="fw-600 text-accent">₹${p.price.toLocaleString('en-IN')}</td>
      <td><span class="badge ${p.stock > 50 ? 'badge-green' : p.stock > 0 ? 'badge-amber' : 'badge-red'}">${p.stock}</span></td>
      <td>${p.unit}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editProduct('${p._id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteProduct('${p._id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function editProduct(id) {
  const p = allProducts.find(x => x._id === id);
  if (!p) return;
  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('productId').value = p._id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pUnit').value = p.unit;
  document.getElementById('pStock').value = p.stock;
  document.getElementById('pMoq').value = p.minOrderQty;
  document.getElementById('pDesc').value = p.description || '';
  openModal('productModal');
}

async function saveProduct() {
  const id = document.getElementById('productId').value;
  const body = {
    name: document.getElementById('pName').value.trim(),
    category: document.getElementById('pCategory').value.trim(),
    price: Number(document.getElementById('pPrice').value),
    unit: document.getElementById('pUnit').value.trim() || 'piece',
    stock: Number(document.getElementById('pStock').value) || 0,
    minOrderQty: Number(document.getElementById('pMoq').value) || 1,
    description: document.getElementById('pDesc').value.trim()
  };
  if (!body.name || !body.price) { showToast('Name and price are required.', 'error'); return; }

  try {
    const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
    if (res.ok) {
      showToast(id ? 'Product updated!' : 'Product added!', 'success');
      closeModal('productModal');
      document.getElementById('productId').value = '';
      document.getElementById('productModalTitle').textContent = 'Add Product';
      ['pName', 'pCategory', 'pPrice', 'pUnit', 'pStock', 'pMoq', 'pDesc'].forEach(f => document.getElementById(f).value = '');
      loadProducts();
    } else {
      const d = await res.json();
      showToast(d.message || 'Save failed.', 'error');
    }
  } catch { showToast('Network error.', 'error'); }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE', headers: authHeader() });
    showToast('Product deleted.', 'success');
    loadProducts();
  } catch { showToast('Delete failed.', 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// MATERIALS
// ══════════════════════════════════════════════════════════════════════════════
async function loadMaterials() {
  const tbody = document.getElementById('materialsTableBody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;"><div class="spinner"></div></td></tr>`;
  try {
    const res = await fetch(`${API_BASE}/materials`, { headers: authHeader() });
    allMaterials = await res.json();
    tbody.innerHTML = allMaterials.map(m => {
      const isLow = m.currentStock <= m.minimumStock;
      return `
        <tr>
          <td class="fw-600">${m.name}</td>
          <td>${m.category || '—'}</td>
          <td>${m.supplier || '—'}</td>
          <td><span class="mono fw-600">${m.currentStock} ${m.unit}</span></td>
          <td class="text-muted">${m.minimumStock} ${m.unit}</td>
          <td>₹${m.costPerUnit}</td>
          <td><span class="badge ${isLow ? 'badge-red' : 'badge-green'}">${isLow ? '<i class="fa-solid fa-triangle-exclamation"></i> Low' : 'OK'}</span></td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="editMaterial('${m._id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteMaterial('${m._id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-pallet"></i></div><p>No materials.</p></div></td></tr>`;
  } catch { tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:24px;">Failed to load.</td></tr>`; }
}

function editMaterial(id) {
  const m = allMaterials.find(x => x._id === id);
  if (!m) return;
  document.getElementById('materialModalTitle').textContent = 'Edit Material';
  document.getElementById('materialId').value = m._id;
  document.getElementById('mName').value = m.name;
  document.getElementById('mCategory').value = m.category || '';
  document.getElementById('mSupplier').value = m.supplier || '';
  document.getElementById('mUnit').value = m.unit;
  document.getElementById('mStock').value = m.currentStock;
  document.getElementById('mMinStock').value = m.minimumStock;
  document.getElementById('mCost').value = m.costPerUnit;
  openModal('materialModal');
}

async function saveMaterial() {
  const id = document.getElementById('materialId').value;
  const body = {
    name: document.getElementById('mName').value.trim(),
    category: document.getElementById('mCategory').value.trim(),
    supplier: document.getElementById('mSupplier').value.trim(),
    unit: document.getElementById('mUnit').value.trim() || 'kg',
    currentStock: Number(document.getElementById('mStock').value) || 0,
    minimumStock: Number(document.getElementById('mMinStock').value) || 0,
    costPerUnit: Number(document.getElementById('mCost').value) || 0
  };
  if (!body.name) { showToast('Material name is required.', 'error'); return; }

  try {
    const url = id ? `${API_BASE}/materials/${id}` : `${API_BASE}/materials`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
    if (res.ok) {
      showToast(id ? 'Material updated!' : 'Material added!', 'success');
      closeModal('materialModal');
      document.getElementById('materialId').value = '';
      document.getElementById('materialModalTitle').textContent = 'Add Material';
      loadMaterials();
    } else {
      showToast('Save failed.', 'error');
    }
  } catch { showToast('Network error.', 'error'); }
}

async function deleteMaterial(id) {
  if (!confirm('Delete this material?')) return;
  try {
    await fetch(`${API_BASE}/materials/${id}`, { method: 'DELETE', headers: authHeader() });
    showToast('Material deleted.', 'success');
    loadMaterials();
  } catch { showToast('Delete failed.', 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEES
// ══════════════════════════════════════════════════════════════════════════════
async function loadEmployees() {
  const tbody = document.getElementById('employeesTableBody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;"><div class="spinner"></div></td></tr>`;
  try {
    const res = await fetch(`${API_BASE}/employees`, { headers: authHeader() });
    allEmployees = await res.json();
    tbody.innerHTML = allEmployees.map(e => `
      <tr>
        <td><span class="mono text-accent" style="font-size:0.82rem;">${e.employeeId}</span></td>
        <td class="fw-600">${e.name}</td>
        <td><span class="badge ${deptColor[e.department] || 'badge-gray'}">${e.department}</span></td>
        <td>${e.designation || '—'}</td>
        <td>${e.phone || '—'}</td>
        <td>₹${(e.salary || 0).toLocaleString('en-IN')}</td>
        <td><span class="badge ${e.isActive ? 'badge-green' : 'badge-red'}">${e.isActive ? 'Active' : 'Inactive'}</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editEmployee('${e._id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteEmployee('${e._id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-id-badge"></i></div><p>No employees.</p></div></td></tr>`;
  } catch { tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:24px;">Failed to load.</td></tr>`; }
}

function editEmployee(id) {
  const e = allEmployees.find(x => x._id === id);
  if (!e) return;
  document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
  document.getElementById('employeeId').value = e._id;
  document.getElementById('eName').value = e.name;
  document.getElementById('eEmail').value = e.email || '';
  document.getElementById('ePhone').value = e.phone || '';
  document.getElementById('eDept').value = e.department;
  document.getElementById('eDesig').value = e.designation || '';
  document.getElementById('eSalary').value = e.salary || '';
  openModal('employeeModal');
}

async function saveEmployee() {
  const id = document.getElementById('employeeId').value;
  const body = {
    name: document.getElementById('eName').value.trim(),
    email: document.getElementById('eEmail').value.trim(),
    phone: document.getElementById('ePhone').value.trim(),
    department: document.getElementById('eDept').value,
    designation: document.getElementById('eDesig').value.trim(),
    salary: Number(document.getElementById('eSalary').value) || 0
  };
  if (!body.name) { showToast('Name is required.', 'error'); return; }

  try {
    const url = id ? `${API_BASE}/employees/${id}` : `${API_BASE}/employees`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(body) });
    if (res.ok) {
      showToast(id ? 'Employee updated!' : 'Employee added!', 'success');
      closeModal('employeeModal');
      document.getElementById('employeeId').value = '';
      document.getElementById('employeeModalTitle').textContent = 'Add Employee';
      loadEmployees();
    } else {
      showToast('Save failed.', 'error');
    }
  } catch { showToast('Network error.', 'error'); }
}

async function deleteEmployee(id) {
  if (!confirm('Delete this employee?')) return;
  try {
    await fetch(`${API_BASE}/employees/${id}`, { method: 'DELETE', headers: authHeader() });
    showToast('Employee deleted.', 'success');
    loadEmployees();
  } catch { showToast('Delete failed.', 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE
// ══════════════════════════════════════════════════════════════════════════════
async function loadAttendance() {
  const tbody = document.getElementById('attendanceTableBody');
  const summary = document.getElementById('attendanceSummary');
  const dateVal = document.getElementById('attendanceDate').value;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;"><div class="spinner"></div></td></tr>`;

  try {
    // Load today summary
    const sumRes = await fetch(`${API_BASE}/attendance/today`, { headers: authHeader() });
    const sumData = await sumRes.json();
    summary.innerHTML = `
      <div class="stat-card"><div class="stat-icon green"><i class="fa-solid fa-check"></i></div><div class="stat-info"><div class="stat-val">${sumData.present || 0}</div><div class="stat-label">Present Today</div></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:rgba(239,68,68,0.15);"><i class="fa-solid fa-xmark"></i></div><div class="stat-info"><div class="stat-val">${sumData.absent || 0}</div><div class="stat-label">Absent Today</div></div></div>
      <div class="stat-card"><div class="stat-icon amber"><i class="fa-regular fa-clock"></i></div><div class="stat-info"><div class="stat-val">${sumData.halfDay || 0}</div><div class="stat-label">Half Day</div></div></div>
      <div class="stat-card"><div class="stat-icon blue"><i class="fa-solid fa-umbrella-beach"></i></div><div class="stat-info"><div class="stat-val">${sumData.onLeave || 0}</div><div class="stat-label">On Leave</div></div></div>
    `;

    // Load filtered attendance
    const url = dateVal
      ? `${API_BASE}/attendance?from=${dateVal}&to=${dateVal}`
      : `${API_BASE}/attendance`;
    const res = await fetch(url, { headers: authHeader() });
    const records = await res.json();

    const attStatusClass = { present: 'badge-green', absent: 'badge-red', 'half-day': 'badge-amber', leave: 'badge-blue', holiday: 'badge-purple' };

    tbody.innerHTML = records.length ? records.map(r => `
      <tr>
        <td class="fw-600">${r.employee?.name || '—'}</td>
        <td>${r.employee?.department || '—'}</td>
        <td class="text-muted">${formatDate(r.date)}</td>
        <td><span class="badge ${attStatusClass[r.status] || 'badge-gray'}">${r.status}</span></td>
        <td>${r.checkIn || '—'}</td>
        <td>${r.checkOut || '—'}</td>
        <td><span class="mono">${r.hoursWorked || 0}h</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteAttendance('${r._id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-calendar-check"></i></div><p>No records found.</p></div></td></tr>`;
  } catch { tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:24px;">Failed to load.</td></tr>`; }

  // Populate employee dropdown for attendance modal
  if (!allEmployees.length) {
    const res = await fetch(`${API_BASE}/employees`, { headers: authHeader() });
    allEmployees = await res.json();
  }
  const sel = document.getElementById('attEmployee');
  sel.innerHTML = allEmployees.map(e => `<option value="${e._id}">${e.name} (${e.employeeId})</option>`).join('');

  // Set default date for attendance modal
  document.getElementById('attDate').value = new Date().toISOString().split('T')[0];
}

async function saveAttendance() {
  const checkIn = document.getElementById('attCheckIn').value;
  const checkOut = document.getElementById('attCheckOut').value;
  let hoursWorked = 0;
  if (checkIn && checkOut) {
    const [h1, m1] = checkIn.split(':').map(Number);
    const [h2, m2] = checkOut.split(':').map(Number);
    hoursWorked = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    if (hoursWorked < 0) hoursWorked = 0;
  }

  const body = {
    employee: document.getElementById('attEmployee').value,
    date: document.getElementById('attDate').value,
    status: document.getElementById('attStatus').value,
    checkIn,
    checkOut,
    hoursWorked: Math.round(hoursWorked * 100) / 100
  };

  try {
    const res = await fetch(`${API_BASE}/attendance`, { method: 'POST', headers: authHeader(), body: JSON.stringify(body) });
    if (res.ok) {
      showToast('Attendance marked!', 'success');
      closeModal('attendanceModal');
      loadAttendance();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed to mark attendance.', 'error');
    }
  } catch { showToast('Network error.', 'error'); }
}

async function deleteAttendance(id) {
  if (!confirm('Delete this record?')) return;
  try {
    await fetch(`${API_BASE}/attendance/${id}`, { method: 'DELETE', headers: authHeader() });
    showToast('Record deleted.', 'success');
    loadAttendance();
  } catch { showToast('Delete failed.', 'error'); }
}