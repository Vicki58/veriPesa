// VeriPesa Shared Client JavaScript App Engine

const API_BASE = '/api';

// Toast notifications
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Token and auth operations
function saveSession(token, vendor) {
  localStorage.setItem('vp_token', token);
  localStorage.setItem('vp_vendor', JSON.stringify(vendor));
}

function getSessionToken() {
  return localStorage.getItem('vp_token');
}

function getVendorInfo() {
  try {
    return JSON.parse(localStorage.getItem('vp_vendor'));
  } catch (e) {
    return null;
  }
}

function logout() {
  localStorage.removeItem('vp_token');
  localStorage.removeItem('vp_vendor');
  window.location.href = 'index.html';
}

// Generic API fetch wrapper
async function apiCall(endpoint, options = {}) {
  const token = getSessionToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers
  };
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    
    // For 204 no content responses
    if (response.status === 204) {
      return null;
    }

    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('vp_token');
        localStorage.removeItem('vp_vendor');
        window.location.href = 'index.html';
      }
      throw new Error(data.error || 'Request failed.');
    }
    
    return data;
  } catch (error) {
    console.error(`API Call failed to ${endpoint}:`, error);
    throw error;
  }
}

// Route Guard
function checkAuth(isAuthPage = false) {
  const token = getSessionToken();
  
  if (!token && !isAuthPage) {
    window.location.href = 'index.html';
  } else if (token && isAuthPage) {
    window.location.href = 'dashboard.html';
  }
}

// Populate Vendor Profile Snippets in Sidebar dynamically
function setupSidebarProfile() {
  const vendor = getVendorInfo();
  if (!vendor) return;
  
  const nameEl = document.querySelector('.vendor-name-snippet');
  const tillEl = document.querySelector('.vendor-till-snippet');
  const avatarEl = document.querySelector('.avatar');
  
  if (nameEl) nameEl.innerText = vendor.business_name || 'Vendor';
  if (tillEl) tillEl.innerText = vendor.till_number ? `Till: ${vendor.till_number}` : 'Till: 174379 (Sandbox)';
  if (avatarEl && vendor.business_name) {
    avatarEl.innerText = vendor.business_name.charAt(0).toUpperCase();
  }
}

// Theme Management Engine
function setupThemeToggle() {
  const activeTheme = localStorage.getItem('vp_theme') || 'dark';
  const pathname = window.location.pathname;
  const isAuthPage = pathname.endsWith('index.html') || pathname.endsWith('/') || pathname === '';

  if (!isAuthPage) {
    const sidebarFooter = document.querySelector('.sidebar-footer');
    if (sidebarFooter) {
      const toggleContainer = document.createElement('div');
      toggleContainer.style.marginBottom = '12px';
      toggleContainer.innerHTML = `
        <button class="btn btn-secondary" id="themeToggleBtn" onclick="toggleTheme()" style="padding: 10px; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span id="themeBtnIcon">${activeTheme === 'light' ? '🌙' : '☀️'}</span> 
          <span id="themeBtnText">${activeTheme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>
      `;
      sidebarFooter.insertBefore(toggleContainer, sidebarFooter.firstChild);
    }
  } else {
    // Inject floating button in auth screen
    const floatingToggle = document.createElement('button');
    floatingToggle.id = 'themeToggleBtn';
    floatingToggle.className = 'badge';
    floatingToggle.style.position = 'fixed';
    floatingToggle.style.top = '20px';
    floatingToggle.style.right = '20px';
    floatingToggle.style.padding = '8px 12px';
    floatingToggle.style.cursor = 'pointer';
    floatingToggle.style.zIndex = '1000';
    floatingToggle.style.background = 'rgba(255, 255, 255, 0.08)';
    floatingToggle.style.border = '1px solid var(--card-border)';
    floatingToggle.style.color = 'var(--text)';
    floatingToggle.onclick = window.toggleTheme;
    
    floatingToggle.innerHTML = activeTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    document.body.appendChild(floatingToggle);
  }
}

window.toggleTheme = function() {
  const body = document.body;
  const btnText = document.getElementById('themeBtnText');
  const btnIcon = document.getElementById('themeBtnIcon');
  const floatBtn = document.querySelector('body > #themeToggleBtn');

  if (body.classList.contains('light-theme')) {
    body.classList.remove('light-theme');
    localStorage.setItem('vp_theme', 'dark');
    if (btnText) btnText.innerText = 'Light Mode';
    if (btnIcon) btnIcon.innerText = '☀️';
    if (floatBtn) floatBtn.innerHTML = '☀️ Light Mode';
    showToast('Switched to Dark Mode', 'success');
  } else {
    body.classList.add('light-theme');
    localStorage.setItem('vp_theme', 'light');
    if (btnText) btnText.innerText = 'Dark Mode';
    if (btnIcon) btnIcon.innerText = '🌙';
    if (floatBtn) floatBtn.innerHTML = '🌙 Dark Mode';
    showToast('Switched to Light Mode', 'success');
  }
};

// Run basic setup on load
document.addEventListener('DOMContentLoaded', () => {
  const pathname = window.location.pathname;
  const isAuthPage = pathname.endsWith('index.html') || pathname.endsWith('/') || pathname === '';
  
  // Theme check before auth redirects to prevent flashes
  const activeTheme = localStorage.getItem('vp_theme') || 'dark';
  if (activeTheme === 'light') {
    document.body.classList.add('light-theme');
  }

  checkAuth(isAuthPage);
  if (!isAuthPage) {
    setupSidebarProfile();
  }
  setupThemeToggle();
});

