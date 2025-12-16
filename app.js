let all_data = {};
let question_lookup = {};
let favorites = [];
let wrongAnswersByChapter = {};
let quizQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let quizLength = 0;
let activeChapterButton = null;
let activeChapter = null;
let activeType = null;
let quizState = 'IDLE'; // 'IDLE', 'ANSWERING', 'FEEDBACK'

const FAVORITES_KEY = 'mech_design_quiz_favorites';
const WRONG_ANSWERS_KEY = 'mech_design_wrong_answers_by_chapter';
const THEME_KEY = 'mech_design_theme';

// --- 所有功能函数 ---
function typesetMath(elements) {
    if (window.MathJax && elements && elements.length > 0) {
        try {
            MathJax.typesetPromise(elements).catch(function (err) {
                console.error('MathJax typeset failed: ' + err.message);
            });
        } catch(err) {
             console.error('MathJax error: ' + err.message);
        }
    }
}

function loadWrongAnswers() {
    const stored = localStorage.getItem(WRONG_ANSWERS_KEY);
    wrongAnswersByChapter = stored ? JSON.parse(stored) : {};
}

function saveWrongAnswers() {
    localStorage.setItem(WRONG_ANSWERS_KEY, JSON.stringify(wrongAnswersByChapter));
}

function addWrongAnswer(qid, chapter) {
    if (!wrongAnswersByChapter[chapter]) {
        wrongAnswersByChapter[chapter] = [];
    }
    if (!wrongAnswersByChapter[chapter].includes(qid)) {
        wrongAnswersByChapter[chapter].push(qid);
        saveWrongAnswers();
        updateChapterNavStatus();
    }
}

function removeSingleWrongAnswer(qid, chapter, buttonElement) {
    const chapterWrongAnswers = wrongAnswersByChapter[chapter];
    if (chapterWrongAnswers) {
        const index = chapterWrongAnswers.indexOf(qid);
        if (index > -1) {
            chapterWrongAnswers.splice(index, 1);
            if (chapterWrongAnswers.length === 0) {
                delete wrongAnswersByChapter[chapter];
            }
            saveWrongAnswers();
            buttonElement.closest('.question-block').remove();
            updateChapterNavStatus();

            const remaining = document.querySelectorAll('#content-area .question-block.visible').length;
            if (remaining === 0) {
                 document.getElementById('welcome-message').style.display = 'block';
                 document.getElementById('welcome-message').innerHTML = `<p>本章错题已全部移除！</p>`;
                 updateGlobalControls(false);
            }
        }
    }
}

function showChapterWrongAnswers(chapterName, clickedButton) {
    activeChapter = chapterName;
    activeType = null;
    
    document.getElementById('welcome-message').style.display = 'none';
    updateGlobalControls(true, { showChapterWrongClear: true, showChapterWrongTest: true });
    
    if (activeChapterButton) activeChapterButton.classList.remove('active');
    clickedButton.classList.add('active');
    activeChapterButton = clickedButton;

    document.getElementById('main-title').textContent = `${chapterName} - 错题回顾`;

    const chapterWrongQids = wrongAnswersByChapter[chapterName] || [];
    let visibleBlocks = [];
    document.querySelectorAll('.question-block').forEach(block => {
        const removeBtn = block.querySelector('.remove-wrong-answer-btn');
        if (chapterWrongQids.includes(block.dataset.qid)) {
            block.classList.add('visible');
            if (removeBtn) removeBtn.style.display = 'inline-block';
            visibleBlocks.push(block);
        } else {
            block.classList.remove('visible');
            if (removeBtn) removeBtn.style.display = 'none';
        }
    });
    typesetMath(visibleBlocks);

    if (chapterWrongQids.length === 0) {
        updateGlobalControls(false);
        document.getElementById('welcome-message').style.display = 'block';
        document.getElementById('welcome-message').innerHTML = `<p>本章没有错题记录，继续保持！</p>`;
    }
}

function clearCurrentChapterWrongAnswers() {
    if (activeChapter && wrongAnswersByChapter[activeChapter]) {
        if (confirm(`您确定要清空【${activeChapter}】的所有错题记录吗？`)) {
            delete wrongAnswersByChapter[activeChapter];
            saveWrongAnswers();
            showChapterWrongAnswers(activeChapter, activeChapterButton);
            updateChapterNavStatus();
        }
    }
}

function loadFavorites() {
    const storedFavorites = localStorage.getItem(FAVORITES_KEY);
    favorites = storedFavorites ? JSON.parse(storedFavorites) : [];
}

