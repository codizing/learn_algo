let currentYear = 1;
let activeTab = 'course';

function getYearParam(){
  const p = new URLSearchParams(location.search);
  const y = Number(p.get('year'));
  if ([1, 2].includes(y)) {
    try { sessionStorage.setItem('csp_active_year', y); } catch(e){}
    return y;
  }
  // Always default to year 1 — don't restore a saved year on a fresh visit
  // (phones often open /courses.html with no ?year= and had year 2 saved)
  return 1;
}

function getTabParam(){
  const p = new URLSearchParams(location.search);
  const t = p.get('tab');
  return ['course', 'td', 'tp', 'exam'].includes(t) ? t : 'course';
}

function getVideoEmbed(url){
  if(!url) return null;
  const cleanUrl = url.trim();

  // 1. Google Drive
  const gDriveMatch = cleanUrl.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/i);
  if(gDriveMatch){
    const fileId = gDriveMatch[1];
    return {
      type: 'iframe',
      src: `https://drive.google.com/file/d/${fileId}/preview`,
      directUrl: `https://drive.google.com/file/d/${fileId}/view`,
      label: 'Google Drive'
    };
  }

  // 2. YouTube
  const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
  if(ytMatch){
    return {
      type: 'iframe',
      src: `https://youtube.com/embed/${ytMatch[1]}?autoplay=1`,
      directUrl: cleanUrl,
      label: 'YouTube'
    };
  }

  // 3. Vimeo
  const vimeoMatch = cleanUrl.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
  if(vimeoMatch){
    return {
      type: 'iframe',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
      directUrl: cleanUrl,
      label: 'Vimeo'
    };
  }

  // 4. Direct video files
  if(cleanUrl.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)){
    return {
      type: 'video',
      src: cleanUrl,
      directUrl: cleanUrl,
      label: 'Video'
    };
  }

  // 5. Fallback iframe
  return {
    type: 'iframe',
    src: cleanUrl,
    directUrl: cleanUrl,
    label: 'Video'
  };
}

function openVideoModal(course){
  const lang = getLang();
  const modal = document.getElementById('video-modal');
  const body = document.getElementById('modal-body');
  const titleEl = document.getElementById('modal-title');
  const title = lang==='fr' ? (course.title_fr || course.title_en) : (course.title_en || course.title_fr);
  
  if(titleEl) titleEl.textContent = title;
  
  const embed = getVideoEmbed(course.videoUrl);
  if(!embed){
    body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-faint);">${t('no_video')}</div>`;
    modal.classList.add('open');
    return;
  }

  const openNewTabHtml = `
    <div style="padding:10px 16px;background:var(--bg-elevated);border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:13px;">
      <span style="color:var(--text-faint);font-family:var(--font-mono);">${embed.label}</span>
      <a href="${embed.directUrl}" target="_blank" rel="noopener" style="color:var(--cyan);font-weight:600;display:inline-flex;align-items:center;gap:4px;">
        ${t('open_new_tab')} ↗
      </a>
    </div>`;

  if(embed.type === 'iframe'){
    body.innerHTML = `
      <div style="position:relative;width:100%;height:100%;background:#000;">
        <iframe src="${embed.src}" style="width:100%;height:100%;border:0;" allow="autoplay; fullscreen" allowfullscreen></iframe>
      </div>
      ${openNewTabHtml}`;
  } else {
    body.innerHTML = `
      <div style="position:relative;width:100%;height:100%;background:#000;">
        <video src="${embed.src}" controls autoplay style="width:100%;height:100%;object-fit:contain;"></video>
      </div>
      ${openNewTabHtml}`;
  }

  modal.classList.add('open');
}

function closeVideoModal(){
  const modal = document.getElementById('video-modal');
  if(modal) modal.classList.remove('open');
  const body = document.getElementById('modal-body');
  if(body) body.innerHTML = '';
}

function updateCounts(year){
  const courses = Store.getCourses(year, 'course');
  const tds = Store.getCourses(year, 'td');
  const tps = Store.getCourses(year, 'tp');
  const exams = Store.getCourses(year, 'exam');
  const quizQuestions = Store.getQuiz(year);

  const cCount = document.getElementById('count-course');
  const tdCount = document.getElementById('count-td');
  const tpCount = document.getElementById('count-tp');
  const exCount = document.getElementById('count-exam');
  const qzCount = document.getElementById('count-quiz');

  if(cCount) cCount.textContent = courses.length;
  if(tdCount) tdCount.textContent = tds.length;
  if(tpCount) tpCount.textContent = tps.length;
  if(exCount) exCount.textContent = exams.length;
  if(qzCount) qzCount.textContent = quizQuestions.length;
}

