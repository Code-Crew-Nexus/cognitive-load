document.addEventListener('DOMContentLoaded', () => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' });

    // UI Elements
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('drop-zone');
    const statusMsg = document.getElementById('uploadStatus');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const apiKeyInput = document.getElementById('apiKey');

    // Folders
    const subjectInput = document.getElementById('subjectInput');
    const addFolderBtn = document.getElementById('addFolderBtn');
    const folderList = document.getElementById('folderList');

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Content Containers
    const textContent = document.getElementById('textOverviewContent');
    const visualContent = document.getElementById('visualOverviewContent');
    const chatHistory = document.getElementById('chatHistory');
    const queryInput = document.getElementById('queryInput');
    const sendBtn = document.getElementById('sendBtn');

    // State
    const appState = {
        "General": { text: "", visual: "", chat: [] }
    };
    let currentSubject = "General";

    // --- FOLDER MANAGEMENT ---
    function setActiveFolder(folderName) {
        currentSubject = folderName;
        // Update UI selection
        document.querySelectorAll('.folder-item').forEach(el => {
            el.classList.toggle('active', el.dataset.subject === folderName);
        });
        renderCurrentSubject();
    }

    addFolderBtn.addEventListener('click', () => {
        const newSubject = subjectInput.value.trim();
        if (newSubject && !appState[newSubject]) {
            appState[newSubject] = { text: "", visual: "", chat: [] };
            const li = document.createElement('li');
            li.className = 'folder-item';
            li.dataset.subject = newSubject;
            li.textContent = `📁 ${newSubject}`;
            li.addEventListener('click', () => setActiveFolder(newSubject));
            folderList.appendChild(li);
            subjectInput.value = '';
            setActiveFolder(newSubject);
        }
    });

    // Make the initial General folder clickable
    document.querySelector('.folder-item[data-subject="General"]').addEventListener('click', () => setActiveFolder('General'));

    // --- TAB MANAGEMENT ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // --- RENDER LOGIC ---
    function renderCurrentSubject() {
        const data = appState[currentSubject];
        
        // Text Tab
        if (data.text) {
            textContent.innerHTML = `<div class="message assistant-msg">${marked.parse(data.text)}</div>`;
        } else {
            textContent.innerHTML = `<div class="empty-state">Select a folder and upload a document to see the textual overview.</div>`;
        }

        // Visual Tab
        if (data.visual) {
            visualContent.innerHTML = `<div class="message assistant-msg"><div class="mermaid">${data.visual}</div></div>`;
            try {
                mermaid.init(undefined, visualContent.querySelectorAll('.mermaid'));
            } catch(e) { console.error('Mermaid error', e); }
        } else {
            visualContent.innerHTML = `<div class="empty-state">Select a folder and upload a document to see the visual tree.</div>`;
        }

        // Q&A Tab
        chatHistory.innerHTML = '';
        if (data.chat.length === 0) {
            chatHistory.innerHTML = `<div class="message assistant-msg">Hello! Select a subject folder on the left and start asking questions!</div>`;
        } else {
            data.chat.forEach(msg => {
                let msgDiv = document.createElement('div');
                msgDiv.className = `message ${msg.role === 'user' ? 'user-msg' : 'assistant-msg'}`;
                msgDiv.innerHTML = marked.parse(msg.text);

                if (msg.images && msg.images.length > 0) {
                    let imgContainer = document.createElement('div');
                    imgContainer.className = 'images-container';
                    msg.images.forEach(src => {
                        let img = document.createElement('img');
                        img.src = src;
                        img.alt = 'Extracted Diagram';
                        imgContainer.appendChild(img);
                    });
                    msgDiv.appendChild(imgContainer);
                }
                chatHistory.appendChild(msgDiv);
            });
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // --- DRAG & DROP UPLOAD ---
    dropZone.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, preventDefaults, false));
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.add('dragover'), false));
    ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.remove('dragover'), false));
    
    dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));
    fileInput.addEventListener('change', function() { handleFiles(this.files); });

    async function handleFiles(files) {
        if (!files.length) return;
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.querySelector('p').innerText = `Ingesting into ${currentSubject}...`;
        const apiKey = apiKeyInput.value.trim();

        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            statusMsg.innerText = `Uploading ${file.name}...`;
            let formData = new FormData();
            formData.append('file', file);
            formData.append('subject', currentSubject);
            if (apiKey) formData.append('api_key', apiKey);
            
            try {
                let response = await fetch('/api/upload', { method: 'POST', body: formData });
                let result = await response.json();
                if (response.ok) {
                    statusMsg.innerText = `${file.name} processed!`;
                    if (result.overview) {
                        let parts = result.overview.split('```mermaid');
                        let textPart = parts[0].replace('```markdown', '').replace('```', '').trim();
                        let visualPart = parts.length > 1 ? parts[1].replace('```', '').trim() : '';

                        appState[currentSubject].text += (appState[currentSubject].text ? '\n\n---\n\n' : '') + `**Overview for ${file.name}**\n\n` + textPart;
                        if(visualPart) {
                           appState[currentSubject].visual += (appState[currentSubject].visual ? '\n\n' : '') + visualPart;
                        }
                    }
                } else {
                    statusMsg.innerText = `Error: ${result.detail}`;
                }
            } catch (err) {
                statusMsg.innerText = `Error uploading ${file.name}`;
            }
        }
        loadingOverlay.classList.add('hidden');
        renderCurrentSubject();
        setTimeout(() => { statusMsg.innerText = ''; }, 3000);
    }

    // --- CHAT LOGIC ---
    sendBtn.addEventListener('click', sendQuery);
    queryInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendQuery(); });

    async function sendQuery() {
        const query = queryInput.value.trim();
        const apiKey = apiKeyInput.value.trim();
        if (!query) return;
        if (!apiKey) { alert('Please enter your Gemini API Key in the sidebar.'); return; }

        queryInput.value = '';
        appState[currentSubject].chat.push({ role: 'user', text: query });
        renderCurrentSubject();
        
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.querySelector('p').innerText = 'Synthesizing Knowledge...';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, api_key: apiKey, subject: currentSubject })
            });
            const data = await response.json();
            if (response.ok) {
                appState[currentSubject].chat.push({ role: 'assistant', text: data.answer, images: data.images });
            } else {
                appState[currentSubject].chat.push({ role: 'assistant', text: `Error: ${data.detail}` });
            }
        } catch (err) {
            appState[currentSubject].chat.push({ role: 'assistant', text: 'Error connecting to server.' });
        } finally {
            loadingOverlay.classList.add('hidden');
            renderCurrentSubject();
        }
    }
});