function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function toggleFavorite(qid, buttonElement) {
    const index = favorites.indexOf(qid);
    if (index > -1) {
        favorites.splice(index, 1);
        buttonElement.classList.remove('favorited');
        buttonElement.classList.remove('favorited');
        buttonElement.innerHTML = '<i class="fa-regular fa-star"></i> 收藏';
    } else {
        favorites.push(qid);
        buttonElement.classList.add('favorited');
        buttonElement.classList.add('favorited');
        buttonElement.innerHTML = '<i class="fa-solid fa-star"></i> 已收藏';
    }
    saveFavorites();
    const mainButton = document.querySelector(`.question-block[data-qid="${qid}"] .favorite-button`);
    if (mainButton) {
        if (favorites.includes(qid)) {
            mainButton.classList.add('favorited');
            mainButton.classList.add('favorited');
            mainButton.innerHTML = '<i class="fa-solid fa-star"></i> 已收藏';
        } else {
            mainButton.classList.remove('favorited');
            mainButton.classList.remove('favorited');
            mainButton.innerHTML = '<i class="fa-regular fa-star"></i> 收藏';
        }
    }
}

function toggleFavoritesView() {
    const favBtn = document.getElementById('toggle-favorites-btn');
    const isShowingAll = favBtn.textContent === '只显示收藏';

    if (isShowingAll) {
        const visibleBlocks = document.querySelectorAll('.question-block.visible');
        let hasFavoritesInView = false;
        visibleBlocks.forEach(block => {
            if (!favorites.includes(block.dataset.qid)) {
                block.classList.remove('visible');
            } else {
                hasFavoritesInView = true;
            }
        });
        if (!hasFavoritesInView) {
             document.getElementById('welcome-message').style.display = 'block';
             document.getElementById('welcome-message').innerHTML = '<p>当前章节下没有已收藏的题目。</p>';
        } else {
            document.getElementById('welcome-message').style.display = 'none';
        }
        favBtn.textContent = '显示全部';
    } else {
        if (activeChapter && activeType) {
            showQuestions(activeChapter, activeType, activeChapterButton);
        }
    }
}

function toggleAllAnswers() {
    const toggleBtn = document.getElementById('toggle-all-answers-btn');
    const shouldShow = toggleBtn.textContent === '显示全部答案';
    const visibleSpans = document.querySelectorAll('.question-block.visible .answer-span, .question-block.visible .explanation-span');
    visibleSpans.forEach(span => {
        if (span.classList.contains('explanation-span')) {
            span.style.display = shouldShow ? 'block' : 'none';
        } else {
            span.style.display = shouldShow ? 'inline' : 'none';
        }
    });
    if (shouldShow) {
        typesetMath(Array.from(visibleSpans));
    }
    toggleBtn.textContent = shouldShow ? '隐藏全部答案' : '显示全部答案';
}

function setupTheme() {
    const toggleSwitch = document.getElementById('dark-mode-switch');
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        toggleSwitch.checked = true;
    }
    toggleSwitch.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem(THEME_KEY, 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem(THEME_KEY, 'light');
        }
    });
}

function setupMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    menuToggle.addEventListener('click', () => {
        document.body.classList.toggle('sidebar-open');
    });

    sidebar.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON' && window.innerWidth <= 992) {
            document.body.classList.remove('sidebar-open');
        }
    });
}

function processData() {
    mcq_data.forEach((q, i) => {
        const qid = `mcq_${i}`;
        q.qid = qid;
        q.type = 'mcq'; 
        if (!all_data[q.chapter]) {
            all_data[q.chapter] = { mcq: [], tf: [] };
        }
        all_data[q.chapter].mcq.push(q); 
        question_lookup[qid] = q;
    });

    tf_data.forEach((q, i) => {
        const qid = `tf_${i}`;
        q.qid = qid;
        q.type = 'tf'; 
        if (!all_data[q.chapter]) {
            all_data[q.chapter] = { mcq: [], tf: [] };
        }
        all_data[q.chapter].tf.push(q); 
        question_lookup[qid] = q;
    });
}

