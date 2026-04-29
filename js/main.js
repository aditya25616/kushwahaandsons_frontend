/**
 * js/main.js  –  Shared utilities for all public pages
 * Handles: API base URL, toast, navbar toggle, hero stats
 */

// ── API Base URL ─────────────────────────────────────────────────────────────
// Connected to deployed backend on Render
const API_BASE = 'https://kushwahaandsons.onrender.com/api';

// ── Toast Notification ───────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon= document.getElementById('toastIcon');

  if (!toast) return;

  toastMsg.textContent = message;
  toastIcon.innerHTML = type === 'success'
    ? '<i class="fa-solid fa-circle-check"></i>'
    : '<i class="fa-solid fa-circle-xmark"></i>';
  toast.className = `toast toast-${type} show`;

  setTimeout(() => { toast.classList.remove('show'); }, 4000);
}

// ── Navbar Mobile Toggle ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  // ── Hero Page: Featured Products ─────────────────────────────────────────
  const featuredGrid = document.getElementById('featuredProducts');
  if (featuredGrid) {
    loadFeaturedProducts(featuredGrid);
  }

  // ── Hero Live Stats ───────────────────────────────────────────────────────
  const liveOrders    = document.getElementById('liveOrders');
  const liveProducts  = document.getElementById('liveProducts');
  const liveClients   = document.getElementById('liveClients');
  const liveEmployees = document.getElementById('liveEmployees');

  if (liveOrders) {
    fetch(`${API_BASE}/stats`)
      .then(r => r.json())
      .then(data => {
        liveOrders.textContent    = data.totalOrders    ?? '—';
        liveProducts.textContent  = data.totalProducts  ?? '—';
        liveClients.textContent   = data.totalClients   ?? '—';
        liveEmployees.textContent = data.totalEmployees ?? '—';
      })
      .catch(() => {
        [liveOrders, liveProducts, liveClients, liveEmployees]
          .forEach(el => { if (el) el.textContent = '—'; });
      });
  }
});

// ── Load 3 Featured Products on Homepage ─────────────────────────────────────
async function loadFeaturedProducts(grid) {
  const iconMap = {
    'Fasteners':      '<i class="fa-solid fa-screwdriver-wrench"></i>',
    'Mechanical':     '<i class="fa-solid fa-gear"></i>',
    'Sealing':        '<i class="fa-solid fa-circle-dot"></i>',
    'Metal Profiles': '<i class="fa-solid fa-building-columns"></i>',
    'Hydraulics':     '<i class="fa-solid fa-droplet"></i>',
    'Piping':         '<i class="fa-solid fa-pipe-section"></i>'
  };

  try {
    const res      = await fetch(`${API_BASE}/products?active=true`);
    const products = await res.json();
    const featured = products.slice(0, 3);

    if (!featured.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p>No products found.</p></div>`;
      return;
    }

    grid.innerHTML = featured.map(p => `
      <div class="product-card">
        <div class="product-img">${iconMap[p.category] || '<i class="fa-solid fa-industry"></i>'}</div>
        <div class="product-body">
          <div class="product-category">${p.category || 'General'}</div>
          <div class="product-name">${p.name}</div>
          <p class="product-desc">${p.description || ''}</p>
          <div class="product-footer">
            <div>
              <div class="product-price">₹${p.price.toLocaleString('en-IN')}</div>
              <div class="product-unit">per ${p.unit}</div>
            </div>
            <a href="contact.html?product=${encodeURIComponent(p.name)}" class="btn btn-primary btn-sm">Enquire</a>
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <p>Could not load products. Ensure the backend is running on port 5000.</p>
    </div>`;
  }
}

// ── Format currency ───────────────────────────────────────────────────────────
function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

// ── Format date ───────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}