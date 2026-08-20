document.addEventListener('DOMContentLoaded', ()=>{

  // ---- panel switching ----
  const items = document.querySelectorAll('.admin-side .item');
  const panels = { courses:'panel-courses', quiz:'panel-quiz', users:'panel-users' };
  items.forEach(item=>{
    item.addEventListener('click', (e)=>{
      e.preventDefault();
      items.forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      Object.values(panels).forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.style.display='none';
      });
      const target = document.getElementById(panels[item.dataset.panel]);
      if(target) target.style.display='block';
      if(item.dataset.panel === 'users') renderUsersTable();
    });
  });

  // ---- courses / resources table ----
  function renderCourseTable(){
    const tbody = document.getElementById('course-tbody');
    if(!tbody) return;
    const courses = Store.getAllCourses ? Store.getAllCourses() : Store.getCourses();
    if (!courses.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-faint);">No courses or materials found.</td></tr>`;
      return;
    }
    tbody.innerHTML = courses.map(c=>`
      <tr>
        <td><span class="type-pill ${c.type || 'course'}">${t('type_' + (c.type || 'course'))}</span></td>
        <td><span class="badge">${c.code || 'CS'}</span></td>
        <td>${c.title_en || c.title_fr || 'Untitled'}</td>
        <td>${c.year || 1}</td>
        <td><button class="btn btn-sm btn-danger" data-del="${c.id}">${t('action_delete')}</button></td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-del]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        await Store.deleteCourse(btn.dataset.del);
        renderCourseTable();
        renderUsersTable();
        showToast(t('toast_deleted'));
      });
    });
  }

  const courseForm = document.getElementById('course-form');
  if(courseForm){
    courseForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const f = new FormData(e.target);
      const title_en = (f.get('title_en') || '').trim();
      const title_fr = (f.get('title_fr') || '').trim();

      if(!title_en && !title_fr){
        alert("Please enter a title for the course/material.");
        return;
      }

      const desc_en = (f.get('desc_en') || '').trim();
      const desc_fr = (f.get('desc_fr') || '').trim();
      const pdf_en = (f.get('pdfUrl_en') || '').trim();
      const pdf_fr = (f.get('pdfUrl_fr') || '').trim();

      const saved = await Store.addCourse({
        type: f.get('type') || 'course',
        year: Number(f.get('year')) || 1,
        code: (f.get('code') || 'CS').trim().toUpperCase(),
        title_en: title_en || title_fr,
        title_fr: title_fr || title_en,
        desc_en: desc_en || desc_fr,
        desc_fr: desc_fr || desc_en,
        pdfUrl_en: pdf_en,
        pdfUrl_fr: pdf_fr,
        pdfUrl: pdf_en || pdf_fr,
        videoUrl: (f.get('videoUrl') || '').trim()
      });

      e.target.reset();
      renderCourseTable();
      renderUsersTable();
      if (saved && saved.firestoreId) {
        showToast(t('toast_saved'));
      } else {
        alert((saved && saved._cloudError) || 'Not saved to Firebase. Sign in with Google as the admin account, then try again.');
      }
    });
  }

  // ---- quiz table ----
  function renderQuizTable(){
    const tbody = document.getElementById('quiz-tbody');
    if(!tbody) return;
    const rows = [];
    [1,2].forEach(year=>{
      (Store.getQuiz(year) || []).forEach((q)=>{
        rows.push({ year, q });
      });
    });
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:var(--text-faint);">No quiz questions found.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td><span class="badge">Year ${r.year}</span></td>
        <td>${r.q.q_en || r.q.q_fr || 'Untitled question'}</td>
        <td><button class="btn btn-sm btn-danger" data-del-year="${r.year}" data-del-id="${r.q.id}">${t('action_delete')}</button></td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-del-year]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        await Store.deleteQuestion(Number(btn.dataset.delYear), btn.dataset.delId);
        renderQuizTable();
        showToast(t('toast_deleted'));
      });
    });
  }

  // ---- DYNAMIC QUIZ OPTIONS MANAGER ----
  let quizOptionsData = [
    { en: '', fr: '' },
    { en: '', fr: '' },
    { en: '', fr: '' },
    { en: '', fr: '' }
  ];
  let selectedCorrectIdx = 0;

  function renderDynamicOptions() {
    const list = document.getElementById('dynamic-options-list');
    const select = document.getElementById('quiz-correct-select');
    if (!list) return;

    // Save existing input values if any
    list.querySelectorAll('.option-card-row').forEach((row, idx) => {
      const enInput = row.querySelector('.opt-en-input');
      const frInput = row.querySelector('.opt-fr-input');
      if (quizOptionsData[idx]) {
        if (enInput) quizOptionsData[idx].en = enInput.value;
        if (frInput) quizOptionsData[idx].fr = frInput.value;
      }
    });

    list.innerHTML = quizOptionsData.map((opt, i) => {
      const letter = String.fromCharCode(65 + i); // A, B, C, D, E...
      const isCorrect = (i === selectedCorrectIdx);
      const canDelete = quizOptionsData.length > 2;

      return `
        <div class="option-card-row" data-idx="${i}" style="background:var(--bg-elevated);border:1px solid ${isCorrect ? 'var(--cyan)' : 'var(--border-strong)'};border-radius:var(--radius-s);padding:14px;transition:border-color .2s;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer;font-weight:600;color:${isCorrect ? 'var(--cyan)' : 'var(--text)'};font-size:13px;">
              <input type="radio" name="opt_correct_radio" value="${i}" ${isCorrect ? 'checked' : ''} class="opt-radio" style="width:auto;cursor:pointer;">
              <span>${t('field_opt') || 'Option'} ${letter}</span>
              ${isCorrect ? `<span class="badge" style="background:rgba(76,211,255,0.15);color:var(--cyan);border-color:rgba(76,211,255,0.4);font-size:10px;">✓ ${t('mark_correct') || 'Correct Answer'}</span>` : ''}
            </label>
            ${canDelete ? `
              <button type="button" class="btn btn-ghost btn-sm remove-opt-btn" data-idx="${i}" style="padding:2px 8px;font-size:11px;color:var(--red);" title="${t('remove_option') || 'Remove'}">
                ✕ ${t('remove_option') || 'Remove'}
              </button>` : ''}
          </div>
          <div class="form-grid" style="margin:0;">
            <div class="form-row" style="margin-bottom:0;">
              <label style="font-size:11px;color:var(--text-faint);">${t('field_opt') || 'Option'} ${letter} (English)</label>
              <input class="opt-en-input" value="${opt.en || ''}" placeholder="Option ${letter} in English" required>
            </div>
            <div class="form-row" style="margin-bottom:0;">
              <label style="font-size:11px;color:var(--text-faint);">${t('field_opt') || 'Option'} ${letter} (Français)</label>
              <input class="opt-fr-input" value="${opt.fr || ''}" placeholder="Option ${letter} en Français" required>
            </div>
          </div>
        </div>`;
    }).join('');

    // Update the dropdown selector as well
    if (select) {
      select.innerHTML = quizOptionsData.map((_, i) => {
        const letter = String.fromCharCode(65 + i);
        return `<option value="${i}" ${i === selectedCorrectIdx ? 'selected' : ''}>${letter} (${t('field_opt') || 'Option'} ${letter})</option>`;
      }).join('');
    }

    // Attach Radio listeners
    list.querySelectorAll('.opt-radio').forEach(r => {
      r.addEventListener('change', (e) => {
        selectedCorrectIdx = Number(e.target.value);
        renderDynamicOptions();
      });
    });

    // Attach Remove listeners
    list.querySelectorAll('.remove-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        if (quizOptionsData.length <= 2) {
          alert(t('min_options_alert') || 'A quiz question must have at least 2 options.');
          return;
        }
        quizOptionsData.splice(idx, 1);
        if (selectedCorrectIdx >= quizOptionsData.length) {
          selectedCorrectIdx = quizOptionsData.length - 1;
        }
        renderDynamicOptions();
      });
    });
  }

  // Add Option Button Listener
  const addOptionBtn = document.getElementById('add-option-btn');
  if (addOptionBtn) {
    addOptionBtn.addEventListener('click', () => {
      // Save existing input values before adding
      const list = document.getElementById('dynamic-options-list');
      if (list) {
        list.querySelectorAll('.option-card-row').forEach((row, idx) => {
          const enInput = row.querySelector('.opt-en-input');
          const frInput = row.querySelector('.opt-fr-input');
          if (quizOptionsData[idx]) {
            if (enInput) quizOptionsData[idx].en = enInput.value;
            if (frInput) quizOptionsData[idx].fr = frInput.value;
          }
        });
      }
      quizOptionsData.push({ en: '', fr: '' });
      renderDynamicOptions();
    });
  }

  // Synchronize dropdown when changed
  const quizSelect = document.getElementById('quiz-correct-select');
  if (quizSelect) {
    quizSelect.addEventListener('change', (e) => {
      selectedCorrectIdx = Number(e.target.value);
      renderDynamicOptions();
    });
  }

  const questionForm = document.getElementById('question-form');
  if(questionForm){
    questionForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const f = new FormData(e.target);
      const year = Number(f.get('year')) || 1;
      const q_en = (f.get('q_en') || '').trim();
      const q_fr = (f.get('q_fr') || '').trim();

      if(!q_en && !q_fr){
        alert("Please enter the question text.");
        return;
      }

      const list = document.getElementById('dynamic-options-list');
      const opts_en = [];
      const opts_fr = [];

      list.querySelectorAll('.option-card-row').forEach(row => {
        const enVal = (row.querySelector('.opt-en-input')?.value || '').trim();
        const frVal = (row.querySelector('.opt-fr-input')?.value || '').trim();
        const finalVal = enVal || frVal;
        if(finalVal){
          opts_en.push(enVal || frVal);
          opts_fr.push(frVal || enVal);
        }
      });

      if (opts_en.length < 2) {
        alert(t('min_options_alert') || 'A quiz question must have at least 2 options.');
        return;
      }

      const savedQ = await Store.addQuestion(year, {
        q_en: q_en || q_fr,
        q_fr: q_fr || q_en,
        opts_en: opts_en,
        opts_fr: opts_fr,
        correct: Math.min(selectedCorrectIdx, opts_en.length - 1)
      });

      e.target.reset();
      // Reset options to default 4
      quizOptionsData = [
        { en: '', fr: '' },
        { en: '', fr: '' },
        { en: '', fr: '' },
        { en: '', fr: '' }
      ];
      selectedCorrectIdx = 0;
      renderDynamicOptions();
      renderQuizTable();
      if (savedQ && savedQ.firestoreId) {
        showToast(t('toast_saved'));
      } else {
        alert((savedQ && savedQ._cloudError) || 'Quiz not saved to Firebase. Sign in with Google as the admin account, then try again.');
      }
    });
  }

  renderDynamicOptions();

  // ---- USERS & PROGRESS MANAGEMENT ----
  function renderUsersTable(){
    const tbody = document.getElementById('users-tbody');
    if(!tbody) return;

    const HIDDEN_ADMIN_EMAIL = 'cfpakifen@gmail.com';
    const allCourses = Store.getAllCourses();
    const totalCoursesCount = allCourses.length || 1;
    const allUsers = Store.getUsers();
    const users = allUsers.filter(u => (u.email || '').toLowerCase() !== HIDDEN_ADMIN_EMAIL);

    // Update KPI Cards — hide admin from the table, keep total students +1 for that account
    const totalStudents = users.length + (allUsers.length > users.length ? 1 : 0);
    let totalFinishedCourses = 0;
    let totalQuizzesResponded = 0;
    let totalScoreSum = 0;
    let totalScoreCount = 0;

    users.forEach(u => {
      const finished = (u.completedCourses || []).length;
      totalFinishedCourses += finished;
      const quizzes = (u.quizResults || []);
      totalQuizzesResponded += quizzes.length;
      quizzes.forEach(q => {
        totalScoreSum += (q.score / (q.total || 1)) * 100;
        totalScoreCount++;
      });
    });

    const avgScore = totalScoreCount > 0 ? Math.round(totalScoreSum / totalScoreCount) : 0;

    const kpiStudents = document.getElementById('kpi-total-students');
    const kpiCourses = document.getElementById('kpi-courses-completed');
    const kpiQuizzes = document.getElementById('kpi-quizzes-taken');
    const kpiAvg = document.getElementById('kpi-avg-score');

    if(kpiStudents) kpiStudents.textContent = totalStudents;
    if(kpiCourses) kpiCourses.textContent = totalFinishedCourses;
    if(kpiQuizzes) kpiQuizzes.textContent = totalQuizzesResponded;
    if(kpiAvg) kpiAvg.textContent = `${avgScore}%`;

    // Filter and Search
    const searchVal = (document.getElementById('student-search-input')?.value || '').toLowerCase().trim();
    const filterVal = document.getElementById('student-filter-select')?.value || 'all';

    let filteredUsers = users.filter(u => {
      const matchSearch = !searchVal ||
        u.name.toLowerCase().includes(searchVal) ||
        u.email.toLowerCase().includes(searchVal);
      if(!matchSearch) return false;

      const completedCount = (u.completedCourses || []).length;
      const quizzesCount = (u.quizResults || []).length;

      if(filterVal === 'completed') return (completedCount > 0 || quizzesCount > 0);
      if(filterVal === 'none') return (completedCount === 0 && quizzesCount === 0);
      return true;
    });

    if(!filteredUsers.length){
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-faint);">${t('no_users_found')}</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredUsers.map(u => {
      const completed = u.completedCourses || [];
      const count = completed.length;
      const pct = Math.min(100, Math.round((count / totalCoursesCount) * 100));
      const quizzes = u.quizResults || [];
      const quizCount = quizzes.length;

      let avgUserQuiz = 0;
      if(quizCount > 0){
        const sum = quizzes.reduce((acc, q) => acc + ((q.score / (q.total || 1)) * 100), 0);
        avgUserQuiz = Math.round(sum / quizCount);
      }

      let statusBadge = '';
      if(pct >= 60){
        statusBadge = `<span class="user-status-pill status-advanced">${t('status_advanced')} (${pct}%)</span>`;
      } else if(count > 0 || quizCount > 0){
        statusBadge = `<span class="user-status-pill status-progress">${t('status_in_progress')} (${pct}%)</span>`;
      } else {
        statusBadge = `<span class="user-status-pill status-new">${t('status_not_started')}</span>`;
      }

      const quizInfo = quizCount > 0
        ? `<div style="display:flex;align-items:center;gap:6px;">
             <strong>${quizCount}</strong> <span style="font-size:12px;color:var(--text-faint);">(${t('avg_score')}: <span style="color:var(--green);font-weight:600;">${avgUserQuiz}%</span>)</span>
           </div>`
        : `<span style="color:var(--text-faint);font-size:12px;">0 ${t('quizzes_count')}</span>`;

      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="user-avatar-small">${u.initials || u.name.charAt(0).toUpperCase()}</div>
              <div>
                <strong style="display:block;color:var(--text);">${u.name}</strong>
                <small style="color:var(--text-faint);font-size:12px;">${u.email}</small>
              </div>
            </div>
          </td>
          <td>
            <div style="min-width:140px;">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                <span><strong>${count}</strong> / ${totalCoursesCount}</span>
                <span style="color:var(--text-faint);">${pct}%</span>
              </div>
              <div class="user-progress-bar-bg">
                <div class="user-progress-bar-fill" style="width:${pct}%"></div>
              </div>
            </div>
          </td>
          <td>${quizInfo}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-sm btn-ghost view-user-btn" data-user-id="${u.id}" style="padding:4px 8px;font-size:12px;">${t('action_details')}</button>
              <button class="btn btn-sm btn-ghost reset-user-btn" data-user-id="${u.id}" title="${t('action_reset_progress')}" style="padding:4px 8px;font-size:12px;color:var(--amber);">↺</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    // Attach listeners
    tbody.querySelectorAll('.view-user-btn').forEach(btn => {
      btn.addEventListener('click', () => openUserDetailsModal(btn.dataset.userId));
    });

    tbody.querySelectorAll('.reset-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if(confirm(t('confirm_reset_user'))){
          Store.resetUserProgress(btn.dataset.userId);
          renderUsersTable();
          showToast(t('toast_user_reset'));
        }
      });
    });
  }

  // Student Details Modal
  function openUserDetailsModal(userId){
    const cleanId = (userId || '').toLowerCase();
    const user = Store.getUsers().find(u => u.id === userId || (u.email && u.email.toLowerCase() === cleanId));
    if(!user) return;

    const modal = document.getElementById('user-details-modal');
    const body = document.getElementById('user-modal-body');
    const title = document.getElementById('user-modal-title');
    const lang = getLang();

    if(title) title.textContent = `${user.name} — ${t('user_details_title')}`;

    const allCourses = Store.getAllCourses();
    const completedIds = user.completedCourses || [];
    const completedCourses = allCourses.filter(c => completedIds.includes(c.id) || (c.firestoreId && completedIds.includes(c.firestoreId)));
    const pendingCourses = allCourses.filter(c => !completedIds.includes(c.id) && (!c.firestoreId || !completedIds.includes(c.firestoreId)));
    const quizResults = user.quizResults || [];

    body.innerHTML = `
      <!-- Compact Student Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:16px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="user-avatar-small">${user.initials || user.name.charAt(0).toUpperCase()}</div>
          <div>
            <span style="font-weight:700;font-size:15px;color:var(--text);">${user.name}</span>
            <span style="color:var(--text-faint);font-size:12px;margin-left:6px;">(${user.email})</span>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-faint);font-family:var(--font-mono);">${t('registered')}: ${user.registeredAt || '2026-08'}</div>
      </div>

      <!-- Section: Courses Finished -->
      <div style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h4 style="margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;">
            <span>${t('table_courses_finished')}</span>
            <span class="badge" style="background:rgba(76,211,255,0.12);color:var(--cyan);border-color:rgba(76,211,255,0.3);">${completedCourses.length} / ${allCourses.length}</span>
          </h4>
        </div>
        ${completedCourses.length ? `
          <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;padding-right:4px;">
            ${completedCourses.map(c => {
              const cTitle = lang==='fr' ? (c.title_fr || c.title_en) : (c.title_en || c.title_fr);
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-s);font-size:13px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="badge">${c.code}</span>
                    <span style="font-weight:500;">${cTitle}</span>
                    <span class="type-pill ${c.type || 'course'}" style="font-size:10px;">${t('type_' + (c.type || 'course'))}</span>
                  </div>
                  <span style="color:var(--green);font-weight:600;font-size:12px;">${t('completed')}</span>
                </div>`;
            }).join('')}
          </div>`
        : `<p style="font-size:13px;color:var(--text-faint);margin:0;">${t('no_courses_completed_yet')}</p>`}
      </div>

      <!-- Section: Quiz History -->
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h4 style="margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;">
            <span>${t('table_quizzes_responded')}</span>
            <span class="badge" style="background:rgba(123,110,246,0.15);color:#a99bff;border-color:rgba(123,110,246,0.35);">${quizResults.length}</span>
          </h4>
        </div>
        ${quizResults.length ? `
          <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;padding-right:4px;">
            ${quizResults.map((q, idx) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-s);font-size:13px;">
                <div>
                  <strong>${t('quiz_label')} ${lang==='fr'?'Année':'Year'} ${q.year}</strong>
                  <span style="color:var(--text-faint);font-size:12px;margin-left:8px;">${q.date || 'Recent'}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-family:var(--font-mono);font-weight:700;color:${q.percent >= 75 ? 'var(--green)' : (q.percent >= 50 ? 'var(--amber)' : 'var(--red)')};">
                    ${q.score}/${q.total} (${q.percent}%)
                  </span>
                </div>
              </div>`).join('')}
          </div>`
        : `<p style="font-size:13px;color:var(--text-faint);margin:0;">${t('no_quizzes_taken_yet')}</p>`}
      </div>
    `;

    modal.classList.add('open');
  }

  const modalClose = document.getElementById('user-modal-close');
  const detailsModal = document.getElementById('user-details-modal');
  if(modalClose && detailsModal){
    modalClose.onclick = () => detailsModal.classList.remove('open');
    detailsModal.onclick = (e) => { if(e.target === detailsModal) detailsModal.classList.remove('open'); };
  }

  // Search & filter event listeners
  const searchInput = document.getElementById('student-search-input');
  const filterSelect = document.getElementById('student-filter-select');
  if(searchInput) searchInput.addEventListener('input', renderUsersTable);
  if(filterSelect) filterSelect.addEventListener('change', renderUsersTable);

  // ---- ADMIN AUTHENTICATION GATE ----
  async function onAdminReady() {
    if (window.Store && typeof Store.uploadLocalIfNeeded === 'function') {
      const uploaded = await Store.uploadLocalIfNeeded();
      if (uploaded) {
        renderCourseTable();
        renderQuizTable();
        showToast(t('toast_saved') + ' (synced to cloud)');
      }
    }
  }

  function updateFirebaseWriteStatus() {
    const notice = document.querySelector('.notice');
    const fbUser = window.firebaseAuth && window.firebaseAuth.currentUser;
    const ok = !!(fbUser && fbUser.email && window.isAdminEmail && window.isAdminEmail(fbUser.email));
    if (!notice) return;
    if (ok) {
      notice.textContent = 'Signed in to Firebase as ' + fbUser.email + '. Courses, TDs, TPs, exams and quizzes will save to the database.';
    } else {
      notice.textContent = 'Database writes need a real Google sign-in as studyinfowithmr@gmail.com or cfpakifen@gmail.com. A saved browser session is not enough.';
    }
  }

  function checkAdminAuth() {
    const fbUser = window.firebaseAuth && window.firebaseAuth.currentUser;
    const user = (typeof getAuthUser === 'function') ? getAuthUser() : null;
    const email = (fbUser && fbUser.email) || (user && user.email);
    let isAdmin = false;
    if (email) {
      if (typeof window.isAdminEmail === 'function') {
        isAdmin = window.isAdminEmail(email);
      } else {
        const admins = ['studyinfowithmr@gmail.com', 'cfpakifen@gmail.com'];
        isAdmin = admins.map(e => e.toLowerCase()).includes(email.toLowerCase());
      }
    }

    if (!isAdmin) {
      location.href = 'index.html';
      return;
    }

    const gate = document.getElementById('admin-auth-gate');
    const shell = document.querySelector('.admin-shell');
    const notice = document.querySelector('.notice');

    if (gate) gate.style.display = 'none';
    if (shell) shell.style.display = 'grid';
    if (notice) notice.style.display = 'block';

    updateFirebaseWriteStatus();
    onAdminReady();
  }

  const gateLoginBtn = document.getElementById('admin-gate-login-btn');
  if (gateLoginBtn) {
    gateLoginBtn.addEventListener('click', async () => {
      try {
        if (window.signInWithGooglePopup) {
          const authUser = await window.signInWithGooglePopup();
          checkAdminAuth();
        }
      } catch (e) {
        console.warn("Admin gate login error:", e);
      }
    });
  }

  async function initAdminData() {
    try { localStorage.removeItem('csp_db_v4'); } catch (e) {}
    if (window.Store && typeof Store.syncWithFirebase === 'function') {
      try { await Store.syncWithFirebase(); } catch (e) {}
    } else if (window.refreshCloudSync) {
      try { await window.refreshCloudSync(); } catch (e) {}
    }

    renderCourseTable();
    renderQuizTable();
    renderUsersTable();
  }

  document.addEventListener('dbupdated', ()=>{
    renderCourseTable();
    renderQuizTable();
    renderUsersTable();
  });

  document.addEventListener('langchange', ()=>{
    renderCourseTable();
    renderQuizTable();
    renderUsersTable();
    renderDynamicOptions();
  });

  document.addEventListener('userchange', checkAdminAuth);

  (async function waitForAuthThenStart() {
    if (window.firebaseAuth) {
      await new Promise(resolve => {
        const unsub = window.firebaseAuth.onAuthStateChanged(() => {
          unsub();
          resolve();
        });
      });
    }
    checkAdminAuth();
    initAdminData();
  })();
});
