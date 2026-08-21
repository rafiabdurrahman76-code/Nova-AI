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

      if (activeId) {
        localStorage.setItem(ACTIVE_KEY, activeId);
      }
    } catch (e) {}
  }

  function getActiveConversation() {
    return conversations.find(c => c.id === activeId) || null;
  }

  function createConversation() {
    const conv = {
      id:
        'c_' +
        Date.now() +
        '_' +
        Math.random().toString(36).slice(2, 7),

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

      empty.textContent =
        'Your conversations will appear here.';

      el.historyList.appendChild(empty);

      return;
    }

    conversations.forEach(conv => {
      const item = document.createElement('button');

      item.className =
        'history-item' +
        (conv.id === activeId ? ' active' : '');

      item.setAttribute('type', 'button');

      item.innerHTML = `
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <path
            d="M21 11.5a8.38 8.38 0 0 1-8.9 8.4A8.5 8.5 0 1 1 21 11.5Z"
          />
        </svg>

        <span class="hi-title"></span>

        <span
          class="hi-delete"
          title="Delete chat"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <path d="M4 7h16"/>
            <path d="M9 7V4h6v3"/>
            <path
              d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
            />
          </svg>
        </span>
      `;

      item.querySelector('.hi-title').textContent =
        conv.title || 'New chat';

      item.addEventListener(
        'click',
        () => switchConversation(conv.id)
      );

      item
        .querySelector('.hi-delete')
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
      conversations.filter(
        c => c.id !== id
      );

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

    if (
      !conv ||
      conv.messages.length === 0
    ) {
      el.welcome.classList.remove('hidden');

      el.topbarTitle.textContent =
        'New chat';

      return;
    }

    el.welcome.classList.add('hidden');

    el.topbarTitle.textContent =
      conv.title || 'New chat';

    conv.messages.forEach(
      (msg, idx) =>
        appendMessageToDOM(
          msg,
          idx ===
            conv.messages.length - 1 &&
            msg.role === 'ai'
        )
    );

    scrollToBottom(false);
  }

  function scrollToBottom(smooth) {
    requestAnimationFrame(() => {
      el.chatScroll.scrollTo({
        top: el.chatScroll.scrollHeight,
        behavior:
          smooth
            ? 'smooth'
            : 'auto',
      });
    });
  }

  function formatTime(ts) {
    const d = new Date(ts);

    let h = d.getHours();

    const m =
      d
        .getMinutes()
        .toString()
        .padStart(2, '0');

    const ampm =
      h >= 12
        ? 'PM'
        : 'AM';

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
          const idx =
            codeBlocks.length;

          codeBlocks.push({
            lang: lang || 'text',
            code:
              code.replace(
                /\n$/,
                ''
              )
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
            block
              .trim()
              .split('\n')
              .map(
                l =>
                  l.replace(
                    /^[-*]\s+/,
                    ''
                  )
              )
              .map(
                i => `<li>${i}</li>`
              )
              .join('');

          return `${lead}<ul>${items}</ul>`;
        }
      );

    text =
      text.replace(
        /(^|\n)((?:\d+\. .*\n?)+)/g,
        (match, lead, block) => {
          const items =
            block
              .trim()
              .split('\n')
              .map(
                l =>
                  l.replace(
                    /^\d+\.\s+/,
                    ''
                  )
              )
              .map(
                i => `<li>${i}</li>`
              )
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

          if (!trimmed) {
            return '';
          }

          if (
            /^<(h1|h2|h3|ul|ol)/
              .test(trimmed)
          ) {
            return trimmed;
          }

          if (
            /^\u0000CODEBLOCK\d+\u0000$/
              .test(trimmed)
          ) {
            return trimmed;
          }

          return `<p>${
            trimmed.replace(
              /\n/g,
              '<br>'
            )
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
            encodeURIComponent(
              block.code
            );

          return `
            <div class="code-block">

              <div class="code-block-header">

                <span>
                  ${escapeHtml(block.lang)}
                </span>

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
  function appendMessageToDOM(msg, showActions) {
    const wrapper = document.createElement('div');

    wrapper.className =
      'message-row ' + msg.role;

    const bubble = document.createElement('div');

    bubble.className = 'message-bubble';

    if (msg.role === 'ai') {
      bubble.innerHTML = `
        <div class="message-avatar">
          ✦
        </div>

        <div class="message-content">
          <div class="markdown-body">
            ${renderMarkdown(msg.content)}
          </div>

          <div class="message-meta">
            <span class="message-time">
              ${formatTime(msg.timestamp || Date.now())}
            </span>

            ${
              showActions
                ? `
                  <div class="message-actions">

                    <button
                      type="button"
                      class="message-action copy-message-btn"
                      title="Copy"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                      >
                        <rect
                          x="9"
                          y="9"
                          width="11"
                          height="11"
                          rx="2"
                        />
                        <path
                          d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                        />
                      </svg>
                    </button>

                  </div>
                `
                : ''
            }
          </div>
        </div>
      `;

      const copyBtn =
        bubble.querySelector(
          '.copy-message-btn'
        );

      if (copyBtn) {
        copyBtn.addEventListener(
          'click',
          () => copyText(msg.content, copyBtn)
        );
      }
    } else {
      bubble.innerHTML = `
        <div class="message-content">
          <div class="user-message-text"></div>

          <div class="message-meta">
            <span class="message-time">
              ${formatTime(msg.timestamp || Date.now())}
            </span>
          </div>
        </div>
      `;

      bubble.querySelector(
        '.user-message-text'
      ).textContent = msg.content;
    }

    wrapper.appendChild(bubble);

    el.messages.appendChild(wrapper);

    bubble
      .querySelectorAll(
        '.copy-code-btn'
      )
      .forEach(btn => {
        btn.addEventListener(
          'click',
          () => {
            const code =
              decodeURIComponent(
                btn.dataset.code
              );

            copyText(code, btn);
          }
        );
      });

    return wrapper;
  }

  /* ---------------------------------------------------------
     Copy helper
  --------------------------------------------------------- */
  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);

      if (button) {
        const original =
          button.textContent;

        button.textContent =
          'Copied!';

        setTimeout(() => {
          button.textContent =
            original;
        }, 1500);
      }
    } catch (e) {
      try {
        const textarea =
          document.createElement(
            'textarea'
          );

        textarea.value = text;

        document.body.appendChild(
          textarea
        );

        textarea.select();

        document.execCommand(
          'copy'
        );

        textarea.remove();
      } catch (err) {}
    }
  }

  /* ---------------------------------------------------------
     Conversation title
  --------------------------------------------------------- */
  function generateTitle(text) {
    const clean =
      text
        .trim()
        .replace(/\s+/g, ' ');

    if (clean.length <= 42) {
      return clean;
    }

    return (
      clean.slice(0, 42).trim() +
      '…'
    );
  }

  /* ---------------------------------------------------------
     Typing indicator
  --------------------------------------------------------- */
  function showTypingIndicator() {
    const wrapper =
      document.createElement('div');

    wrapper.className =
      'message-row ai typing-row';

    wrapper.id =
      'typingIndicator';

    wrapper.innerHTML = `
      <div class="message-bubble">

        <div class="message-avatar">
          ✦
        </div>

        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>

      </div>
    `;

    el.messages.appendChild(
      wrapper
    );

    scrollToBottom(true);
  }

  function removeTypingIndicator() {
    const indicator =
      document.getElementById(
        'typingIndicator'
      );

    if (indicator) {
      indicator.remove();
    }
  }

  /* ---------------------------------------------------------
     Auto resize textarea
  --------------------------------------------------------- */
  function autoResizeTextarea() {
    el.messageInput.style.height =
      'auto';

    const maxHeight = 180;

    el.messageInput.style.height =
      Math.min(
        el.messageInput.scrollHeight,
        maxHeight
      ) + 'px';

    el.messageInput.style.overflowY =
      el.messageInput.scrollHeight >
      maxHeight
        ? 'auto'
        : 'hidden';
  }

  function updateSendButtonState() {
    el.sendBtn.disabled =
      isSending ||
      !el.messageInput.value.trim();
  }

  /* ---------------------------------------------------------
     API request
  --------------------------------------------------------- */
  async function askAI(message, history) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        60000
      );

    try {
      const response =
        await fetch(
          API_ENDPOINT,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              message,
              history,
            }),

            signal:
              controller.signal,
          }
        );

      const rawText =
        await response.text();

      let data;

      try {
        data =
          rawText
            ? JSON.parse(rawText)
            : {};
      } catch (parseError) {
        throw new Error(
          `Server returned invalid response: ${rawText.slice(0, 150)}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          `Server error (${response.status})`
        );
      }

      if (
        !data.reply ||
        typeof data.reply !== 'string'
      ) {
        throw new Error(
          'No reply received from AI server'
        );
      }

      return data.reply.trim();

    } catch (err) {
      console.error(
        'AI connection error:',
        err
      );

      if (
        err.name ===
        'AbortError'
      ) {
        throw new Error(
          'Request timeout. Please try again.'
        );
      }

      throw new Error(
        err.message ||
        'Unknown error'
      );

    } finally {
      clearTimeout(timeout);
    }
  }

  /* ---------------------------------------------------------
     Send message
  --------------------------------------------------------- */
  async function sendMessage(rawMessage) {
    const message =
      String(
        rawMessage ||
        el.messageInput.value
      ).trim();

    if (
      !message ||
      isSending
    ) {
      return;
    }

    let conv =
      getActiveConversation();

    if (!conv) {
      conv =
        createConversation();
    }

    const userMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    if (
      conv.messages.length === 0
    ) {
      conv.title =
        generateTitle(message);
    }

    conv.messages.push(
      userMessage
    );

    saveConversations();

    el.welcome.classList.add(
      'hidden'
    );

    el.topbarTitle.textContent =
      conv.title;

    appendMessageToDOM(
      userMessage,
      false
    );

    renderHistory();

    el.messageInput.value = '';

    autoResizeTextarea();

    isSending = true;

    updateSendButtonState();

    showTypingIndicator();

    const history =
      conv.messages
        .slice(0, -1)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

    try {
      const reply =
        await askAI(
          message,
          history
        );

      removeTypingIndicator();

      const aiMessage = {
        role: 'ai',
        content: reply,
        timestamp: Date.now(),
      };

      conv.messages.push(
        aiMessage
      );

      saveConversations();

      appendMessageToDOM(
        aiMessage,
        true
      );

      renderHistory();

      scrollToBottom(true);

    } catch (err) {
      removeTypingIndicator();

      const errorMessage = {
        role: 'ai',
        content:
          '⚠️ **Error:** ' +
          (
            err.message ||
            'Unknown error'
          ),
        timestamp: Date.now(),
      };

      conv.messages.push(
        errorMessage
      );

      saveConversations();

      appendMessageToDOM(
        errorMessage,
        true
      );

      scrollToBottom(true);

    } finally {
      isSending = false;

      updateSendButtonState();

      el.messageInput.focus();
    }
  }

  /* ---------------------------------------------------------
     Composer events
  --------------------------------------------------------- */
  el.composerForm.addEventListener(
    'submit',
    (e) => {
      e.preventDefault();

      sendMessage();
    }
  );

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

        if (
          !el.sendBtn.disabled
        ) {
          sendMessage();
        }
      }
    }
  );
/* ---------------------------------------------------------
     Prompt cards
  --------------------------------------------------------- */
  if (el.promptCards) {
    el.promptCards.addEventListener(
      'click',
      (e) => {
        const card =
          e.target.closest(
            '[data-prompt]'
          );

        if (!card) return;

        const prompt =
          card.dataset.prompt;

        if (!prompt) return;

        el.messageInput.value =
          prompt;

        autoResizeTextarea();
        updateSendButtonState();

        el.messageInput.focus();
      }
    );
  }

  /* ---------------------------------------------------------
     New chat
  --------------------------------------------------------- */
  if (el.newChatBtn) {
    el.newChatBtn.addEventListener(
      'click',
      () => {
        if (isSending) return;

        const conv =
          createConversation();

        renderActiveConversation();
        renderHistory();

        el.messageInput.value = '';

        autoResizeTextarea();
        updateSendButtonState();

        el.messageInput.focus();

        closeSidebarMobile();
      }
    );
  }

  /* ---------------------------------------------------------
     Clear current chat
  --------------------------------------------------------- */
  if (el.clearChatBtn) {
    el.clearChatBtn.addEventListener(
      'click',
      () => {
        if (isSending) return;

        const conv =
          getActiveConversation();

        if (!conv) {
          return;
        }

        if (
          conv.messages.length === 0
        ) {
          return;
        }

        const confirmed =
          window.confirm(
            'Clear this conversation?'
          );

        if (!confirmed) return;

        conv.messages = [];

        conv.title =
          'New chat';

        saveConversations();

        renderActiveConversation();
        renderHistory();

        el.messageInput.value = '';

        autoResizeTextarea();
        updateSendButtonState();

        el.messageInput.focus();
      }
    );
  }

  /* ---------------------------------------------------------
     Mobile sidebar
  --------------------------------------------------------- */
  function openSidebarMobile() {
    if (!el.sidebar) return;

    el.sidebar.classList.add(
      'open'
    );

    if (el.sidebarOverlay) {
      el.sidebarOverlay.classList.add(
        'visible'
      );
    }

    document.body.classList.add(
      'sidebar-open'
    );
  }

  function closeSidebarMobile() {
    if (!el.sidebar) return;

    el.sidebar.classList.remove(
      'open'
    );

    if (el.sidebarOverlay) {
      el.sidebarOverlay.classList.remove(
        'visible'
      );
    }

    document.body.classList.remove(
      'sidebar-open'
    );
  }

  if (el.sidebarOpen) {
    el.sidebarOpen.addEventListener(
      'click',
      openSidebarMobile
    );
  }

  if (el.sidebarClose) {
    el.sidebarClose.addEventListener(
      'click',
      closeSidebarMobile
    );
  }

  if (el.sidebarOverlay) {
    el.sidebarOverlay.addEventListener(
      'click',
      closeSidebarMobile
    );
  }

  /* ---------------------------------------------------------
     Escape key
  --------------------------------------------------------- */
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        closeSidebarMobile();
      }
    }
  );

  /* ---------------------------------------------------------
     Close sidebar after resize
  --------------------------------------------------------- */
  window.addEventListener(
    'resize',
    () => {
      if (
        window.innerWidth > 900
      ) {
        closeSidebarMobile();
      }
    }
  );

  /* ---------------------------------------------------------
     Prevent accidental form submit
  --------------------------------------------------------- */
  document.addEventListener(
    'click',
    (e) => {
      const button =
        e.target.closest(
          'button'
        );

      if (!button) return;

      if (
        button.type === 'button'
      ) {
        return;
      }
    }
  );

  /* ---------------------------------------------------------
     Initial render
  --------------------------------------------------------- */
  function initializeApp() {
    renderHistory();

    renderActiveConversation();

    autoResizeTextarea();

    updateSendButtonState();

    if (el.messageInput) {
      el.messageInput.focus();
    }
  }

  initializeApp();

})();