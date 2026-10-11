// api.js ฉบับกลาง ใช้ร่วมกันทุกหน้า Frontend
const API_BASE_URL = 'https://sarinyapanich-api.onrender.com/api';

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('accessToken');
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `เรียก API ไม่สำเร็จ (${response.status})`);
  }

  return data;
}

// ===== สินค้า =====
async function getProducts({ search = '', category = '' } = {}) {
  const params = new URLSearchParams();

  if (search.trim()) params.set('search', search.trim());
  if (category && category !== 'all') params.set('category', category);

  const query = params.toString();
  const data = await apiRequest(`/products${query ? `?${query}` : ''}`);

  return data.products || [];
}

async function getProduct(productId) {
  const data = await apiRequest(`/products/${productId}`);
  return data.product;
}

// ===== Session ผู้ใช้ =====
function saveSession(data) {
  localStorage.setItem('accessToken', data.token);
  localStorage.setItem('currentUser', JSON.stringify(data.user));
}

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('currentUser');
}

function isLoggedIn() {
  return Boolean(localStorage.getItem('accessToken'));
}

function requireLogin() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

async function getProfile() {
  const data = await apiRequest('/auth/me');
  return data.user;
}

async function updateProfile(profile) {
  const data = await apiRequest('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(profile)
  });
  localStorage.setItem('currentUser', JSON.stringify(data.user));
  return data.user;
}

// ===== ตะกร้า =====
async function getCart() {
  const data = await apiRequest('/cart');
  return data.items || [];
}

async function updateCartItem(productId, quantity) {
  return apiRequest(`/cart/items/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity })
  });
}

async function deleteCartItem(productId) {
  return apiRequest(`/cart/items/${productId}`, {
    method: 'DELETE'
  });
}

// ===== คำสั่งซื้อ =====
async function createOrder(address, paymentMethod = 'QR Code PromptPay') {
  return apiRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({ address, paymentMethod })
  });
}

async function getOrders() {
  const data = await apiRequest('/orders');
  return data.orders || [];
}

// ===== Utility =====
function formatBaht(value) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}
