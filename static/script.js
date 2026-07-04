// Application State
let sessionId = null;
let studentName = null;
let studentClass = null;
let currentActivity = null;
let messageCount = 0;
let maxMessages = 80;

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const activityScreen = document.getElementById('activity-screen');
const chatScreen = document.getElementById('chat-screen');
const studentNameInput = document.getElementById('student-name');
const studentClassInput = document.getElementById('student-class');
const startBtn = document.getElementById('start-btn');
const studentInfo = document.getElementById('student-info');
const chatMessages = document.getElementById('chat-messages');
const chatContainer = document.querySelector('.chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const backBtn = document.getElementById('back-btn');
const activityStatus = document.getElementById('activity-status');
const loading = document.getElementById('loading');
const messageCountEl = document.getElementById('message-count');
const maxMessagesEl = document.getElementById('max-messages');
const messageCounter = document.querySelector('.message-counter');
const newSessionBtn = document.getElementById('new-session-btn');

// Activity containers
const beginnerActivities = document.getElementById('beginner-activities');
const intermediateActivities = document.getElementById('intermediate-activities');
const advancedActivities = document.getElementById('advanced-activities');
const storyActivities = document.getElementById('story-activities');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    focusInput(studentNameInput);
});

// Event Listeners
function setupEventListeners() {
    // Start button
    startBtn.addEventListener('click', startSession);

    // Enter key on welcome screen inputs
    studentNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            studentClassInput.focus();
        }
    });

    studentClassInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            startSession();
        }
    });

    // Send message
    sendBtn.addEventListener('click', sendMessage);

    // Message input handling
    messageInput.addEventListener('input', handleInputChange);
    messageInput.addEventListener('keydown', handleKeyDown);

    // Back button
    backBtn.addEventListener('click', () => {
        switchScreen('activity');
        chatMessages.innerHTML = '';
        chatMessages.classList.remove('story-mode-active');
        chatContainer.classList.remove('story-mode-active');
        chatMessages.style.backgroundImage = '';
        messageInput.disabled = false;
        sendBtn.disabled = false;
        // Don't reset counter - it's global per session
    });

    // New Session button
    newSessionBtn.addEventListener('click', () => {
        if (confirm('Start a new session? This will clear all progress and reset the counter.')) {
            location.reload();
        }
    });
}

// Auto-resize textarea
function handleInputChange() {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';

    // Enable/disable send button
    sendBtn.disabled = messageInput.value.trim() === '';
}

// Handle Enter key for sending messages
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (messageInput.value.trim() !== '') {
            sendMessage();
        }
    }
}

// Start Session
async function startSession() {
    const name = studentNameInput.value.trim();
    const stdClass = studentClassInput.value.trim();

    if (!name || !stdClass) {
        alert('Please enter both your name and class!');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch('/start_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                class: stdClass
            })
        });

        const data = await response.json();

        if (response.ok) {
            sessionId = data.session_id;
            studentName = data.name;
            studentClass = data.class;

            // Update student info display
            studentInfo.textContent = `${studentName} • Class ${studentClass}`;

            // Load activities
            await loadActivities();

            switchScreen('activity');
        } else {
            alert(data.error || 'Failed to start session.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to connect. Please make sure the server is running.');
    } finally {
        showLoading(false);
    }
}

// Load Activities
async function loadActivities() {
    try {
        const response = await fetch('/get_activities');
        const data = await response.json();

        // Clear existing activities
        beginnerActivities.innerHTML = '';
        intermediateActivities.innerHTML = '';
        advancedActivities.innerHTML = '';
        storyActivities.innerHTML = '';

        // Render beginner activities
        data.activities.beginner.forEach(activity => {
            beginnerActivities.appendChild(createActivityCard(activity));
        });

        // Render intermediate activities
        data.activities.intermediate.forEach(activity => {
            intermediateActivities.appendChild(createActivityCard(activity));
        });

        // Render advanced activities
        data.activities.advanced.forEach(activity => {
            advancedActivities.appendChild(createActivityCard(activity));
        });

        // Render story mode activities
        if (data.activities.story_mode) {
            data.activities.story_mode.forEach(activity => {
                storyActivities.appendChild(createActivityCard(activity));
            });
        }

    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Create Activity Card
function createActivityCard(activity) {
    const card = document.createElement('div');
    card.className = 'activity-card';
    card.dataset.activityId = activity.id;

    card.innerHTML = `
        <div class="activity-card-header">
            <h4 class="activity-card-title">${activity.title}</h4>
            <span class="activity-badge ${activity.level}">${activity.level}</span>
        </div>
        <p class="activity-card-description">${activity.description}</p>
    `;

    card.addEventListener('click', () => startActivity(activity.id, activity.title));

    return card;
}

// Start Activity
async function startActivity(activityId, activityTitle) {
    if (!sessionId) return;

    showLoading(true);

    try {
        const response = await fetch('/start_activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId,
                activity_id: activityId
            })
        });

        const data = await response.json();

        if (response.ok) {
            currentActivity = { id: activityId, title: activityTitle };
            activityStatus.textContent = activityTitle;

            // Add story mode wallpaper based on activity
            if (activityId === 'story_adventure' || activityId === 'detective_classroom') {
                chatMessages.classList.add('story-mode-active');
                chatContainer.classList.add('story-mode-active');

                // Set specific wallpaper based on story type
                if (activityId === 'detective_classroom') {
                    chatMessages.style.backgroundImage = "url('/static/detective-wallpaper.png')";
                } else {
                    chatMessages.style.backgroundImage = "url('/static/story-wallpaper.png')";
                }
            } else {
                chatMessages.classList.remove('story-mode-active');
                chatContainer.classList.remove('story-mode-active');
                chatMessages.style.backgroundImage = '';
            }

            // Update message counter
            updateMessageCounter(data.message_count, data.max_messages);

            switchScreen('chat');
            addMessage('assistant', data.message, data.image_url);
            focusInput(messageInput);
        } else if (response.status === 403 && data.limit_reached) {
            // Session limit reached
            updateMessageCounter(data.message_count, data.max_messages);
            alert(data.error);
        } else {
            alert(data.error || 'Failed to start activity.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to start activity. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Send Message
async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message || !sessionId) return;

    // Add user message to chat
    addMessage('user', message);

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        const response = await fetch('/send_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId,
                message: message
            })
        });

        const data = await response.json();

        // Remove typing indicator
        removeTypingIndicator(typingId);

        if (response.ok) {
            addMessage('assistant', data.message, data.image_url);

            // Update message counter
            updateMessageCounter(data.message_count, data.max_messages);
        } else if (response.status === 403 && data.limit_reached) {
            // Session limit reached
            addMessage('assistant', data.error);
            messageInput.disabled = true;
            sendBtn.disabled = true;
        } else {
            addMessage('assistant', '❌ Sorry, I encountered an error. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator(typingId);
        addMessage('assistant', '❌ Connection error. Please check your internet connection.');
    }

    focusInput(messageInput);
}