function createNavigationAndContent() {
    const chapterNavList = document.getElementById('chapter-nav-list');
    const contentArea = document.getElementById('content-area');
    chapterNavList.innerHTML = '';
    contentArea.innerHTML = '';

    Object.keys(all_data).sort((a, b) => {
        const numA = parseInt(a.match(/第(\S+)章/)[1].replace(/[\u4e00-\u9fa5]/g, match => ' 一二三四五六七八九十'.indexOf(match)));
        const numB = parseInt(b.match(/第(\S+)章/)[1].replace(/[\u4e00-\u9fa5]/g, match => ' 一二三四五六七八九十'.indexOf(match)));
        return numA - numB;
    }).forEach(chapterName => {
        const details = document.createElement('details');
        details.dataset.chapterName = chapterName;
        
        const summary = document.createElement('summary');
        summary.textContent = chapterName;
        details.appendChild(summary);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'chapter-button-container';
        
        const wrongBtn = Object.assign(document.createElement('button'), {
            className: 'chapter-wrong-button',
            onclick: e => showChapterWrongAnswers(chapterName, e.currentTarget)
        });
        buttonContainer.appendChild(wrongBtn);
        
        const mcqBtn = Object.assign(document.createElement('button'), {
            className: 'chapter-type-button', innerHTML: '<i class="fa-solid fa-list-ul"></i> 选择题',
            onclick: e => showQuestions(chapterName, 'mcq', e.currentTarget)
        });
        buttonContainer.appendChild(mcqBtn);

        const tfBtn = Object.assign(document.createElement('button'), {
            className: 'chapter-type-button', innerHTML: '<i class="fa-solid fa-check-double"></i> 判断题',
            onclick: e => showQuestions(chapterName, 'tf', e.currentTarget)
        });
        buttonContainer.appendChild(tfBtn);

        const testBtn = Object.assign(document.createElement('button'), {
            className: 'chapter-test-button', innerHTML: '<i class="fa-solid fa-flask"></i> 本章测试',
            onclick: () => startChapterTest(chapterName)
        });
        buttonContainer.appendChild(testBtn);

        details.appendChild(buttonContainer);
        chapterNavList.appendChild(details);
    });

    [...mcq_data, ...tf_data].forEach(q => contentArea.appendChild(createQuestionBlock(q)));
    updateChapterNavStatus();
}

function updateChapterNavStatus() {
    document.querySelectorAll('#chapter-nav-list details').forEach(detail => {
        const chapterName = detail.dataset.chapterName;
        const wrongBtn = detail.querySelector('.chapter-wrong-button');
        const wrongCount = (wrongAnswersByChapter[chapterName] || []).length;
        if (wrongCount > 0) {
            wrongBtn.textContent = `本章错题 (${wrongCount})`;
            wrongBtn.disabled = false;
        } else {
            wrongBtn.textContent = '本章错题 (0)';
            wrongBtn.disabled = true;
        }
    });
}

function createQuestionBlock(item) {
    const block = document.createElement('div');
    block.className = 'question-block';
    block.dataset.qid = item.qid;
    block.dataset.chapter = item.chapter;
    block.dataset.type = item.type;

    let explanationHtml = '';
    if (item.explanation) {
        explanationHtml = (typeof marked !== 'undefined' && marked.parse) ? marked.parse(item.explanation) : item.explanation;
    }

    block.innerHTML = `
        <p>${item.question.replace(/(\(|\（)\s*(\)|\）)/, ' (   ) ')}</p>
        ${item.type === 'mcq' ? `<ul>${item.options.map(o => `<li>${o}</li>`).join('')}</ul>` : ''}
        <div class="action-buttons-container">
            <button class="action-button" onclick="this.nextElementSibling.style.display='inline'; this.nextElementSibling.nextElementSibling.style.display='block'; typesetMath([this.nextElementSibling.nextElementSibling]);"><i class="fa-regular fa-eye"></i> 显示答案</button>
            <span class="answer-span">答案: ${item.answer}</span>
            <div class="explanation-span">${explanationHtml ? `<b>解析：</b>${explanationHtml}` : ''}</div>
            <button class="action-button favorite-button ${favorites.includes(item.qid) ? 'favorited' : ''}" onclick="toggleFavorite('${item.qid}', this)">${favorites.includes(item.qid) ? '<i class="fa-solid fa-star"></i> 已收藏' : '<i class="fa-regular fa-star"></i> 收藏'}</button>
            <button class="action-button remove-wrong-answer-btn" onclick="removeSingleWrongAnswer('${item.qid}', '${item.chapter}', this)"><i class="fa-solid fa-trash-can"></i> 移除此题</button>
        </div>
    `;
    return block;
}

function updateGlobalControls(show, options = {}) {
    document.getElementById('global-controls').style.display = show ? 'flex' : 'none';
    if (!show) return;

    document.getElementById('toggle-favorites-btn').style.display = 'none';
    document.getElementById('clear-chapter-wrong-answers-btn').style.display = 'none';
    document.getElementById('test-chapter-wrong-btn').style.display = 'none';
    
    if (options.showFavoriteFilter) document.getElementById('toggle-favorites-btn').style.display = 'inline-block';
    if (options.showChapterWrongClear) document.getElementById('clear-chapter-wrong-answers-btn').style.display = 'inline-block';
    if (options.showChapterWrongTest) document.getElementById('test-chapter-wrong-btn').style.display = 'inline-block';
    
    document.getElementById('toggle-all-answers-btn').textContent = '显示全部答案';
    document.getElementById('toggle-favorites-btn').textContent = '只显示收藏';
}

