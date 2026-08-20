function getAuthUser(){
  try{ return JSON.parse(localStorage.getItem('csp_user')); }catch(e){ return null; }
}

function isAdminUser(user){
  if(!user || !user.email) return false;
  if(window.isAdminEmail && typeof window.isAdminEmail === 'function') {
    return window.isAdminEmail(user.email);
  }
  const admins = ['studyinfowithmr@gmail.com', 'cfpakifen@gmail.com'];
  return admins.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
}

function updateAdminNavVisibility(){
  const user = getAuthUser();
  const isAdmin = isAdminUser(user);
  document.querySelectorAll('.admin-nav-item, .admin-only-nav, .nav-links a[href*="admin.html"]').forEach(el => {
    const li = el.closest('li') || el;
    li.style.display = isAdmin ? '' : 'none';
  });
}

function setAuthUser(user){
  if(user) {
    localStorage.setItem('csp_user', JSON.stringify(user));
    if (window.Store && typeof window.Store.ensureUser === 'function') {
      window.Store.ensureUser(user);
    }
    // Check if this is an admin account -> Redirect to admin panel
    if (isAdminUser(user)) {
      if (!location.pathname.endsWith('admin.html')) {
        location.href = 'admin.html';
        return;
      }
    }
  } else {
    localStorage.removeItem('csp_user');
  }
  renderAuthUI();
  updateAdminNavVisibility();
  document.dispatchEvent(new CustomEvent('userchange', { detail: { user } }));
}

function openGoogleModal(){
  let modal = document.getElementById('google-auth-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'google-auth-modal';
    document.body.appendChild(modal);
  }

  const isFileProtocol = location.protocol === 'file:';

  modal.innerHTML = `
    <div class="google-modal-box" style="max-width:400px;padding:32px 24px;text-align:center;">
      <svg class="google-modal-logo" viewBox="0 0 24 24" style="width:44px;height:44px;margin-bottom:12px;">
        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
      </svg>
      <h3 style="font-size:19px;margin-bottom:6px;" data-i18n="login_prompt_title">Sign In</h3>
      <p style="font-size:13px;color:var(--text-faint);margin-bottom:20px;" data-i18n="login_prompt_sub">
        ${isFileProtocol ? 'Local file mode (file://): Choose an account or enter your email to sign in.' : 'Sign in with your Google account to access courses or admin dashboard.'}
      </p>
      
      <!-- Google Sign-In Button -->
      <button class="google-signin-action-btn" id="real-google-signin-btn">
        <svg style="width:18px;height:18px;" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
        <span>${isFileProtocol ? 'Sign in with Email / Admin' : 'Continue with Google'}</span>
      </button>

      ${isFileProtocol ? `
        <div style="margin-top:16px;text-align:left;">
          <div style="font-size:12px;color:var(--text-faint);margin-bottom:8px;font-family:var(--font-mono);text-align:center;">— QUICK ADMIN ACCESS —</div>
          <button class="account-choice-btn" data-email="studyinfowithmr@gmail.com">
            <div class="acc-avatar">S</div>
            <div class="acc-details">
              <div class="acc-name">Study Info (Admin)</div>
              <div class="acc-email">studyinfowithmr@gmail.com</div>
            </div>
          </button>
          <button class="account-choice-btn" data-email="cfpakifen@gmail.com" style="margin-top:8px;">
            <div class="acc-avatar">C</div>
            <div class="acc-details">
              <div class="acc-name">CFPAKIFEN (Admin)</div>
              <div class="acc-email">cfpakifen@gmail.com</div>
            </div>
          </button>
        </div>` : ''}

      <button class="btn btn-ghost btn-sm" id="close-google-modal" style="margin-top:16px;width:100%;" data-i18n="close">Close</button>
    </div>`;

  modal.onclick = (e)=>{ if(e.target===modal) modal.classList.remove('open'); };
  modal.querySelector('#close-google-modal').onclick = ()=> modal.classList.remove('open');
  
  // Real Google Sign-in click
  const realGoogleBtn = modal.querySelector('#real-google-signin-btn');
  if(realGoogleBtn){
    realGoogleBtn.onclick = async () => {
      try {
        if(window.signInWithGooglePopup){
          const user = await window.signInWithGooglePopup();
          if (user) {
            modal.classList.remove('open');
            showToast(t('login_success') || 'Signed in successfully');
          }
        }
      } catch (err) {
        console.error("Google Sign-In Error:", err);
        if (err.code !== 'auth/popup-closed-by-user') {
          showToast(err.message || "Google sign-in error");
        }
      }
    };
  }

  // Preset admin buttons click under file://
  modal.querySelectorAll('.account-choice-btn').forEach(btn => {
    btn.onclick = async () => {
      const email = btn.dataset.email;
      if (window.signInWithGooglePopup) {
        const user = await window.signInWithGooglePopup(email);
        if (user) {
          modal.classList.remove('open');
          showToast(t('login_success') || 'Signed in successfully');
        }
      }
    };
  });

  modal.classList.add('open');
}

