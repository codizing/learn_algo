let quizState = { year: 1, questions: [], index: 0, score: 0, started: false, answered: false };

function getYearParam(){
  const p = new URLSearchParams(location.search);
  const y = Number(p.get('year'));
  if ([1, 2].includes(y)) {
    try { sessionStorage.setItem('csp_active_year', y); } catch(e){}
    return y;
  }
  try {
    const saved = Number(sessionStorage.getItem('csp_active_year'));
    if ([1, 2].includes(saved)) return saved;
  } catch(e){}
  return 1;
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

function initQuiz(){
  const year = getYearParam();
  const lang = getLang();
  quizState = { year, questions: Store.getQuiz(year), index:0, score:0, started:false, answered:false };

  // Update Year switcher
  document.querySelectorAll('#year-switcher a').forEach(a=>{
    const aYear = Number(a.dataset.year);
    a.classList.toggle('active', aYear === year);
    a.href = `quiz.html?year=${aYear}`;
    a.textContent = '• ' + (lang==='fr' ? (aYear===1?'1ère Année':'2ème Année') : (aYear===1?'1st Year':'2nd Year'));
  });

  // Update Category Menu links to strictly stay in the chosen year
  const cLink = document.getElementById('link-courses');
  const tdLink = document.getElementById('link-td');
  const tpLink = document.getElementById('link-tp');
  const exLink = document.getElementById('link-exams');
  const qzLink = document.getElementById('link-quiz');

  if(cLink) cLink.href = `courses.html?year=${year}&tab=course`;
  if(tdLink) tdLink.href = `courses.html?year=${year}&tab=td`;
  if(tpLink) tpLink.href = `courses.html?year=${year}&tab=tp`;
  if(exLink) exLink.href = `courses.html?year=${year}&tab=exam`;
  if(qzLink) qzLink.href = `quiz.html?year=${year}`;

  updateCounts(year);
  renderQuiz();
}

function renderQuiz(){
  const lang = getLang();
  const area = document.getElementById('quiz-area');
  const bar = document.getElementById('progress-bar');
  const total = quizState.questions.length;

  if(!total){
    bar.style.width='0%';
    area.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-l);">${lang==='fr' ? 'Aucune question de quiz ajoutée pour cette année.' : 'No quiz questions added for this year yet.'}</div>`;
    return;
  }

  if(!quizState.started){
    bar.style.width='0%';
    const user = typeof getAuthUser === 'function' ? getAuthUser() : null;
    const btnLabel = user ? t('quiz_start') : `🔒 ${t('quiz_start')}`;
    area.innerHTML = `
      <div class="quiz-card" style="text-align:center;">
        <p style="max-width:44ch;margin:0 auto 20px;">${total} ${lang==='fr'?'questions vous attendent pour l\'année '+quizState.year+'.':'questions await for year '+quizState.year+'.'}</p>
        <button class="btn btn-primary" id="start-btn">${btnLabel}</button>
      </div>`;
    document.getElementById('start-btn').addEventListener('click', ()=>{
      const currentUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
      if(!currentUser){
        openGoogleModal();
        return;
      }
      quizState.started = true;
      renderQuiz();
    });
    return;
  }

  if(quizState.index >= total){
    bar.style.width='100%';
    const user = typeof getAuthUser === 'function' ? getAuthUser() : null;
    if(user && !quizState.saved){
      quizState.saved = true;
      Store.saveQuizResult(user.email, {
        year: quizState.year,
        score: quizState.score,
        total: total
      });
    }

    const savedNotice = user
      ? `<div style="margin-top:12px;font-size:13px;color:var(--cyan);font-weight:500;">✓ ${t('quiz_saved_progress')} (${user.name})</div>`
      : `<div style="margin-top:12px;font-size:13px;color:var(--text-faint);"><a href="#" id="quiz-login-prompt" style="color:var(--cyan);text-decoration:underline;">${t('nav_login')}</a> ${t('quiz_login_to_save')}</div>`;

    area.innerHTML = `
      <div class="quiz-card quiz-result">
        <div class="score">${quizState.score}/${total}</div>
        <h3 data-i18n="quiz_result_title">${t('quiz_result_title')}</h3>
        <p>${t('quiz_result_sub')}</p>
        ${savedNotice}
        <div class="hero-actions" style="justify-content:center;margin-top:24px;">
          <button class="btn btn-primary" id="retry-btn">${t('quiz_retry')}</button>
          <a href="courses.html?year=${quizState.year}" class="btn btn-ghost">${t('quiz_back_courses')}</a>
        </div>
      </div>`;

    const loginPrompt = document.getElementById('quiz-login-prompt');
    if(loginPrompt){
      loginPrompt.addEventListener('click', (e)=>{
        e.preventDefault();
        openGoogleModal();
      });
    }

    document.getElementById('retry-btn').addEventListener('click', initQuiz);
    return;
  }

  const q = quizState.questions[quizState.index];
  if (!q) {
    quizState.index = 0;
    renderQuiz();
    return;
  }
  const qText = (lang==='fr' ? (q.q_fr || q.q_en) : (q.q_en || q.q_fr)) || 'Question';
  const opts = (lang==='fr' ? (q.opts_fr || q.opts_en) : (q.opts_en || q.opts_fr)) || [];
  bar.style.width = `${(quizState.index/total)*100}%`;
  quizState.answered = false;

  area.innerHTML = `
    <div class="quiz-card">
      <div class="quiz-q-meta">${t('quiz_question_label')} ${quizState.index+1} ${t('quiz_of')} ${total} — ${lang==='fr'?'Année':'Year'} ${quizState.year}</div>
      <div class="quiz-question">${qText}</div>
      <div class="quiz-options">
        ${opts.map((opt,i)=>`
          <button class="quiz-option" data-i="${i}">
            <span class="letter">${String.fromCharCode(65+i)}</span> <span>${opt}</span>
          </button>`).join('')}
      </div>
      <div class="quiz-footer">
        <span></span>
        <button class="btn btn-primary" id="next-btn" style="display:none;">${t('quiz_next')}</button>
      </div>
    </div>`;

  const optionBtns = area.querySelectorAll('.quiz-option');
  optionBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(quizState.answered) return;
      quizState.answered = true;
      const chosen = Number(btn.dataset.i);
      optionBtns.forEach(b=> b.disabled = true);
      if(chosen === q.correct){
        btn.classList.add('correct');
        quizState.score++;
      } else {
        btn.classList.add('wrong');
        optionBtns[q.correct].classList.add('correct');
      }
      const nextBtn = document.getElementById('next-btn');
      nextBtn.style.display = 'inline-flex';
      nextBtn.textContent = (quizState.index === total-1) ? t('quiz_finish') : t('quiz_next');
      nextBtn.addEventListener('click', ()=>{ quizState.index++; renderQuiz(); }, { once:true });
    });
  });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  async function loadQuizFromCloud() {
    const area = document.getElementById('quiz-area');
    if (area && !quizState.questions.length && !quizState.started) {
      const lang = getLang();
      area.innerHTML = `<div class="empty-state" style="padding:40px 20px;text-align:center;">${lang==='fr'?'Chargement des questions...':'Loading quiz questions...'}</div>`;
    }

    if (window.refreshCloudSync) {
      try { await window.refreshCloudSync(); } catch (e) {}
    } else if (window.cloudSyncReady) {
      try { await window.cloudSyncReady; } catch (e) {}
    }

    if (window.Store) {
      if (Store.fetchCoursesFromCloud) {
        try { await Store.fetchCoursesFromCloud(); } catch (e) {}
      }
      if (Store.fetchQuizzesFromCloud) {
        try { await Store.fetchQuizzesFromCloud(); } catch (e) {}
      }
    }

    if (!quizState.started) {
      initQuiz();
    }
  }

  window.refreshQuizFromCloud = loadQuizFromCloud;

  // Instant Year Switcher click listener in quiz
  document.querySelectorAll('#year-switcher a').forEach(a=>{
    const triggerYear = async (e)=>{
      e.preventDefault();
      const y = Number(a.dataset.year) || 1;
      try { sessionStorage.setItem('csp_active_year', y); } catch(err){}
      history.replaceState(null, '', `quiz.html?year=${y}`);
      initQuiz();
      await loadQuizFromCloud();
    };
    a.addEventListener('click', triggerYear);
    a.addEventListener('touchstart', triggerYear, { passive: true });
  });

  // 1. Initial render from memory
  initQuiz();

  // 2. Fetch fresh from cloud and populate questions and counts
  await loadQuizFromCloud();

  document.addEventListener('langchange', renderQuiz);
  document.addEventListener('userchange', () => {
    if (!quizState.started) {
      initQuiz();
    }
  });
  document.addEventListener('dbupdated', () => {
    updateCounts(getYearParam());
    if (!quizState.started) {
      initQuiz();
    }
  });

  // Refresh on tab focus / page show
  window.addEventListener('pageshow', async () => {
    await loadQuizFromCloud();
  });
  window.addEventListener('focus', async () => {
    await loadQuizFromCloud();
  });
});

function currentYearFromUrl(){
  const p = new URLSearchParams(location.search);
  const y = Number(p.get('year'));
  return [1,2].includes(y) ? y : 1;
}