function showQuestions(chapter, type, clickedButton) {
    activeChapter = chapter;
    activeType = type;

    document.getElementById('welcome-message').style.display = 'none';
    updateGlobalControls(true, { showFavoriteFilter: true });
    
    document.getElementById('main-title').textContent = `${chapter} - ${type === 'mcq' ? '选择题' : '判断题'}`;

    if (activeChapterButton) activeChapterButton.classList.remove('active');
    clickedButton.classList.add('active');
    activeChapterButton = clickedButton;

    let visibleBlocks = [];
    document.querySelectorAll('.question-block').forEach(block => {
        const removeBtn = block.querySelector('.remove-wrong-answer-btn');
        if (removeBtn) removeBtn.style.display = 'none';
        if (block.dataset.chapter === chapter && block.dataset.type === type) {
            block.classList.add('visible');
            visibleBlocks.push(block);
        } else {
            block.classList.remove('visible');
        }
    });
    typesetMath(visibleBlocks);
}

function showAllFavorites() {
    activeChapter = null;
    activeType = null;
    
    document.getElementById('welcome-message').style.display = 'none';
    updateGlobalControls(true);
    document.getElementById('main-title').textContent = '我的收藏';

    if (activeChapterButton) {
        activeChapterButton.classList.remove('active');
        activeChapterButton = null;
    }

    let hasFavorites = false;
    let visibleBlocks = [];
    document.querySelectorAll('.question-block').forEach(block => {
        const removeBtn = block.querySelector('.remove-wrong-answer-btn');
        if (removeBtn) removeBtn.style.display = 'none';
        if (favorites.includes(block.dataset.qid)) {
            block.classList.add('visible');
            visibleBlocks.push(block);
            hasFavorites = true;
        } else {
            block.classList.remove('visible');
        }
    });
    typesetMath(visibleBlocks);

    if (!hasFavorites) {
        updateGlobalControls(false);
        document.getElementById('welcome-message').style.display = 'block';
        document.getElementById('welcome-message').innerHTML = '<p>你还没有收藏任何题目。</p>';
    }
}

function filterQuestions(query) {
    const searchTerm = query.trim().toLowerCase();
    
    // Clear active states
    if (activeChapterButton) {
        activeChapterButton.classList.remove('active');
        activeChapterButton = null;
    }
    
    if (searchTerm.length === 0) {
        // Reset view: hide all questions, show welcome message
        document.querySelectorAll('.question-block').forEach(b => b.classList.remove('visible'));
        
        document.getElementById('welcome-message').style.display = 'block';
        document.getElementById('welcome-message').innerHTML = '<p>请从左侧选择一个章节和题型开始练习。</p><p>或者输入关键词搜索题目。</p>';
        updateGlobalControls(false);
        document.getElementById('main-title').textContent = '欢迎使用机械设计基础自测题库';
        return;
    }

    document.getElementById('welcome-message').style.display = 'none';
    updateGlobalControls(true, { showFavoriteFilter: true }); // Enable favorites filter even in search
    document.getElementById('main-title').textContent = `搜索结果: "${query}"`;
    
    // Do NOT clear innerHTML, as it destroys the question blocks needed for the rest of the app
    // const contentArea = document.getElementById('content-area');
    // contentArea.innerHTML = ''; 
    
    // Optimization: querySelectorAll is fast enough for < 2000 items.
    let count = 0;
    document.querySelectorAll('.question-block').forEach(block => {
        // use textContent instead of innerText because innerText ignores hidden elements (display: none)
        const text = block.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            block.classList.add('visible');
            count++;
        } else {
            block.classList.remove('visible');
        }
    });

    if (count === 0) {
        updateGlobalControls(false);
        document.getElementById('welcome-message').style.display = 'block';
        document.getElementById('welcome-message').innerHTML = `<p>未找到包含 "${query}" 的题目。</p>`;
    } else {
        // Typeset only visible - might be heavy if many results, but okay for filter.
        // To avoid freezing, maybe only typeset matches?
        // typesetMath(document.querySelectorAll('.question-block.visible')); 
        // MathJax typeset is heavy, let's skip auto-typeset on search for now unless user reveals answer? 
        // Or just typeset the first few? 
        // Actually the blocks might already be typeset if they were viewed before?
        // MathJax 3 acts globally usually. 
        // Let's just typeset visible matches.
         typesetMath(document.querySelectorAll('.question-block.visible'));
    }
}