function renderCourses(){
  const year = currentYear;
  const lang = getLang();

  // Update Year switcher active state
  document.querySelectorAll('#year-switcher a').forEach(a=>{
    const aYear = Number(a.dataset.year);
    a.classList.toggle('active', aYear === year);
    a.href = `courses.html?year=${aYear}&tab=${activeTab}`;
    a.textContent = '• ' + (lang==='fr' ? (aYear===1?'1ère Année':'2ème Année') : (aYear===1?'1st Year':'2nd Year'));
  });

  // Update Quiz link in menu to strictly match currentYear
  const quizLink = document.getElementById('tab-quiz');
  if(quizLink){
    quizLink.href = `quiz.html?year=${year}`;
  }

  // Update Category menu tabs
  document.querySelectorAll('#category-menu .tab-btn').forEach(btn=>{
    if(btn.dataset.tab !== 'quiz'){
      btn.classList.toggle('active', btn.dataset.tab === activeTab);
    }
  });

  updateCounts(year);

  const list = document.getElementById('course-list');
  const resources = Store.getCourses(year, activeTab);

  if(!resources.length){
    let emptyMsg = t('empty_courses');
    if(activeTab === 'td') emptyMsg = t('empty_td');
    else if(activeTab === 'tp') emptyMsg = t('empty_tp');
    else if(activeTab === 'exam') emptyMsg = t('empty_exams');

    const otherYear = currentYear === 1 ? 2 : 1;
    const otherYearCount = Store.getCourses(otherYear, activeTab).length;
    const yearHint = otherYearCount
      ? `<p style="margin-top:12px;font-size:13px;color:var(--text-faint);">${currentYear === 1 ? '2nd' : '1st'} Year has ${otherYearCount} item(s). <a href="courses.html?year=${otherYear}&tab=${activeTab}" style="color:var(--cyan);">Switch year</a></p>`
      : '';

    list.innerHTML = `
      <div class="empty-state">
        ${emptyMsg}
        ${yearHint}
        <button type="button" class="btn btn-ghost btn-sm" id="retry-sync-btn" style="margin-top:16px;">↻ Reload courses</button>
      </div>`;

    const retryBtn = document.getElementById('retry-sync-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => window.refreshCoursesFromCloud && window.refreshCoursesFromCloud());
    }
    return;
  }

  const user = getAuthUser();

  list.innerHTML = resources.map(c=>{
    const title = lang==='fr' ? (c.title_fr || c.title_en) : (c.title_en || c.title_fr);
    const desc = lang==='fr' ? (c.desc_fr || c.desc_en) : (c.desc_en || c.desc_fr);
    const typeLabel = t(`type_${c.type || 'course'}`);

    const pdfUrl = (lang === 'fr'
      ? (c.pdfUrl_fr || c.pdfUrl_en || c.pdfUrl)
      : (c.pdfUrl_en || c.pdfUrl_fr || c.pdfUrl)) || '';

    let pdfBtn = '';
    let videoBtn = '';
    let completeBtn = '';

    if (!user) {
      // Locked action buttons when not subscribed/logged in (Courses, TDs, TPs, Exams)
      pdfBtn = `<button class="locked-action-btn" data-action="pdf" style="opacity:0.9;">🔒 ${t('open_pdf')}</button>`;
      videoBtn = `<button class="locked-action-btn" data-action="video" style="opacity:0.9;">🔒 ${t('watch_video')}</button>`;
      completeBtn = `
        <button class="locked-action-btn complete-toggle-btn" data-action="complete" style="opacity:0.9;" title="${t('lock_btn_text')}">
          <span class="chk-icon">🔒</span>
          <span>${t('mark_completed')}</span>
        </button>`;
    } else {
      // Unlocked for subscribed/authenticated students
      pdfBtn = pdfUrl
        ? `<a href="${pdfUrl}" target="_blank" rel="noopener">${t('open_pdf')}</a>`
        : `<button disabled style="opacity:.4;cursor:not-allowed;">${t('no_pdf')}</button>`;
      videoBtn = c.videoUrl
        ? `<button class="watch-btn" data-id="${c.id}">${t('watch_video')}</button>`
        : `<button disabled style="opacity:.4;cursor:not-allowed;">${t('no_video')}</button>`;

      const isCompleted = Store.isCourseCompleted(user.email, c.id);
      completeBtn = `
        <button class="complete-toggle-btn ${isCompleted ? 'completed' : ''}" data-id="${c.id}" title="${isCompleted ? t('completed') : t('mark_completed')}">
          <span class="chk-icon">${isCompleted ? '✓' : '○'}</span>
          <span>${isCompleted ? t('completed') : t('mark_completed')}</span>
        </button>`;
    }

    const isCompleted = user ? Store.isCourseCompleted(user.email, c.id) : false;

    return `
      <div class="course-card reveal in ${isCompleted ? 'is-completed' : ''}" data-card-id="${c.id}">
        <div class="course-icon">${(c.code || 'CS').slice(0,2)}</div>
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span class="course-tag">${c.code}</span>
            <span class="type-pill ${c.type || 'course'}">${typeLabel}</span>
            ${isCompleted ? `<span class="completed-pill">✓ ${t('completed')}</span>` : ''}
          </div>
          <h4>${title}</h4>
          <p style="margin:0;">${desc}</p>
        </div>
        <div class="course-actions">
          ${pdfBtn}
          ${videoBtn}
          ${completeBtn}
        </div>
      </div>`;
  }).join('');

  // Locked buttons click listeners
  list.querySelectorAll('.locked-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openGoogleModal();
    });
  });

  list.querySelectorAll('.watch-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = resources.find(c=>c.id===btn.dataset.id);
      if(item) openVideoModal(item);
    });
  });

  list.querySelectorAll('.complete-toggle-btn:not(.locked-action-btn)').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const currentUser = getAuthUser();
      if(!currentUser){
        openGoogleModal();
        return;
      }
      const courseId = btn.dataset.id;
      const isDone = Store.toggleCourseCompletion(currentUser.email, courseId);
      showToast(isDone ? t('course_marked_done') : t('course_marked_undone'));
      renderCourses();
    });
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  currentYear = getYearParam();
  activeTab = getTabParam();

  // Render immediately from cache
  renderCourses();

  async function loadCoursesFromCloud() {
    const list = document.getElementById('course-list');
    if (list && !Store.getAllCourses().length) {
      list.innerHTML = `<div class="empty-state">${t('loading') || 'Loading courses…'}</div>`;
    }

    if (window.refreshCloudSync) {
      try { await window.refreshCloudSync(); } catch (e) { /* logged in firebase.js */ }
    } else if (window.cloudSyncReady) {
      try { await window.cloudSyncReady; } catch (e) { /* logged in firebase.js */ }
    }

    if (!Store.getAllCourses().length && Store.fetchCoursesFromCloud) {
      try { await Store.fetchCoursesFromCloud(); } catch (e) { console.warn('Direct cloud fetch failed', e); }
    }

    renderCourses();
  }

  window.refreshCoursesFromCloud = loadCoursesFromCloud;

  // Instant Year Switcher click listener
  document.querySelectorAll('#year-switcher a').forEach(a=>{
    a.addEventListener('click', async (e)=>{
      e.preventDefault();
      currentYear = Number(a.dataset.year) || 1;
      try { sessionStorage.setItem('csp_active_year', currentYear); } catch(err){}
      history.replaceState(null, '', `courses.html?year=${currentYear}&tab=${activeTab}`);
      try { localStorage.removeItem('csp_db_v4'); } catch(err){}
      if (window.Store && typeof Store.syncWithFirebase === 'function') {
        await Store.syncWithFirebase();
      }
      renderCourses();
    });
  });

  // Setup tab click listeners (Courses, TD, TP, Exam)
  document.querySelectorAll('#category-menu button.tab-btn').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      activeTab = btn.dataset.tab;
      history.replaceState(null, '', `courses.html?year=${currentYear}&tab=${activeTab}`);
      try { localStorage.removeItem('csp_db_v4'); } catch(err){}
      if (window.Store && typeof Store.syncWithFirebase === 'function') {
        await Store.syncWithFirebase();
      }
      renderCourses();
    });
  });

  // Handle Quiz tab click to keep active year
  const quizTabLink = document.getElementById('tab-quiz');
  if (quizTabLink) {
    quizTabLink.addEventListener('click', (e) => {
      e.preventDefault();
      try { localStorage.removeItem('csp_db_v4'); } catch(err){}
      location.href = `quiz.html?year=${currentYear}`;
    });
  }

  try { localStorage.removeItem('csp_db_v4'); } catch(err){}
  await loadCoursesFromCloud();

  // Mobile browsers / back button: re-fetch immediately on focus and show
  window.addEventListener('pageshow', async () => {
    try { localStorage.removeItem('csp_db_v4'); } catch(err){}
    await loadCoursesFromCloud();
  });
  window.addEventListener('focus', async () => {
    try { localStorage.removeItem('csp_db_v4'); } catch(err){}
    if (window.Store && typeof Store.syncWithFirebase === 'function') {
      await Store.syncWithFirebase();
      renderCourses();
    }
  });

  document.getElementById('modal-close').addEventListener('click', closeVideoModal);
  document.getElementById('video-modal').addEventListener('click', (e)=>{
    if(e.target.id==='video-modal') closeVideoModal();
  });
  document.addEventListener('langchange', renderCourses);
  document.addEventListener('userchange', renderCourses);
  document.addEventListener('dbupdated', renderCourses);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.refreshCloudSync) {
      window.refreshCloudSync().then(() => renderCourses());
    }
  });
});

