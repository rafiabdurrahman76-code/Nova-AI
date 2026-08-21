/* =========================================================
   NOVA — AI Chat Frontend
   Vanilla JS. No frameworks. No API keys.
   Talks to Netlify Function:
   /.netlify/functions/chat
========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     DOM references
  --------------------------------------------------------- */
  const el = {
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebarOpen: document.getElementById('sidebarOpen'),
    sidebarClose: document.getElementById('sidebarClose'),
    newChatBtn: document.getElementById('newChatBtn'),
    historyList: document.getElementById('historyList'),
    topbarTitle: document.getElementById('topbarTitle'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    chatScroll: document.getElementById('chatScroll'),
    welcome: document.getElementById('welcome'),
    promptCards: document.getElementById('promptCards'),
    messages: document.getElementById('messages'),
    composerForm: document.getElementById('composerForm'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
  };

  const STORAGE_KEY = 'nova_conversations_v1';
  const ACTIVE_KEY = 'nova_active_conversation_v1';

  // Netlify Function endpoint
  const API_ENDPOINT = '/.netlify/functions/chat';

  /* ---------------------------------------------------------
     State
  --------------------------------------------------------- */
  let conversations = loadConversations();
  let activeId = localStorage.getItem(ACTIVE_KEY) || null;
  let isSending = false;

  if (!activeId || !conversations.find(c => c.id === activeId)) {
    activeId = null;
  }

  /* ---------------------------------------------------------
     Storage helpers
  --------------------------------------------------------- */
  function loadConversations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveConversations() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
    } catch (e) {}
  }

  function getActiveConversation() {
    return conversations.find(c => c.id === activeId) || null;
  }

  function createConversation() {
    const conv = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: 'New chat',
      messages: [],
      createdAt: Date.now(),
    };

    conversations.unshift(conv);
    activeId = conv.id;
    saveConversations();
    return conv;
  }

  /* ---------------------------------------------------------
     Sidebar rendering
  --------------------------------------------------------- */
  function renderHistory() {
    el.historyList.innerHTML = '';

    if (conversations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'Your conversations will appear here.';
      el.historyList.appendChild(empty);
      return;
    }

    conversations.forEach(conv => {
      const item = document.createElement('button');

      item.className =
        'history-item' + (conv.id === activeId ? ' active' : '');

      item.setAttribute('type', 'button');

      item.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.9 8.4A8.5 8.5 0 1 1 21 11.5Z"/>
        </svg>

        <span class="hi-title"></span>

        <span class="hi-delete" title="Delete chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round">
            <path d="M4 7h16"/>
            <path d="M9 7V4h6v3"/>
            <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/>
          </svg>
        </span>
      `;

      item.querySelector('.hi-title').textContent =
        conv.title || 'New chat';

      item.addEventListener('click', () =>
        switchConversation(conv.id)
      );

      item.querySelector('.hi-delete')
        .addEventListener('click', (e) => {
          e.stopPropagation();
          deleteConversation(conv.id);
        });

      el.historyList.appendChild(item);
    });
  }

  function switchConversation(id) {
    activeId = id;
    saveConversations();
    renderActiveConversation();
    renderHistory();
    closeSidebarMobile();
  }

  function deleteConversation(id) {
    conversations =
      conversations.filter(c => c.id !== id);

    if (activeId === id) {
      activeId =
        conversations.length
          ? conversations[0].id
          : null;
    }

    saveConversations();
    renderActiveConversation();
    renderHistory();
  }

  /* ---------------------------------------------------------
     Main chat rendering
  --------------------------------------------------------- */
  function renderActiveConversation() {
    const conv = getActiveConversation();

    el.messages.innerHTML = '';

    if (!conv || conv.messages.length === 0) {
      el.welcome.classList.remove('hidden');
      el.topbarTitle.textContent = 'New chat';
      return;
    }

    el.welcome.classList.add('hidden');

    el.topbarTitle.textContent =
      conv.title || 'New chat';

    conv.messages.forEach((msg, idx) =>
      appendMessageToDOM(
        msg,
        idx === conv.messages.length - 1 &&
        msg.role === 'ai'
      )
    );

    scrollToBottom(false);
  }

  function scrollToBottom(smooth) {
    requestAnimationFrame(() => {
      el.chatScroll.scrollTo({
        top: el.chatScroll.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    });
  }

  function formatTime(ts) {
    const d = new Date(ts);

    let h = d.getHours();

    const m =
      d.getMinutes()
        .toString()
        .padStart(2, '0');

    const ampm =
      h >= 12 ? 'PM' : 'AM';

    h = h % 12 || 12;

    return `${h}:${m} ${ampm}`;
  }

  /* ---------------------------------------------------------
     Markdown renderer
  --------------------------------------------------------- */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMarkdown(raw) {

    const codeBlocks = [];

    let text =
      raw.replace(
        /```(\w*)\n?([\s\S]*?)```/g,
        (match, lang, code) => {

          const idx = codeBlocks.length;

          codeBlocks.push({
            lang: lang || 'text',
            code: code.replace(/\n$/, '')
          });

          return `\u0000CODEBLOCK${idx}\u0000`;
        }
      );

    text = escapeHtml(text);

    text =
      text.replace(
        /`([^`\n]+)`/g,
        '<code class="inline-code">$1</code>'
      );

    text =
      text.replace(
        /^### (.*)$/gm,
        '<h3>$1</h3>'
      );

    text =
      text.replace(
        /^## (.*)$/gm,
        '<h2>$1</h2>'
      );

    text =
      text.replace(
        /^# (.*)$/gm,
        '<h1>$1</h1>'
      );

    text =
      text.replace(
        /\*\*(.+?)\*\*/g,
        '<strong>$1</strong>'
      );

    text =
      text.replace(
        /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
        '<em>$1</em>'
      );

    text =
      text.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

    text =
      text.replace(
        /(^|\n)((?:[-*] .*\n?)+)/g,
        (match, lead, block) => {

          const items =
            block.trim()
              .split('\n')
              .map(l =>
                l.replace(/^[-*]\s+/, '')
              )
              .map(i => `<li>${i}</li>`)
              .join('');

          return `${lead}<ul>${items}</ul>`;
        }
      );

    text =
      text.replace(
        /(^|\n)((?:\d+\. .*\n?)+)/g,
        (match, lead, block) => {

          const items =
            block.trim()
              .split('\n')
              .map(l =>
                l.replace(/^\d+\.\s+/, '')
              )
              .map(i => `<li>${i}</li>`)
              .join('');

          return `${lead}<ol>${items}</ol>`;
        }
      );

    text =
      text
        .split(/\n{2,}/)
        .map(block => {

          const trimmed =
            block.trim();

          if (!trimmed) return '';

          if (/^<(h1|h2|h3|ul|ol)/.test(trimmed)) {
            return trimmed;
          }

          if (
            /^\u0000CODEBLOCK\d+\u0000$/
              .test(trimmed)
          ) {
            return trimmed;
          }

          return `<p>${
            trimmed.replace(/\n/g, '<br>')
          }</p>`;
        })
        .join('');

    text =
      text.replace(
        /\u0000CODEBLOCK(\d+)\u0000/g,
        (match, idx) => {

          const block =
            codeBlocks[Number(idx)];

          const escapedCode =
            escapeHtml(block.code);

          const rawAttr =
            encodeURIComponent(block.code);

          return `
            <div class="code-block">

              <div class="code-block-header">

                <span>${escapeHtml(block.lang)}</span>

                <button
                  type="button"
                  class="copy-code-btn"
                  data-code="${rawAttr}"
                >
                  Copy
                </button>

              </div>

              <pre>
                <code>${escapedCode}</code>
              </pre>

            </div>
          `;
        }
      );

    return text;
  }

  /* ---------------------------------------------------------
     Message DOM
  --------------------------------------------------------- */
  function appendMessageToDOM(
    msg,
    showActionsAlways
  ) {

    const wrap =
      document.createElement('div');

    wrap.className =
      'msg ' +
      (msg.role === 'user'
        ? 'user'
        : 'ai');

    wrap.dataset.id = msg.id;

    const avatar =
      document.createElement('div');

    avatar.className =
      'msg-avatar';

    avatar.textContent =
      msg.role === 'user'
        ? 'U'
        : 'N';

    const col =
      document.createElement('div');

    col.className = 'msg-col';

    const meta =
      document.createElement('div');

    meta.className = 'msg-meta';

    meta.innerHTML = `
      <span>
        ${msg.role === 'user'
          ? 'You'
          : 'Nova'}
      </span>

      <span>·</span>

      <span>
        ${formatTime(msg.timestamp)}
      </span>
    `;

    const bubble =
      document.createElement('div');

    bubble.className = 'bubble';

    if (msg.role === 'user') {
      bubble.textContent =
        msg.content;
    } else {
      bubble.innerHTML =
        renderMarkdown(msg.content);
    }

    col.appendChild(meta);
    col.appendChild(bubble);

    if (msg.role === 'ai') {

      const actions =
        document.createElement('div');

      actions.className =
        'msg-actions' +
        (
          showActionsAlways
            ? ' always-visible'
            : ''
        );

      const copyBtn =
        document.createElement('button');

      copyBtn.type = 'button';

      copyBtn.className =
        'action-btn';

      copyBtn.textContent = 'Copy';

      copyBtn.addEventListener(
        'click',
        () =>
          copyText(
            msg.content,
            copyBtn
          )
      );

      const regenBtn =
        document.createElement('button');

      regenBtn.type = 'button';

      regenBtn.className =
        'action-btn';

      regenBtn.textContent =
        'Regenerate';

      regenBtn.addEventListener(
        'click',
        () =>
          regenerateResponse(msg.id)
      );

      actions.appendChild(copyBtn);
      actions.appendChild(regenBtn);

      col.appendChild(actions);
    }

    wrap.appendChild(avatar);
    wrap.appendChild(col);

    el.messages.appendChild(wrap);

    wrap
      .querySelectorAll('.copy-code-btn')
      .forEach(btn => {

        btn.addEventListener(
          'click',
          () => {

            const code =
              decodeURIComponent(
                btn.getAttribute(
                  'data-code'
                )
              );

            copyText(
              code,
              btn,
              true
            );
          }
        );
      });

    return wrap;
  }

  function copyText(
    text,
    btn,
    isCodeBtn
  ) {

    navigator.clipboard
      .writeText(text)
      .then(() => {

        const original =
          btn.textContent;

        btn.textContent =
          'Copied!';

        setTimeout(() => {
          btn.textContent =
            original;
        }, 1600);

      })
      .catch(() => {});
  }

  /* ---------------------------------------------------------
     Typing indicator
  --------------------------------------------------------- */
  function showTypingIndicator() {

    const wrap =
      document.createElement('div');

    wrap.className =
      'msg ai';

    wrap.id =
      'typingIndicator';

    wrap.innerHTML = `
      <div class="msg-avatar">
        N
      </div>

      <div class="msg-col">

        <div class="msg-meta">
          <span>Nova</span>
          <span>·</span>
          <span>typing…</span>
        </div>

        <div class="bubble">
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

      </div>
    `;

    el.messages.appendChild(wrap);

    scrollToBottom(true);
  }

  function removeTypingIndicator() {
    const node =
      document.getElementById(
        'typingIndicator'
      );

    if (node) node.remove();
  }

  /* =========================================================
     NETLIFY + GEMINI BACKEND CALL
  ========================================================= */

  async function fetchAIReply(
    message,
    history
  ) {

    try {

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => controller.abort(),
          15000
        );

      const res =
        await fetch(API_ENDPOINT, {

          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              message,
              history
            }),

          signal:
            controller.signal

        });

      clearTimeout(timeout);

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          'AI server error'
        );
      }

      if (
        !data ||
        typeof data.reply !== 'string'
      ) {
        throw new Error(
          'Invalid AI response'
        );
      }

      return data.reply;

    } catch (err) {

      console.error(
        'AI connection error:',
        err
      );

      return 'দুঃখিত, AI server-এর সাথে connection করা যায়নি। আবার চেষ্টা করো।';
    }
  }

  /* ---------------------------------------------------------
     Sending messages
  --------------------------------------------------------- */
  async function sendMessage(text) {

    if (isSending) return;

    const content =
      text.trim();

    if (!content) return;

    let conv =
      getActiveConversation();

    if (!conv) {
      conv =
        createConversation();
    }

    el.welcome
      .classList
      .add('hidden');

    const userMsg = {
      id:
        'm_' +
        Date.now() +
        '_u',

      role: 'user',

      content,

      timestamp:
        Date.now(),
    };

    conv.messages.push(userMsg);

    if (
      conv.messages.length === 1
    ) {

      conv.title =
        content.slice(0, 40) +
        (
          content.length > 40
            ? '…'
            : ''
        );

      el.topbarTitle.textContent =
        conv.title;
    }

    saveConversations();

    appendMessageToDOM(
      userMsg,
      false
    );

    scrollToBottom(true);

    renderHistory();

    resetComposer();

    isSending = true;

    showTypingIndicator();

    const history =
      conv.messages
        .slice(0, -1)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

    const reply =
      await fetchAIReply(
        content,
        history
      );

    removeTypingIndicator();

    const aiMsg = {
      id:
        'm_' +
        Date.now() +
        '_a',

      role: 'ai',

      content: reply,

      timestamp:
        Date.now(),
    };

    conv.messages.push(aiMsg);

    saveConversations();

    appendMessageToDOM(
      aiMsg,
      true
    );

    scrollToBottom(true);

    isSending = false;
  }

  /* ---------------------------------------------------------
     Regenerate
  --------------------------------------------------------- */
  async function regenerateResponse(
    aiMsgId
  ) {

    if (isSending) return;

    const conv =
      getActiveConversation();

    if (!conv) return;

    const idx =
      conv.messages.findIndex(
        m => m.id === aiMsgId
      );

    if (idx === -1) return;

    const userIdx =
      idx - 1;

    if (
      userIdx < 0 ||
      conv.messages[userIdx]
        .role !== 'user'
    ) {
      return;
    }

    const userContent =
      conv.messages[userIdx]
        .content;

    conv.messages.splice(
      idx,
      1
    );

    const node =
      el.messages.querySelector(
        `[data-id="${aiMsgId}"]`
      );

    if (node) node.remove();

    saveConversations();

    isSending = true;

    showTypingIndicator();

    const history =
      conv.messages
        .slice(0, userIdx)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

    const reply =
      await fetchAIReply(
        userContent,
        history
      );

    removeTypingIndicator();

    const aiMsg = {
      id:
        'm_' +
        Date.now() +
        '_a',

      role: 'ai',

      content: reply,

      timestamp:
        Date.now(),
    };

    conv.messages.push(aiMsg);

    saveConversations();

    appendMessageToDOM(
      aiMsg,
      true
    );

    scrollToBottom(true);

    isSending = false;
  }

  /* ---------------------------------------------------------
     Composer
  --------------------------------------------------------- */
  function resetComposer() {

    el.messageInput.value = '';

    autoResizeTextarea();

    updateSendButtonState();

    el.messageInput.focus();
  }

  function autoResizeTextarea() {

    el.messageInput.style.height =
      'auto';

    el.messageInput.style.height =
      Math.min(
        el.messageInput.scrollHeight,
        200
      ) + 'px';
  }

  function updateSendButtonState() {

    el.sendBtn.disabled =
      el.messageInput.value
        .trim()
        .length === 0 ||
      isSending;
  }

  el.messageInput.addEventListener(
    'input',
    () => {

      autoResizeTextarea();

      updateSendButtonState();
    }
  );

  el.messageInput.addEventListener(
    'keydown',
    (e) => {

      if (
        e.key === 'Enter' &&
        !e.shiftKey
      ) {

        e.preventDefault();

        if (!el.sendBtn.disabled) {

          sendMessage(
            el.messageInput.value
          );
        }
      }
    }
  );

  el.composerForm.addEventListener(
    'submit',
    (e) => {

      e.preventDefault();

      if (!el.sendBtn.disabled) {

        sendMessage(
          el.messageInput.value
        );
      }
    }
  );

  /* ---------------------------------------------------------
     Suggested prompts
  --------------------------------------------------------- */
  el.promptCards.addEventListener(
    'click',
    (e) => {

      const card =
        e.target.closest(
          '.prompt-card'
        );

      if (!card) return;

      const prompt =
        card.getAttribute(
          'data-prompt'
        );

      sendMessage(prompt);
    }
  );

  /* ---------------------------------------------------------
     New chat / clear chat
  --------------------------------------------------------- */
  el.newChatBtn.addEventListener(
    'click',
    () => {

      activeId = null;

      saveConversations();

      localStorage.removeItem(
        ACTIVE_KEY
      );

      renderActiveConversation();

      renderHistory();

      closeSidebarMobile();

      el.messageInput.focus();
    }
  );

  el.clearChatBtn.addEventListener(
    'click',
    () => {

      const conv =
        getActiveConversation();

      if (!conv) return;

      if (
        !confirm(
          'Clear this conversation? This cannot be undone.'
        )
      ) {
        return;
      }

      conv.messages = [];

      conv.title =
        'New chat';

      saveConversations();

      renderActiveConversation();

      renderHistory();
    }
  );

  /* ---------------------------------------------------------
     Mobile sidebar
  --------------------------------------------------------- */
  function openSidebarMobile() {

    el.sidebar
      .classList
      .add('open');

    el.sidebarOverlay
      .classList
      .add('visible');
  }

  function closeSidebarMobile() {

    el.sidebar
      .classList
      .remove('open');

    el.sidebarOverlay
      .classList
      .remove('visible');
  }

  el.sidebarOpen.addEventListener(
    'click',
    openSidebarMobile
  );

  el.sidebarClose.addEventListener(
    'click',
    closeSidebarMobile
  );

  el.sidebarOverlay.addEventListener(
    'click',
    closeSidebarMobile
  );

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  renderHistory();

  renderActiveConversation();

  updateSendButtonState();

})();