function startChapterTest(chapterName) {
    const chapterData = all_data[chapterName];
    if (!chapterData || (chapterData.mcq.length === 0 && chapterData.tf.length === 0)) {
        alert('该章节没有题目可供测试！'); return;
    }
    startQuiz([...chapterData.mcq, ...chapterData.tf], 0, `${chapterName} - 随机测试`);
}

function startOverallTest(type) {
    const questionPool = (type === 'mcq' ? mcq_data : tf_data);
    startQuiz(questionPool, 20, type === 'mcq' ? '选择题综合测试' : '判断题综合测试');
}

function startAllWrongAnswersTest() {
    const allWrongQids = Object.values(wrongAnswersByChapter).flat();
    if (allWrongQids.length === 0) {
        alert('您的错题本是空的，无法开始测试！'); return;
    }
    const questionPool = allWrongQids.map(qid => question_lookup[qid]);
    startQuiz(questionPool, 0, '所有错题随机测试');
}

function startCurrentChapterWrongAnswersTest() {
    if (!activeChapter) return;
    const chapterWrongQids = wrongAnswersByChapter[activeChapter] || [];
    if (chapterWrongQids.length === 0) {
        alert('本章没有错题，无法开始测试！'); return;
    }
    const questionPool = chapterWrongQids.map(qid => question_lookup[qid]);
    startQuiz(questionPool, 0, `【${activeChapter}】错题测试`);
}

function startQuiz(questionPool, numQuestions, title) {
    score = 0;
    currentQuestionIndex = 0;
    
    quizQuestions = [...questionPool].sort(() => 0.5 - Math.random());
    if (numQuestions > 0 && numQuestions < quizQuestions.length) {
        quizQuestions = quizQuestions.slice(0, numQuestions);
    }
    quizLength = quizQuestions.length;

    if (quizLength === 0) { alert('没有可供测试的题目！'); return; }

    document.getElementById('quiz-title').textContent = title;
    document.getElementById('quiz-score').style.display = 'none';
    document.getElementById('quiz-content').style.display = 'block';
    document.getElementById('quiz-modal').style.display = 'block';

    displayQuizQuestion();
}

// Exam Variables
let examTimerInterval = null;
let examTimeRemaining = 0;

function startMockExam() {
    // 30 MCQ + 20 TF
    const mcqs = [...mcq_data].sort(() => 0.5 - Math.random()).slice(0, 30);
    const tfs = [...tf_data].sort(() => 0.5 - Math.random()).slice(0, 20);
    const questions = [...mcqs, ...tfs].sort(() => 0.5 - Math.random()); // Mix them? Or keep separate? Mixed is harder.
    
    startQuiz(questions, 50, '模拟考试 (20分钟)');
    
    // Override standard quiz setup for Exam Mode
    quizState = 'EXAM';
    document.getElementById('quiz-timer').style.display = 'block';
    
    examTimeRemaining = 20 * 60; 
    updateTimerDisplay();
    
    if (examTimerInterval) clearInterval(examTimerInterval);
    examTimerInterval = setInterval(() => {
        examTimeRemaining--;
        updateTimerDisplay();
        if (examTimeRemaining <= 0) {
            clearInterval(examTimerInterval);
            alert('考试时间到！即将提交试卷。');
            closeQuiz(); 
            showQuizResults(); 
        }
    }, 1000);
}

function updateTimerDisplay() {
    const m = Math.floor(examTimeRemaining / 60).toString().padStart(2, '0');
    const s = (examTimeRemaining % 60).toString().padStart(2, '0');
    const timerEl = document.getElementById('quiz-timer');
    timerEl.textContent = `${m}:${s}`;
    if (examTimeRemaining < 60) {
        timerEl.style.color = 'var(--error)';
    } else {
        timerEl.style.color = 'var(--primary)';
    }
}

function closeQuiz() {
    document.getElementById('quiz-modal').style.display = 'none';
    document.getElementById('quiz-timer').style.display = 'none';
    if (examTimerInterval) clearInterval(examTimerInterval);
    quizState = 'IDLE';
}

