(function() {
    'use strict';

    const API_BASE = 'http://localhost:3000';
    const STORAGE_KEYS = {
        STORIES: 'dashboard_stories',
        AGENTS: 'dashboard_agents',
        BOARD: 'dashboard_board',
        LAST_UPDATE: 'dashboard_last_update'
    };

    const MOCK_DATA = {
        agents: [
            {
                id: 'agent-001',
                name: 'Pinchy',
                type: 'Orchestrator',
                status: 'online',
                lastActive: new Date(Date.now() - 5 * 60000).toISOString()
            },
            {
                id: 'agent-002',
                name: 'Builder',
                type: 'Code Generator',
                status: 'online',
                lastActive: new Date(Date.now() - 2 * 60000).toISOString()
            },
            {
                id: 'agent-003',
                name: 'Researcher',
                type: 'Data Analyst',
                status: 'busy',
                lastActive: new Date(Date.now() - 10 * 60000).toISOString()
            },
            {
                id: 'agent-004',
                name: 'Tester',
                type: 'QA Agent',
                status: 'offline',
                lastActive: new Date(Date.now() - 60 * 60000).toISOString()
            },
            {
                id: 'agent-005',
                name: 'Reviewer',
                type: 'Code Reviewer',
                status: 'online',
                lastActive: new Date(Date.now() - 15 * 60000).toISOString()
            },
            {
                id: 'agent-006',
                name: 'Deployer',
                type: 'DevOps',
                status: 'busy',
                lastActive: new Date(Date.now() - 8 * 60000).toISOString()
            }
        ],
        stories: [
            {
                id: 'STY-001',
                title: 'Implement user authentication',
                status: 'done',
                assignee: 'Builder',
                priority: 'high'
            },
            {
                id: 'STY-002',
                title: 'Design dashboard layout',
                status: 'done',
                assignee: 'Researcher',
                priority: 'high'
            },
            {
                id: 'STY-003',
                title: 'Create API endpoints',
                status: 'in-progress',
                assignee: 'Builder',
                priority: 'high'
            },
            {
                id: 'STY-004',
                title: 'Write unit tests',
                status: 'in-progress',
                assignee: 'Tester',
                priority: 'medium'
            },
            {
                id: 'STY-005',
                title: 'Setup CI/CD pipeline',
                status: 'review',
                assignee: 'Deployer',
                priority: 'medium'
            },
            {
                id: 'STY-006',
                title: 'Code review for PR #42',
                status: 'review',
                assignee: 'Reviewer',
                priority: 'medium'
            },
            {
                id: 'STY-007',
                title: 'Research database optimization',
                status: 'todo',
                assignee: 'Researcher',
                priority: 'low'
            },
            {
                id: 'STY-008',
                title: 'Update documentation',
                status: 'todo',
                assignee: 'Reviewer',
                priority: 'low'
            },
            {
                id: 'STY-009',
                title: 'Implement rate limiting',
                status: 'todo',
                assignee: 'Builder',
                priority: 'medium'
            },
            {
                id: 'STY-010',
                title: 'Security audit',
                status: 'todo',
                assignee: 'Reviewer',
                priority: 'high'
            }
        ]
    };

    let state = {
        agents: [],
        stories: [],
        filteredStories: [],
        filters: {
            assignee: '',
            priority: '',
            status: ''
        }
    };

    let lastRefreshTime = 0;

    function init() {
        bindEvents();
        loadData();
    }

    function bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', refreshData);
        document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
        document.getElementById('createStoryBtn').addEventListener('click', openModal);
        document.getElementById('closeModalBtn').addEventListener('click', closeModal);
        document.getElementById('cancelStoryBtn').addEventListener('click', closeModal);
        document.getElementById('createStoryForm').addEventListener('submit', handleCreateStory);

        document.getElementById('filterAssignee').addEventListener('change', handleFilterChange);
        document.getElementById('filterPriority').addEventListener('change', handleFilterChange);
        document.getElementById('filterStatus').addEventListener('change', handleFilterChange);

        document.querySelector('.modal-content').addEventListener('click', function(e) {
            e.stopPropagation();
        });
        document.getElementById('createStoryModal').addEventListener('click', closeModal);
    }

    async function loadData() {
        try {
            await Promise.all([
                loadAgents(),
                loadStories()
            ]);
            updateAssigneeFilters();
            renderAgents();
            renderStories();
        } catch (error) {
            console.error('Failed to load data:', error);
            showToast('Failed to load data', 'error');
        }
    }

    async function refreshData() {
        const now = Date.now();
        if (now - lastRefreshTime < 2000) {
            showToast('Please wait 2 seconds between refreshes', 'error');
            return;
        }
        lastRefreshTime = now;
        localStorage.removeItem(STORAGE_KEYS.LAST_UPDATE);
        await loadData();
        showToast('Data refreshed successfully', 'success');
    }

    async function loadAgents() {
        const cached = localStorage.getItem(STORAGE_KEYS.AGENTS);
        const lastUpdate = localStorage.getItem(STORAGE_KEYS.LAST_UPDATE);
        const cacheAge = lastUpdate ? Date.now() - parseInt(lastUpdate) : Infinity;

        if (cached && cacheAge < 30000) {
            state.agents = JSON.parse(cached);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/agents`);
            if (!response.ok) throw new Error('API request failed');
            state.agents = await response.json();
            localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(state.agents));
            localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, Date.now().toString());
        } catch (error) {
            console.warn('API unavailable, using mock data for agents');
            state.agents = MOCK_DATA.agents;
            localStorage.setItem(STORAGE_KEYS.AGENTS, JSON.stringify(state.agents));
        }
    }

    async function loadStories() {
        try {
            const response = await fetch(`${API_BASE}/stories`);
            if (!response.ok) throw new Error('API request failed');
            state.stories = await response.json();
        } catch (error) {
            console.warn('API unavailable, using mock data for stories');
            state.stories = MOCK_DATA.stories;
        }
        state.filteredStories = [...state.stories];
    }

    function updateAssigneeFilters() {
        const assigneeSelect = document.getElementById('filterAssignee');
        const assigneeInStorySelect = document.getElementById('storyAssignee');

        const assignees = [...new Set(state.agents.map(a => a.name))].sort();

        const currentValue = assigneeSelect.value;
        assigneeSelect.innerHTML = '<option value="">All</option>' +
            assignees.map(a => `<option value="${a}">${a}</option>`).join('');
        assigneeSelect.value = currentValue;

        assigneeInStorySelect.innerHTML = '<option value="">Select assignee</option>' +
            assignees.map(a => `<option value="${a}">${a}</option>`).join('');
    }

    function renderAgents() {
        const container = document.getElementById('agentsGrid');

        if (state.agents.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤖</div><h3>No agents found</h3><p>No agents are currently registered</p></div>';
            return;
        }

        container.innerHTML = state.agents.map(agent => `
            <div class="agent-card" data-agent-id="${agent.id}">
                <div class="agent-header">
                    <span class="agent-name">${escapeHtml(agent.name)}</span>
                    <span class="agent-type">${escapeHtml(agent.type)}</span>
                </div>
                <div class="agent-status">
                    <span class="status-indicator ${agent.status}"></span>
                    <span class="status-text">${capitalize(agent.status)}</span>
                </div>
                <div class="agent-lastActive">
                    Last active: ${formatTimeAgo(agent.lastActive)}
                </div>
            </div>
        `).join('');
    }

    function renderStories() {
        const container = document.getElementById('storiesBoard');

        applyFilters();

        if (state.filteredStories.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><h3>No stories found</h3><p>No stories match your filters or create a new story</p></div>';
            return;
        }

        container.innerHTML = `
            <table class="stories-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Assignee</th>
                        <th>Priority</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.filteredStories.map(story => `
                        <tr data-story-id="${story.id}">
                            <td class="story-id">${escapeHtml(story.id)}</td>
                            <td class="story-title">${escapeHtml(story.title)}</td>
                            <td><span class="status-badge ${story.status}">${formatStatus(story.status)}</span></td>
                            <td class="story-assignee">
                                <span class="assignee-avatar">${getInitials(story.assignee)}</span>
                                ${escapeHtml(story.assignee)}
                            </td>
                            <td><span class="priority-badge ${story.priority}">${capitalize(story.priority)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function applyFilters() {
        state.filteredStories = state.stories.filter(story => {
            const matchesAssignee = !state.filters.assignee || story.assignee === state.filters.assignee;
            const matchesPriority = !state.filters.priority || story.priority === state.filters.priority;
            const matchesStatus = !state.filters.status || story.status === state.filters.status;
            return matchesAssignee && matchesPriority && matchesStatus;
        });
    }

    function handleFilterChange() {
        state.filters.assignee = document.getElementById('filterAssignee').value;
        state.filters.priority = document.getElementById('filterPriority').value;
        state.filters.status = document.getElementById('filterStatus').value;
        renderStories();
    }

    function clearFilters() {
        state.filters = { assignee: '', priority: '', status: '' };
        document.getElementById('filterAssignee').value = '';
        document.getElementById('filterPriority').value = '';
        document.getElementById('filterStatus').value = '';
        renderStories();
        showToast('Filters cleared', 'success');
    }

    function openModal() {
        document.getElementById('createStoryModal').classList.add('active');
        document.getElementById('storyTitle').focus();
    }

    function closeModal() {
        document.getElementById('createStoryModal').classList.remove('active');
        document.getElementById('createStoryForm').reset();
    }

    function handleCreateStory(e) {
        e.preventDefault();

        const title = document.getElementById('storyTitle').value.trim();
        const assignee = document.getElementById('storyAssignee').value;
        const priority = document.getElementById('storyPriority').value;
        const description = document.getElementById('storyDescription').value.trim();

        if (!title || !assignee) {
            showToast('Please fill in required fields', 'error');
            return;
        }

        const newStory = {
            id: generateStoryId(),
            title: title,
            status: 'todo',
            assignee: assignee,
            priority: priority,
            description: description,
            createdAt: new Date().toISOString()
        };

        state.stories.unshift(newStory);
        renderStories();
        closeModal();
        showToast(`Story ${newStory.id} created successfully`, 'success');
    }

    function generateStoryId() {
        const maxId = state.stories.reduce((max, story) => {
            const num = parseInt(story.id.split('-')[1]) || 0;
            return Math.max(max, num);
        }, 0);
        return `STY-${String(maxId + 1).padStart(3, '0')}`;
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function escapeHtml(text) {
        if (typeof document === 'undefined') {
            return String(text).replace(/[&<>"']/g, (char) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char]));
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function formatStatus(status) {
        const statusMap = {
            'todo': 'To Do',
            'in-progress': 'In Progress',
            'review': 'Review',
            'done': 'Done'
        };
        return statusMap[status] || capitalize(status);
    }

    function getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    function formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