function renderAuthUI(){
  const box = document.getElementById('auth-box');
  if(!box) return;

  const user = getAuthUser();
  if(!user){
    box.innerHTML = `
      <button class="btn-google" id="google-login-btn">
        <svg class="google-icon" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
        <span data-i18n="nav_login">${t('nav_login')}</span>
      </button>`;
    const btn = box.querySelector('#google-login-btn');
    if(btn) btn.addEventListener('click', openGoogleModal);
  } else {
    box.innerHTML = `
      <div class="user-profile-widget">
        <button class="user-badge" id="user-badge-btn">
          <div class="user-avatar">${user.initials || 'U'}</div>
          <span>${user.name}</span>
        </button>
        <div class="user-dropdown" id="user-dropdown">
          <div class="user-dropdown-info">
            <strong>${user.name}</strong>
            <small>${user.email}</small>
          </div>
          <button class="dropdown-logout" id="logout-btn" data-i18n="nav_logout">${t('nav_logout')}</button>
        </div>
      </div>`;

    const badgeBtn = box.querySelector('#user-badge-btn');
    const dropdown = box.querySelector('#user-dropdown');
    const logoutBtn = box.querySelector('#logout-btn');

    if(badgeBtn && dropdown){
      badgeBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
      document.addEventListener('click', ()=> dropdown.classList.remove('open'));
    }

    if(logoutBtn){
      logoutBtn.addEventListener('click', async ()=>{
        if (window.signOutFirebase) {
          try { await window.signOutFirebase(); } catch(e){}
        }
        setAuthUser(null);
        showToast(t('logout_success'));
        if (location.pathname.endsWith('admin.html')) {
          location.href = 'index.html';
        }
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  // Render Google Auth UI and update admin link visibility
  renderAuthUI();
  updateAdminNavVisibility();

  // Listen for data changes BEFORE loading data
  document.addEventListener('langchange', ()=>{
    renderAuthUI();
    updateAdminNavVisibility();
    updateHomeYearCounts();
    updateCoursesNavLinks();
    markActiveNavLink();
  });
  document.addEventListener('dbupdated', ()=>{
    updateHomeYearCounts();
    updateCoursesNavLinks();
    markActiveNavLink();
  });

  // mobile nav toggle
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if(navToggle && navLinks){
    navToggle.addEventListener('click', ()=> navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> navLinks.classList.remove('open')));
  }

  // mark active nav link
  markActiveNavLink();

  // reveal on scroll
  const revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window && revealEls.length){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold:0.15 });
    revealEls.forEach(el=> io.observe(el));
  } else {
    revealEls.forEach(el=> el.classList.add('in'));
  }

  async function refreshHomeData() {
    // Show counts from browser storage right away (works when opening files locally)
    updateHomeYearCounts();

    if (window.refreshCloudSync) {
      try { await window.refreshCloudSync(); } catch (e) { /* logged in firebase.js */ }
    } else if (window.cloudSyncReady) {
      try { await window.cloudSyncReady; } catch (e) { /* logged in firebase.js */ }
    }

    if (window.Store && !Store.getAllCourses().length && Store.fetchCoursesFromCloud) {
      try { await Store.fetchCoursesFromCloud(); } catch (e) { console.warn('Home cloud fetch failed', e); }
    }

    updateHomeYearCounts();
    updateCoursesNavLinks();
    markActiveNavLink();
  }

  if (document.getElementById('y1-meta-counts')) {
    await refreshHomeData();

    window.addEventListener('pageshow', () => {
      refreshHomeData();
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'csp_db_v4') updateHomeYearCounts();
    });
  }
});

function markActiveNavLink() {
  const currentPath = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').toLowerCase().split('?')[0];
    let isActive = false;

    if (currentPath === 'admin.html' && href === 'admin.html') {
      isActive = true;
    } else if (currentPath === 'about.html' && href === 'about.html') {
      isActive = true;
    } else if ((currentPath === 'courses.html' || currentPath === 'quiz.html') && href.includes('courses.html')) {
      isActive = true;
    } else if ((currentPath === 'index.html' || currentPath === '') && href === 'index.html') {
      isActive = true;
    }

    if (isActive) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
}

function updateCoursesNavLinks() {
  try {
    const isInsideCoursesOrQuiz = location.pathname.endsWith('courses.html') || location.pathname.endsWith('quiz.html');
    const targetYear = isInsideCoursesOrQuiz ? (Number(sessionStorage.getItem('csp_active_year')) || 1) : 1;
    document.querySelectorAll('.nav-links a[href*="courses.html"]').forEach(a => {
      a.href = `courses.html?year=${targetYear}`;
    });
  } catch(e){}
}

function fillYearMeta(containerId, year) {
  const meta = document.getElementById(containerId);
  if (!meta || !window.Store) return;

  const stats = Store.getYearStats(year);
  const countEl = meta.querySelector('[data-count="courses"]');

  if (countEl) {
    const set = (key, value) => {
      const el = meta.querySelector(`[data-count="${key}"]`);
      if (el) el.textContent = value;
    };
    set('courses', stats.courses);
    set('td', stats.td);
    set('exam', stats.exam);
    set('quiz', stats.quiz);
    return;
  }

  meta.innerHTML = `
    <span>● ${stats.courses} <span data-i18n="courses_count">${t('courses_count')}</span></span>
    <span>● ${stats.td} TDs</span>
    <span>● ${stats.exam} Exams</span>
    <span>● ${stats.quiz} <span data-i18n="quiz_count">${t('quiz_count')}</span></span>`;
}

function updateHomeYearCounts() {
  if (!window.Store) return;
  fillYearMeta('y1-meta-counts', 1);
  fillYearMeta('y2-meta-counts', 2);
}

window.updateHomeYearCounts = updateHomeYearCounts;

function showToast(msg){
  let toast = document.querySelector('.toast');
  if(!toast){
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> toast.classList.remove('show'), 2200);
}