function displayQuizQuestion() {
    if (currentQuestionIndex < quizLength) {
        const question = quizQuestions[currentQuestionIndex];
        const questionContainer = document.getElementById('quiz-question-container');
        const instructionsEl = document.getElementById('keyboard-instructions');
        
        instructionsEl.textContent = question.type === 'mcq' ? 
            '提示：使用键盘 A/B/C/D 或 1/2/3/4 选择，Enter 确认，Space跳过。' : 
            '提示：使用键盘 T/1(对) / F/2(错) 选择，Enter 确认，Space跳过。';

        document.getElementById('quiz-question-text').innerHTML = question.question.replace(/(\(|\（)\s*(\)|\）)/, ' (   ) ');
        const optionsContainer = document.getElementById('quiz-options');
        optionsContainer.innerHTML = '';

        const favBtn = document.getElementById('quiz-favorite-btn');
        favBtn.style.display = 'inline-block';
        favBtn.className = `action-button favorite-button ${favorites.includes(question.qid) ? 'favorited' : ''}`;
        favBtn.innerHTML = favorites.includes(question.qid) ? '<i class="fa-solid fa-star"></i> 已收藏' : '<i class="fa-regular fa-star"></i> 收藏';
        favBtn.onclick = () => toggleFavorite(question.qid, favBtn);

        if (question.type === 'mcq') {
            question.options.forEach(option => {
                const label = document.createElement('label');
                const radio = Object.assign(document.createElement('input'), { type: 'radio', name: 'quizOption', value: option.charAt(0) });
                label.appendChild(radio);
                label.appendChild(document.createTextNode(option));
                optionsContainer.appendChild(label);
            });
        } else {
            const labelTrue = document.createElement('label');
            const radioTrue = Object.assign(document.createElement('input'), { type: 'radio', name: 'quizOption', value: '✓' });
            labelTrue.appendChild(radioTrue);
            labelTrue.appendChild(document.createTextNode('✓ 正确'));

            const labelFalse = document.createElement('label');
            const radioFalse = Object.assign(document.createElement('input'), { type: 'radio', name: 'quizOption', value: '×' });
            labelFalse.appendChild(radioFalse);
            labelFalse.appendChild(document.createTextNode('× 错误'));

            optionsContainer.appendChild(labelTrue);
            optionsContainer.appendChild(labelFalse);
        }

        document.getElementById('quiz-progress').textContent = `进度: ${currentQuestionIndex + 1} / ${quizLength}`;
        document.getElementById('quiz-feedback').style.display = 'none';
        document.getElementById('submit-answer-btn').style.display = 'inline-block';
        document.getElementById('next-question-btn').style.display = 'none';
        
        // MathJax typeset for the new question content
        // MathJax typeset for the new question content
        typesetMath([questionContainer]);
        
        quizState = 'ANSWERING'; // Enable input

    } else {
        showQuizResults();
    }
}

function submitQuizAnswer(skipped = false) {
    let userAnswer = null;
    if (!skipped) {
        const selectedOption = document.querySelector('input[name="quizOption"]:checked');
        if (!selectedOption) { alert('请先选择一个答案！'); return; }
        userAnswer = selectedOption.value;
    }
    
    const question = quizQuestions[currentQuestionIndex];
    const isCorrect = !skipped && (userAnswer === question.answer);
    
    updateStats(question, isCorrect); // Track stats

    if (isCorrect) score++;
    else addWrongAnswer(question.qid, question.chapter);

    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.className = isCorrect ? 'correct' : 'incorrect';
    let explanationText = question.explanation || '暂无解析';
    if (typeof marked !== 'undefined' && marked.parse) {
        explanationText = marked.parse(explanationText);
    }
    
    const feedbackPrefix = isCorrect ? '回答正确！' : (skipped ? '已跳过。' : '回答错误。');
    feedbackEl.innerHTML = `${feedbackPrefix}${isCorrect ? '' : `正确答案是：${question.answer}`}` + 
        `<br><br><div class="explanation-span">解析：${explanationText}</div>`;
    feedbackEl.style.display = 'block';

    // MathJax typeset for the explanation in feedback
    typesetMath([feedbackEl]);

    document.getElementById('submit-answer-btn').style.display = 'none';
    document.getElementById('next-question-btn').style.display = 'inline-block';
    
    quizState = 'FEEDBACK'; // Update state
}

function nextQuizQuestion() {
    currentQuestionIndex++;
    displayQuizQuestion();
}

function showQuizResults() {
    document.getElementById('quiz-content').style.display = 'none';
    const scoreEl = document.getElementById('quiz-score');
    scoreEl.style.display = 'block';
    scoreEl.innerHTML = `
        <h3>测试结束！</h3>
        <p>你的得分: <span style="color:var(--primary-color);font-size:1.5em;">${score}</span> / ${quizLength}</p>
        <p>正确率: ${Math.round((score / quizLength) * 100)}%</p>
        <button class="quiz-button" onclick="closeQuiz()" style="background-color:var(--secondary-color);">关闭</button>
    `;
    quizState = 'IDLE';
}


const STATS_KEY = 'mech_design_user_stats';
let userStats = { total: 0, correct: 0, chapterStats: {} };

function loadStats() {
    const stored = localStorage.getItem(STATS_KEY);
    if (stored) {
        userStats = JSON.parse(stored);
    }
}

function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(userStats));
}

