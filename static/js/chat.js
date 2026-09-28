/**
 * Luna AI - Client Application Logic
 * Full ChatGPT-style client with multi-provider switching, persistent SQLite history,
 * Markdown parsing, syntax highlighting, and settings management.
 */

document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        activeConversationId: null,
        conversations: [],
        currentModel: {
            id: 'gemini-3.8-flash',
            provider: 'gemini',
            name: 'Gemini 3.8 Flash (Google)',
            icon: 'fa-solid fa-gem',
            badge: 'Active & Fast'
        },
        keysStatus: window.LUNA_KEYS_STATUS || {},
        user: window.LUNA_USER || {},
        isSending: false
    };

    // DOM Elements
    const elements = {
        // Layout
        sidebar: document.getElementById('sidebar'),
        sidebarBackdrop: document.getElementById('sidebarBackdrop'),
        mobileMenuBtn: document.getElementById('mobileMenuBtn'),
        sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
        newChatBtn: document.getElementById('newChatBtn'),
        chatSearchInput: document.getElementById('chatSearchInput'),
        conversationsList: document.getElementById('conversationsList'),

        // Model Selector
        modelSelectorWrapper: document.getElementById('modelSelectorWrapper'),
        modelSelectBtn: document.getElementById('modelSelectBtn'),
        modelDropdownMenu: document.getElementById('modelDropdownMenu'),
        currentModelIcon: document.getElementById('currentModelIcon'),
        currentModelName: document.getElementById('currentModelName'),
        currentModelBadge: document.getElementById('currentModelBadge'),
        modelOptions: document.querySelectorAll('.model-option'),
        dropdownConfigKeysBtn: document.getElementById('dropdownConfigKeysBtn'),

        // Topbar
        keysModalTrigger: document.getElementById('keysModalTrigger'),
        keyIndicatorDot: document.getElementById('keyIndicatorDot'),
        renameChatTrigger: document.getElementById('renameChatTrigger'),
        clearChatTrigger: document.getElementById('clearChatTrigger'),

        // Chat Feed
        chatFeed: document.getElementById('chatFeed'),
        welcomeContainer: document.getElementById('welcomeContainer'),
        messagesList: document.getElementById('messagesList'),
        typingIndicator: document.getElementById('typingIndicator'),
        welcomeModelDisplay: document.getElementById('welcomeModelDisplay'),
        welcomeKeyTip: document.getElementById('welcomeKeyTip'),
        suggestionCards: document.querySelectorAll('.suggestion-card'),

        // Input
        chatForm: document.getElementById('chatForm'),
        messageInput: document.getElementById('messageInput'),
        clearInputBtn: document.getElementById('clearInputBtn'),
        sendBtn: document.getElementById('sendBtn'),

        // Modals
        settingsModal: document.getElementById('settingsModal'),
        openSettingsBtn: document.getElementById('openSettingsBtn'),
        closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
        saveKeysBtn: document.getElementById('saveKeysBtn'),
        savePersonaBtn: document.getElementById('savePersonaBtn'),

        // Key inputs in modal
        groqApiKeyInput: document.getElementById('groqApiKeyInput'),
        geminiApiKeyInput: document.getElementById('geminiApiKeyInput'),
        openrouterApiKeyInput: document.getElementById('openrouterApiKeyInput'),
        groqStatusBadge: document.getElementById('groqStatusBadge'),
        geminiStatusBadge: document.getElementById('geminiStatusBadge'),
        openrouterStatusBadge: document.getElementById('openrouterStatusBadge'),
        personaNickname: document.getElementById('personaNickname'),

        // Rename modal
        renameModal: document.getElementById('renameModal'),
        renameTitleInput: document.getElementById('renameTitleInput'),
        closeRenameModalBtn: document.getElementById('closeRenameModalBtn'),
        cancelRenameBtn: document.getElementById('cancelRenameBtn'),
        confirmRenameBtn: document.getElementById('confirmRenameBtn'),

        // Delete modal
        deleteModal: document.getElementById('deleteModal'),
        closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

        // Toast container
        toastContainer: document.getElementById('toast-container')
    };

    // Configure Marked.js
    marked.setOptions({
        breaks: true,
        gfm: true
    });

    // =========================================================
    // INITIALIZATION
    // =========================================================

    function init() {
        // Restore last chosen model from localStorage if exists
        const savedModel = localStorage.getItem('luna_selected_model');
        if (savedModel) {
            try {
                const parsed = JSON.parse(savedModel);
                if (parsed && parsed.id) {
                    selectModel(parsed.id, parsed.provider, parsed.name, parsed.icon, parsed.badge, false);
                }
            } catch (e) {
                console.warn("Could not load saved model", e);
            }
        } else {
            selectModel('gemini-3.8-flash', 'gemini', 'Gemini 3.8 Flash (Google)', 'fa-solid fa-gem', 'Active & Fast', false);
        }

        updateKeyIndicatorDots();
        loadConversations();
        attachEventListeners();
        autoResizeTextarea();
    }

    // =========================================================
    // EVENT LISTENERS
    // =========================================================

    function attachEventListeners() {
        // Mobile Sidebar
        elements.mobileMenuBtn?.addEventListener('click', () => {
            elements.sidebar.classList.add('open');
            elements.sidebarBackdrop.classList.add('open');
        });

        const closeSidebar = () => {
            elements.sidebar.classList.remove('open');
            elements.sidebarBackdrop.classList.remove('open');
        };
        elements.sidebarCloseBtn?.addEventListener('click', closeSidebar);
        elements.sidebarBackdrop?.addEventListener('click', closeSidebar);

        // New Chat
        elements.newChatBtn?.addEventListener('click', startNewChat);

        // Shortcut Ctrl+K for new chat
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                startNewChat();
            }
        });

        // Search in history
        elements.chatSearchInput?.addEventListener('input', handleChatSearch);

        // Model Selector Dropdown
        elements.modelSelectBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.modelSelectorWrapper.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!elements.modelSelectorWrapper?.contains(e.target)) {
                elements.modelSelectorWrapper?.classList.remove('open');
            }
        });

        elements.modelOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                const id = opt.getAttribute('data-id');
                const provider = opt.getAttribute('data-provider');
                const name = opt.getAttribute('data-name');
                const icon = opt.getAttribute('data-icon');
                const badge = opt.getAttribute('data-badge');
                selectModel(id, provider, name, icon, badge);
                elements.modelSelectorWrapper.classList.remove('open');
            });
        });

        elements.dropdownConfigKeysBtn?.addEventListener('click', () => {
            elements.modelSelectorWrapper.classList.remove('open');
            openSettingsModal('tab-keys');
        });

        // Topbar Buttons
        elements.keysModalTrigger?.addEventListener('click', () => openSettingsModal('tab-keys'));
        elements.openSettingsBtn?.addEventListener('click', () => openSettingsModal('tab-keys'));

        elements.renameChatTrigger?.addEventListener('click', () => {
            if (!state.activeConversationId) {
                showToast("Start a chat first before renaming!", "info");
                return;
            }
            const activeConv = state.conversations.find(c => c.id === state.activeConversationId);
            elements.renameTitleInput.value = activeConv ? activeConv.title : '';
            elements.renameModal.classList.add('open');
            elements.renameTitleInput.focus();
        });

        elements.clearChatTrigger?.addEventListener('click', () => {
            if (!state.activeConversationId) return;
            elements.deleteModal.classList.add('open');
        });

        // Suggestion Cards
        elements.suggestionCards.forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt) {
                    elements.messageInput.value = prompt;
                    elements.messageInput.focus();
                    handleSendMessage();
                }
            });
        });

        // Chat Form & Input
        elements.chatForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSendMessage();
        });

        elements.messageInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        elements.messageInput?.addEventListener('input', () => {
            autoResizeTextarea();
            if (elements.messageInput.value.trim().length > 0) {
                elements.clearInputBtn.style.display = 'block';
            } else {
                elements.clearInputBtn.style.display = 'none';
            }
        });

        elements.clearInputBtn?.addEventListener('click', () => {
            elements.messageInput.value = '';
            autoResizeTextarea();
            elements.clearInputBtn.style.display = 'none';
            elements.messageInput.focus();
        });

        // Settings Modal Tabs
        const tabBtns = elements.settingsModal?.querySelectorAll('.tab-btn');
        tabBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                switchSettingsTab(tabId);
            });
        });

        elements.closeSettingsModalBtn?.addEventListener('click', closeSettingsModal);
        elements.settingsModal?.addEventListener('click', (e) => {
            if (e.target === elements.settingsModal) closeSettingsModal();
        });

        elements.saveKeysBtn?.addEventListener('click', saveApiKeys);
        elements.savePersonaBtn?.addEventListener('click', savePersonaPreferences);

        // Rename Modal Actions
        elements.closeRenameModalBtn?.addEventListener('click', () => elements.renameModal.classList.remove('open'));
        elements.cancelRenameBtn?.addEventListener('click', () => elements.renameModal.classList.remove('open'));
        elements.confirmRenameBtn?.addEventListener('click', confirmRenameConversation);

        // Delete Modal Actions
        elements.closeDeleteModalBtn?.addEventListener('click', () => elements.deleteModal.classList.remove('open'));
        elements.cancelDeleteBtn?.addEventListener('click', () => elements.deleteModal.classList.remove('open'));
        elements.confirmDeleteBtn?.addEventListener('click', confirmDeleteConversation);
    }

    // =========================================================
    // MODEL SELECTION
    // =========================================================

    function selectModel(id, provider, name, icon, badge, save = true) {
        state.currentModel = { id, provider, name, icon, badge };

        // Update topbar UI
        if (elements.currentModelIcon) elements.currentModelIcon.innerHTML = icon.startsWith('fa-') ? `<i class="${icon}"></i>` : icon;
        if (elements.currentModelName) elements.currentModelName.textContent = name;
        if (elements.currentModelBadge) {
            elements.currentModelBadge.textContent = badge;
            elements.currentModelBadge.className = `model-badge badge-${provider}`;
        }

        // Update active class in dropdown
        elements.modelOptions.forEach(opt => {
            if (opt.getAttribute('data-id') === id) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });

        // Update Welcome banner
        if (elements.welcomeModelDisplay) elements.welcomeModelDisplay.textContent = name;
        if (elements.welcomeKeyTip) {
            const hasKey = state.keysStatus[provider]?.configured;
            if (provider === 'builtin') {
                elements.welcomeKeyTip.textContent = "Luna native offline assistant. No API key needed!";
            } else if (hasKey) {
                elements.welcomeKeyTip.textContent = `Connected & ready for fast answers with ${provider.toUpperCase()}.`;
            } else {
                elements.welcomeKeyTip.textContent = `Tip: Add your free ${provider.toUpperCase()} key in API Keys for full power.`;
            }
        }

        if (save) {
            localStorage.setItem('luna_selected_model', JSON.stringify(state.currentModel));
            showToast(`Switched to ${name}`, 'success');
        }
    }

    // =========================================================
    // CONVERSATIONS MANAGEMENT
    // =========================================================

    async function loadConversations() {
        try {
            const response = await fetch('/api/conversations');
            if (!response.ok) throw new Error("Failed to load conversations");
            const data = await response.json();
            state.conversations = data.conversations || [];
            renderConversationsList(state.conversations);
        } catch (err) {
            console.error("Error loading conversations:", err);
            elements.conversationsList.innerHTML = `
                <div class="history-loading">
                    <span>Could not load past chats</span>
                </div>
            `;
        }
    }

    function renderConversationsList(convs) {
        if (!convs.length) {
            elements.conversationsList.innerHTML = `
                <div class="history-loading">
                    <span>No conversations yet. Start a new chat!</span>
                </div>
            `;
            return;
        }

        // Group conversations by date (Today, Yesterday, Previous 7 Days, Older)
        const groups = {
            today: [],
            yesterday: [],
            week: [],
            older: []
        };

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfYesterday = startOfToday - 86400000;
        const startOfWeek = startOfToday - 86400000 * 7;

        convs.forEach(c => {
            const updated = new Date(c.updated_at).getTime();
            if (updated >= startOfToday) {
                groups.today.push(c);
            } else if (updated >= startOfYesterday) {
                groups.yesterday.push(c);
            } else if (updated >= startOfWeek) {
                groups.week.push(c);
            } else {
                groups.older.push(c);
            }
        });

        let html = '';
        const renderGroup = (title, items) => {
            if (!items.length) return '';
            let groupHtml = `<div class="history-section-title">${title}</div>`;
            items.forEach(c => {
                const isActive = c.id === state.activeConversationId ? 'active' : '';
                groupHtml += `
                    <div class="history-item ${isActive}" data-id="${c.id}">
                        <div class="history-item-title" title="${escapeHtml(c.title)}">
                            <i class="fa-regular fa-message"></i>
                            <span>${escapeHtml(c.title)}</span>
                        </div>
                        <div class="history-item-actions">
                            <button class="action-mini-btn rename-btn" data-id="${c.id}" title="Rename">
                                <i class="fa-regular fa-pen-to-square"></i>
                            </button>
                            <button class="action-mini-btn delete-btn" data-id="${c.id}" title="Delete">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            return groupHtml;
        };

        html += renderGroup('Today', groups.today);
        html += renderGroup('Yesterday', groups.yesterday);
        html += renderGroup('Previous 7 Days', groups.week);
        html += renderGroup('Older', groups.older);

        elements.conversationsList.innerHTML = html;

        // Attach item click handlers
        elements.conversationsList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.action-mini-btn')) return;
                const id = item.getAttribute('data-id');
                switchConversation(id);
            });
        });

        // Item Rename buttons
        elements.conversationsList.querySelectorAll('.rename-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const conv = state.conversations.find(c => c.id === id);
                if (conv) {
                    state.targetConvIdForAction = id;
                    elements.renameTitleInput.value = conv.title;
                    elements.renameModal.classList.add('open');
                    elements.renameTitleInput.focus();
                }
            });
        });

        // Item Delete buttons
        elements.conversationsList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                state.targetConvIdForAction = id;
                elements.deleteModal.classList.add('open');
            });
        });
    }

    function handleChatSearch() {
        const query = elements.chatSearchInput.value.toLowerCase().trim();
        if (!query) {
            renderConversationsList(state.conversations);
            return;
        }
        const filtered = state.conversations.filter(c => c.title.toLowerCase().includes(query));
        renderConversationsList(filtered);
    }

    function startNewChat() {
        state.activeConversationId = null;
        elements.messagesList.innerHTML = '';
        elements.welcomeContainer.style.display = 'flex';
        elements.messageInput.value = '';
        autoResizeTextarea();
        elements.messageInput.focus();

        // Remove active class from sidebar items
        elements.conversationsList.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));

        // Close mobile sidebar
        elements.sidebar.classList.remove('open');
        elements.sidebarBackdrop.classList.remove('open');
    }

    async function switchConversation(convId) {
        if (state.activeConversationId === convId) return;

        state.activeConversationId = convId;
        renderConversationsList(state.conversations); // update active highlight

        // Close mobile sidebar
        elements.sidebar.classList.remove('open');
        elements.sidebarBackdrop.classList.remove('open');

        // Show loading in messages area
        elements.welcomeContainer.style.display = 'none';
        elements.messagesList.innerHTML = `
            <div class="history-loading">
                <span class="mini-spinner"></span>
                <span>Reading memories...</span>
            </div>
        `;

        try {
            const res = await fetch(`/api/conversations/${convId}`);
            if (!res.ok) throw new Error("Failed to load chat history");
            const data = await res.json();

            elements.messagesList.innerHTML = '';
            const messages = data.messages || [];

            if (messages.length === 0) {
                elements.welcomeContainer.style.display = 'flex';
            } else {
                elements.welcomeContainer.style.display = 'none';
                messages.forEach(msg => appendMessageUI(msg.role, msg.content, msg.model));
                scrollToBottom();
            }
        } catch (err) {
            console.error("Error switching conversation:", err);
            showToast("Failed to load that chat", "error");
        }
    }

    async function confirmRenameConversation() {
        const idToRename = state.targetConvIdForAction || state.activeConversationId;
        if (!idToRename) return;

        const newTitle = elements.renameTitleInput.value.trim();
        if (!newTitle) {
            showToast("Title cannot be empty!", "error");
            return;
        }

        try {
            const res = await fetch(`/api/conversations/${idToRename}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle })
            });

            if (!res.ok) throw new Error("Failed to rename");

            const conv = state.conversations.find(c => c.id === idToRename);
            if (conv) conv.title = newTitle;

            renderConversationsList(state.conversations);
            elements.renameModal.classList.remove('open');
            state.targetConvIdForAction = null;
            showToast("Chat renamed successfully!", "success");
        } catch (err) {
            showToast("Could not rename chat", "error");
        }
    }

    async function confirmDeleteConversation() {
        const idToDelete = state.targetConvIdForAction || state.activeConversationId;
        if (!idToDelete) return;

        try {
            const res = await fetch(`/api/conversations/${idToDelete}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error("Failed to delete");

            state.conversations = state.conversations.filter(c => c.id !== idToDelete);
            renderConversationsList(state.conversations);
            elements.deleteModal.classList.remove('open');

            if (state.activeConversationId === idToDelete) {
                startNewChat();
            }

            state.targetConvIdForAction = null;
            showToast("Chat deleted", "info");
        } catch (err) {
            showToast("Could not delete chat", "error");
        }
    }

    // =========================================================
    // SENDING & RENDERING MESSAGES
    // =========================================================

    async function handleSendMessage() {
        if (state.isSending) return;

        const text = elements.messageInput.value.trim();
        if (!text) return;

        // Reset input immediately
        elements.messageInput.value = '';
        autoResizeTextarea();
        elements.clearInputBtn.style.display = 'none';

        // Hide welcome if visible
        elements.welcomeContainer.style.display = 'none';

        // Append user message to UI
        appendMessageUI('user', text);
        scrollToBottom();

        // Show typing indicator
        state.isSending = true;
        elements.typingIndicator.style.display = 'flex';
        elements.sendBtn.disabled = true;
        scrollToBottom();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: state.activeConversationId,
                    message: text,
                    model_name: state.currentModel.id,
                    provider: state.currentModel.provider
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Luna couldn't complete the reply");
            }

            // If a new conversation was created on the backend
            if (data.is_new || !state.activeConversationId) {
                state.activeConversationId = data.conversation_id;
                // Add to list and re-render
                state.conversations.unshift({
                    id: data.conversation_id,
                    title: data.title,
                    model_provider: state.currentModel.provider,
                    model_name: state.currentModel.id,
                    updated_at: new Date().toISOString()
                });
                renderConversationsList(state.conversations);
            }

            // Append assistant reply
            appendMessageUI('assistant', data.assistant_message.content, data.assistant_message.model);
        } catch (err) {
            console.error("Chat error:", err);
            appendMessageUI('assistant', `**Luna:** *${err.message || 'Something went wrong.'}* Please check your API keys or try again.`);
        } finally {
            state.isSending = false;
            elements.typingIndicator.style.display = 'none';
            elements.sendBtn.disabled = false;
            scrollToBottom();
            elements.messageInput.focus();
        }
    }

    function appendMessageUI(role, content, modelName = null) {
        const row = document.createElement('div');
        row.className = `message-row ${role}-row`;

        if (role === 'user') {
            const userInitial = (state.user.preferredName || state.user.username || 'U')[0].toUpperCase();
            row.innerHTML = `
                <div class="msg-bubble">
                    ${escapeHtml(content).replace(/\n/g, '<br>')}
                </div>
                <div class="msg-avatar user-avatar">${userInitial}</div>
            `;
        } else {
            // Markdown parsing for assistant
            let htmlContent = '';
            try {
                htmlContent = marked.parse(content);
            } catch (e) {
                htmlContent = `<p>${escapeHtml(content)}</p>`;
            }

            const modelDisplay = modelName ? `<span class="msg-model-tag"><i class="fa-solid fa-microchip"></i> ${modelName}</span>` : '';

            row.innerHTML = `
                <div class="msg-avatar luna-avatar">🌙</div>
                <div class="msg-bubble">
                    <div class="msg-body">${htmlContent}</div>
                    <div class="msg-footer">
                        ${modelDisplay}
                        <div class="msg-actions">
                            <button class="msg-action-btn copy-msg-btn" title="Copy reply">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                            <button class="msg-action-btn speak-msg-btn" title="Read aloud">
                                <i class="fa-solid fa-volume-high"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Syntax highlighting and copy button for code blocks
            const codeBlocks = row.querySelectorAll('pre code');
            codeBlocks.forEach(codeEl => {
                hljs.highlightElement(codeEl);

                // Wrap in code block container with copy button
                const pre = codeEl.parentElement;
                const wrapper = document.createElement('div');
                wrapper.className = 'code-block-wrapper';

                const langMatch = codeEl.className.match(/language-([a-z0-9_-]+)/i);
                const lang = langMatch ? langMatch[1] : 'code';

                const header = document.createElement('div');
                header.className = 'code-block-header';
                header.innerHTML = `
                    <span>${lang}</span>
                    <button class="copy-code-btn" type="button">
                        <i class="fa-regular fa-copy"></i>
                        <span>Copy</span>
                    </button>
                `;

                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(header);
                wrapper.appendChild(pre);

                const copyBtn = header.querySelector('.copy-code-btn');
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(codeEl.innerText).then(() => {
                        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>Copied!</span>`;
                        copyBtn.style.color = '#4ade80';
                        setTimeout(() => {
                            copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> <span>Copy</span>`;
                            copyBtn.style.color = '';
                        }, 2000);
                    });
                });
            });

            // Action: Copy entire message
            const copyMsgBtn = row.querySelector('.copy-msg-btn');
            copyMsgBtn?.addEventListener('click', () => {
                navigator.clipboard.writeText(content).then(() => {
                    showToast("Copied message to clipboard!", "success");
                });
            });

            // Action: Read Aloud
            const speakMsgBtn = row.querySelector('.speak-msg-btn');
            speakMsgBtn?.addEventListener('click', () => {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const cleanText = content.replace(/[*#`_~]/g, '');
                    const utterance = new SpeechSynthesisUtterance(cleanText);
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                    window.speechSynthesis.speak(utterance);
                    showToast("Reading aloud...", "info");
                } else {
                    showToast("Speech synthesis not supported in this browser.", "info");
                }
            });
        }

        elements.messagesList.appendChild(row);
    }

    function scrollToBottom() {
        elements.chatFeed.scrollTop = elements.chatFeed.scrollHeight;
    }

    function autoResizeTextarea() {
        const ta = elements.messageInput;
        if (!ta) return;
        ta.style.height = 'auto';
        const newHeight = Math.min(ta.scrollHeight, 180);
        ta.style.height = `${newHeight}px`;
    }

    // =========================================================
    // SETTINGS & API KEYS
    // =========================================================

    function openSettingsModal(defaultTab = 'tab-keys') {
        elements.settingsModal.classList.add('open');
        switchSettingsTab(defaultTab);
        fetchSettings();
    }

    function closeSettingsModal() {
        elements.settingsModal.classList.remove('open');
    }

    function switchSettingsTab(tabId) {
        const tabBtns = elements.settingsModal.querySelectorAll('.tab-btn');
        const contents = elements.settingsModal.querySelectorAll('.tab-content');

        tabBtns.forEach(b => {
            if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
            else b.classList.remove('active');
        });

        contents.forEach(c => {
            if (c.id === tabId) c.classList.add('active');
            else c.classList.remove('active');
        });
    }

    async function fetchSettings() {
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) throw new Error("Failed to load settings");
            const data = await res.json();

            state.keysStatus = data.keys || {};
            updateKeyBadgesUI();
            updateKeyIndicatorDots();
        } catch (e) {
            console.error("Could not fetch settings", e);
        }
    }

    function updateKeyBadgesUI() {
        const updateBadge = (badgeEl, status) => {
            if (!badgeEl) return;
            if (status && status.configured) {
                badgeEl.textContent = `Configured (${status.masked})`;
                badgeEl.className = 'key-status-badge active';
            } else {
                badgeEl.textContent = 'Not Configured';
                badgeEl.className = 'key-status-badge';
            }
        };

        updateBadge(elements.groqStatusBadge, state.keysStatus.groq);
        updateBadge(elements.geminiStatusBadge, state.keysStatus.gemini);
        updateBadge(elements.openrouterStatusBadge, state.keysStatus.openrouter);
    }

    function updateKeyIndicatorDots() {
        const hasAnyKey = state.keysStatus.groq?.configured || state.keysStatus.gemini?.configured || state.keysStatus.openrouter?.configured;
        if (elements.keyIndicatorDot) {
            if (hasAnyKey) {
                elements.keyIndicatorDot.className = 'key-indicator-dot';
                elements.keyIndicatorDot.title = 'API Keys Configured';
            } else {
                elements.keyIndicatorDot.className = 'key-indicator-dot warning';
                elements.keyIndicatorDot.title = 'No API Keys Set Yet';
            }
        }
    }

    async function saveApiKeys() {
        const payload = {};
        const groq = elements.groqApiKeyInput.value.trim();
        const gemini = elements.geminiApiKeyInput.value.trim();
        const openrouter = elements.openrouterApiKeyInput.value.trim();

        if (groq) payload.groq = groq;
        if (gemini) payload.gemini = gemini;
        if (openrouter) payload.openrouter = openrouter;

        try {
            elements.saveKeysBtn.disabled = true;
            elements.saveKeysBtn.innerHTML = `<span class="mini-spinner"></span> Saving...`;

            const res = await fetch('/api/settings/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Could not save keys");

            showToast("Keys saved safely in SQLite!", "success");

            // Clear password inputs for security and refresh state
            elements.groqApiKeyInput.value = '';
            elements.geminiApiKeyInput.value = '';
            elements.openrouterApiKeyInput.value = '';

            await fetchSettings();
            selectModel(state.currentModel.id, state.currentModel.provider, state.currentModel.name, state.currentModel.icon, state.currentModel.badge, false);
        } catch (err) {
            showToast("Failed to save keys: " + err.message, "error");
        } finally {
            elements.saveKeysBtn.disabled = false;
            elements.saveKeysBtn.innerHTML = `<i class="fa-solid fa-check"></i> Save API Keys`;
        }
    }

    async function savePersonaPreferences() {
        const nickname = elements.personaNickname.value.trim();
        const selectedTone = document.querySelector('input[name="persona_tone"]:checked')?.value || 'girly_sweet';

        try {
            elements.savePersonaBtn.disabled = true;
            const res = await fetch('/api/settings/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    preferred_name: nickname,
                    persona_tone: selectedTone
                })
            });

            if (!res.ok) throw new Error("Could not save profile");

            state.user.preferredName = nickname;
            state.user.personaTone = selectedTone;

            showToast("Preferences saved!", "success");
            closeSettingsModal();
        } catch (err) {
            showToast("Failed to save preferences: " + err.message, "error");
        } finally {
            elements.savePersonaBtn.disabled = false;
        }
    }

    // =========================================================
    // UTILITIES
    // =========================================================

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} animate-pop`;
        const iconHtml = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : (type === 'error' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-circle-info"></i>');

        toast.innerHTML = `
            <span class="toast-icon">${iconHtml}</span>
            <span class="toast-text">${escapeHtml(message)}</span>
            <button class="toast-close" type="button">&times;</button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Run init
    init();
});