// Add Message to Chat
function addMessage(role, content, imageUrl = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'assistant' ? '🦊' : '👤';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    // Check if this is story mode
    if (role === 'assistant' && currentActivity?.id === 'story_adventure') {
        // Parse story mode format
        const sections = parseStoryResponse(content);

        // Add image if present
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'story-image';
            img.alt = 'Story scene';
            messageContent.appendChild(img);
        }

        // Story section
        if (sections.story) {
            const storyDiv = document.createElement('div');
            storyDiv.className = 'story-section';
            storyDiv.innerHTML = `<strong>📖 STORY</strong><br>${formatMessage(sections.story)}`;
            messageContent.appendChild(storyDiv);
        }

        // Mascot section
        if (sections.mascot) {
            const mascotDiv = document.createElement('div');
            mascotDiv.className = 'mascot-section';
            mascotDiv.innerHTML = `<strong>🦊 LEXI</strong><br>${formatMessage(sections.mascot)}`;
            messageContent.appendChild(mascotDiv);
        }

        // Next action section
        if (sections.next) {
            const nextDiv = document.createElement('div');
            nextDiv.className = 'next-action-section';
            nextDiv.innerHTML = `<strong>❓ WHAT'S NEXT?</strong><br>${formatMessage(sections.next)}`;
            messageContent.appendChild(nextDiv);
        }
    } else {
        // Regular message format
        if (role === 'assistant') {
            messageContent.innerHTML = formatMessage(content);
        } else {
            messageContent.textContent = content;
        }

        // Add inline image for regular activities
        if (imageUrl && role === 'assistant') {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'inline-image';
            img.alt = 'Learning visual';
            messageContent.appendChild(img);
        }
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Parse Story Response into sections
function parseStoryResponse(content) {
    const sections = { story: '', mascot: '', next: '' };

    // Split by emoji markers
    const storyMatch = content.match(/📖.*?:(.*?)(?=🦊|$)/s);
    const mascotMatch = content.match(/🦊.*?:(.*?)(?=❓|$)/s);
    const nextMatch = content.match(/❓.*?:(.*?)$/s);

    if (storyMatch) sections.story = storyMatch[1].trim();
    if (mascotMatch) sections.mascot = mascotMatch[1].trim();
    if (nextMatch) sections.next = nextMatch[1].trim();

    return sections;
}

// Format message with markdown support
function formatMessage(text) {
    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em>
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Convert line breaks to <br>
    text = text.replace(/\n/g, '<br>');

    return text;
}

// Show Typing Indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant';
    typingDiv.id = `typing-${Date.now()}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🦊';

    const typingContent = document.createElement('div');
    typingContent.className = 'message-content typing-indicator';
    typingContent.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;

    typingDiv.appendChild(avatar);
    typingDiv.appendChild(typingContent);

    chatMessages.appendChild(typingDiv);
    scrollToBottom();

    return typingDiv.id;
}

// Remove Typing Indicator
function removeTypingIndicator(typingId) {
    const typingDiv = document.getElementById(typingId);
    if (typingDiv) {
        typingDiv.remove();
    }
}

// Switch Screen
function switchScreen(screen) {
    welcomeScreen.classList.remove('active');
    activityScreen.classList.remove('active');
    chatScreen.classList.remove('active');

    if (screen === 'welcome') {
        welcomeScreen.classList.add('active');
    } else if (screen === 'activity') {
        activityScreen.classList.add('active');
    } else if (screen === 'chat') {
        chatScreen.classList.add('active');
    }
}

// Scroll to Bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show/Hide Loading
function showLoading(show) {
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

// Focus Input
function focusInput(element) {
    setTimeout(() => element.focus(), 100);
}

// Update Message Counter
function updateMessageCounter(count, max) {
    messageCount = count;
    maxMessages = max;
    messageCountEl.textContent = count;
    maxMessagesEl.textContent = max;

    // Update counter color based on usage
    messageCounter.classList.remove('warning', 'danger');

    const percentage = (count / max) * 100;
    if (percentage >= 90) {
        messageCounter.classList.add('danger');
    } else if (percentage >= 70) {
        messageCounter.classList.add('warning');
    }
}