function updateStats(question, isCorrect) {
    userStats.total++;
    if (isCorrect) userStats.correct++;
    
    if (!userStats.chapterStats[question.chapter]) {
        userStats.chapterStats[question.chapter] = { total: 0, correct: 0 };
    }
    userStats.chapterStats[question.chapter].total++;
    if (isCorrect) userStats.chapterStats[question.chapter].correct++;
    
    saveStats();
}

function showDashboard() {
    loadStats();
    document.getElementById('dashboard-modal').style.display = 'block';
    
    // Summary
    document.getElementById('stat-total').textContent = userStats.total;
    const rate = userStats.total === 0 ? 0 : Math.round((userStats.correct / userStats.total) * 100);
    document.getElementById('stat-correct').textContent = `${rate}%`;
    document.getElementById('stat-correct').style.color = rate >= 60 ? 'var(--success)' : 'var(--error)';
    
    // Calculate total wrong
    let totalWrong = 0;
    Object.values(wrongAnswersByChapter).forEach(arr => totalWrong += arr.length);
    document.getElementById('stat-wrong-count').textContent = totalWrong;

    // Table
    const tbody = document.getElementById('stats-table-body');
    tbody.innerHTML = '';
    
    // Iterate all chapters (even if no stats yet)
    Object.keys(all_data).sort((a, b) => { // Use same sort order as sidebar
         const numA = parseInt(a.match(/第(\S+)章/)[1].replace(/[\u4e00-\u9fa5]/g, match => ' 一二三四五六七八九十'.indexOf(match)));
         const numB = parseInt(b.match(/第(\S+)章/)[1].replace(/[\u4e00-\u9fa5]/g, match => ' 一二三四五六七八九十'.indexOf(match)));
         return numA - numB;
    }).forEach(chapter => {
        const stats = userStats.chapterStats[chapter] || { total: 0, correct: 0 };
        const acc = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${chapter}</td>
            <td>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${acc}%"></div>
                </div>
            </td>
            <td style="text-align:right;">${acc}% <span style="font-size:0.8em;color:var(--text-light);">(${stats.correct}/${stats.total})</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function closeDashboard() {
    document.getElementById('dashboard-modal').style.display = 'none';
}

function showDataSync() {
    document.getElementById('data-modal').style.display = 'block';
    document.getElementById('data-area').value = '';
}

function closeDataSync() {
    document.getElementById('data-modal').style.display = 'none';
}

const NOTEPAD_KEY = 'mech_design_notepad';

function loadNotepad() {
    const content = localStorage.getItem(NOTEPAD_KEY);
    if (content) {
        document.getElementById('notepad').value = content;
    }
}

function saveNotepad() {
    const content = document.getElementById('notepad').value;
    localStorage.setItem(NOTEPAD_KEY, content);
}

function downloadNotepadTxt() {
    const content = document.getElementById('notepad').value;
    if (!content) { alert('笔记为空，无法导出！'); return; }
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `机设自测笔记_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearNotepad() {
    if (confirm('确定要清空笔记吗？')) {
        document.getElementById('notepad').value = '';
        localStorage.removeItem(NOTEPAD_KEY);
    }
}

// --- Wallpaper Logic ---
const WALLPAPER_KEY = 'mech_design_wallpaper';
let cropper; // Cropper instance

function initWallpaper() {
    const savedWallpaper = localStorage.getItem(WALLPAPER_KEY);
    if (savedWallpaper) {
        applyWallpaper(savedWallpaper);
    }
}

function triggerWallpaperUpload() {
    if (document.body.classList.contains('has-wallpaper')) {
        if (confirm('是否要清除当前壁纸？\n点击[确定]清除，点击[取消]更换新壁纸。')) {
            removeWallpaper();
            return; 
        }
    }
    document.getElementById('wallpaper-upload').click();
}

function handleWallpaperUpload(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // Increased limit for crop source (5MB)
        alert('图片太大了！请上传 5MB 以内的图片。');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const image = document.getElementById('cropper-image');
        
        // Destroy previous instance first if exists
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        image.src = e.target.result;
        
        // Show Modal
        document.getElementById('cropper-modal').style.display = 'block';
        
        // Wait for image to load naturally before firing Cropper
        image.onload = function() {
            cropper = new Cropper(image, {
                aspectRatio: NaN, 
                viewMode: 1, 
                autoCropArea: 0.9,
                responsive: true,
                restore: false, // Don't restore previous crop box
                checkCrossOrigin: false,
            });
        };
    };
    reader.readAsDataURL(file);
    input.value = ''; // Reset
}

function confirmCrop() {
    if (!cropper) return;
    
    // Get cropped result
    const canvas = cropper.getCroppedCanvas({
        maxWidth: 1920, // Optimization: resize if huge
        maxHeight: 1080
    });
    
    if (!canvas) return;

    try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85); // Compress slightly
        localStorage.setItem(WALLPAPER_KEY, dataUrl);
        applyWallpaper(dataUrl);
        closeCropper();
        alert('壁纸设置成功！✨');
    } catch (error) {
         alert('设置失败：裁剪后的图片可能还是太大。请尝试裁剪更小的区域。');
         console.error(error);
    }
}

function closeCropper() {
    document.getElementById('cropper-modal').style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

function applyWallpaper(url) {
    document.body.style.backgroundImage = `url('${url}')`;
    document.body.classList.add('has-wallpaper');
}

function removeWallpaper() {
    localStorage.removeItem(WALLPAPER_KEY);
    document.body.style.backgroundImage = '';
    document.body.classList.remove('has-wallpaper');
    alert('壁纸已清除。');
}

function exportData() {
    const data = {
        favorites,
        wrongAnswersByChapter,
        userStats,
        notepad: localStorage.getItem(NOTEPAD_KEY) || '' // Include notepad
    };
    const json = JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(json))); // Base64 safe handling
    document.getElementById('data-area').value = encoded;
    alert('导出码已生成，请复制下方的代码保存。');
}

function importData() {
    const code = document.getElementById('data-area').value.trim();
    if (!code) { alert('请输入导出码！'); return; }
    
    try {
        const json = decodeURIComponent(escape(atob(code)));
        const data = JSON.parse(json);
        
        if (data.favorites && data.wrongAnswersByChapter) {
            favorites = data.favorites;
            wrongAnswersByChapter = data.wrongAnswersByChapter;
            if (data.userStats) userStats = data.userStats;
            if (data.notepad) {
                localStorage.setItem(NOTEPAD_KEY, data.notepad);
                loadNotepad();
            }
            
            saveFavorites();
            saveWrongAnswers();
            saveStats();
            
            alert('数据恢复成功！页面即将刷新。');
            location.reload();
        } else {
            throw new Error('无效的数据格式');
        }
    } catch (e) {
        alert('导入失败：无效的导出码。');
        console.error(e);
    }
}



// --- 键盘事件监听 ---
document.addEventListener('keydown', function(event) {
    const quizModal = document.getElementById('quiz-modal');
    // Check if modal is actually visible (using offsetParent or getComputedStyle for robustness)
    const isModalVisible = quizModal.style.display === 'block' && window.getComputedStyle(quizModal).display !== 'none';
    
    if (isModalVisible) {
        const question = quizQuestions[currentQuestionIndex];
        const key = event.key.toUpperCase();
        
        // 选项选择逻辑 (Only if answering)
        if (quizState === 'ANSWERING' && question) {
            if (question.type === 'mcq') {
                if (['A','B','C','D'].includes(key) || ['1','2','3','4'].includes(key)) {
                    const mapIndex = (['1','2','3','4'].includes(key)) ? parseInt(key)-1 : ['A','B','C','D'].indexOf(key);
                    const options = document.querySelectorAll('input[name="quizOption"]');
                    if(options[mapIndex]) options[mapIndex].checked = true;
                }
            } else if (question.type === 'tf') {
                const options = document.querySelectorAll('input[name="quizOption"]');
                // Support T/F keys
                if (key === 'T' && options[0]) options[0].checked = true; // Correct / True
                if (key === 'F' && options[1]) options[1].checked = true; // Incorrect / False
                
                // Support 1/2 keys (1=True/Correct, 2=False/Incorrect)
                if (key === '1' && options[0]) options[0].checked = true;
                if (key === '2' && options[1]) options[1].checked = true;
                
                // Also support A/B mapping for muscle memory
                if (key === 'A' && options[0]) options[0].checked = true;
                if (key === 'B' && options[1]) options[1].checked = true;
            }
        }

        // Space to Skip (Answer) or Next (Feedback)
        if (event.code === 'Space') {
             event.preventDefault(); 
             if (quizState === 'ANSWERING') {
                 submitQuizAnswer(true); // Skip
             } else if (quizState === 'FEEDBACK') {
                 nextQuizQuestion();
             }
        }

        // 提交确认/下一题
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent standard button clicks
            
            if (quizState === 'ANSWERING') {
                submitQuizAnswer();
            } else if (quizState === 'FEEDBACK') {
                nextQuizQuestion();
            }
        }
    }
});

// --- 初始化 ---
window.onload = function() {
    setupTheme();
    setupMobileMenu();
    loadWrongAnswers();
    loadFavorites();
    loadStats(); // Load stats on start
    loadNotepad(); // Load notepad
    initWallpaper(); // Load wallpaper
    processData();
    createNavigationAndContent();
};
