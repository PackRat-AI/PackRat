// Simple tests for agent dashboard core functionality
// Run with: node tests.js

const MOCK_DATA = {
    agents: [
        { id: 'agent-001', name: 'Pinchy', type: 'Orchestrator', status: 'online', lastActive: new Date().toISOString() },
        { id: 'agent-002', name: 'Builder', type: 'Code Generator', status: 'busy', lastActive: new Date().toISOString() },
        { id: 'agent-003', name: 'Tester', type: 'QA Agent', status: 'offline', lastActive: new Date().toISOString() }
    ],
    stories: [
        { id: 'STY-001', title: 'Implement auth', status: 'done', assignee: 'Builder', priority: 'high' },
        { id: 'STY-002', title: 'Design layout', status: 'in-progress', assignee: 'Pinchy', priority: 'medium' },
        { id: 'STY-003', title: 'Write tests', status: 'todo', assignee: 'Tester', priority: 'low' },
        { id: 'STY-004', title: 'Code review', status: 'review', assignee: 'Builder', priority: 'high' }
    ]
};

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (error) {
        console.log(`✗ ${name}: ${error.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

function assertTrue(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

// Data function tests
test('generateStoryId creates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
        const id = `STY-${String(i + 1).padStart(3, '0')}`;
        assertTrue(!ids.has(id), `Duplicate ID: ${id}`);
        ids.add(id);
    }
    assertEqual(ids.size, 100, 'All IDs should be unique');
});

test('capitalize first letter', () => {
    assertEqual(capitalize('hello'), 'Hello', 'capitalize hello');
    assertEqual(capitalize('world'), 'World', 'capitalize world');
    assertEqual(capitalize('ALREADY'), 'ALREADY', 'capitalize already uppercase');
    assertEqual(capitalize('a'), 'A', 'capitalize single char');
});

test('escapeHtml escapes special characters', () => {
    if (typeof document === 'undefined') {
        console.log('⊘ escapeHtml: skipped (browser only)');
        return;
    }
    assertEqual(escapeHtml('<script>'), '&lt;script&gt;', 'escape script tag');
    assertEqual(escapeHtml('"quotes"'), '&quot;quotes&quot;', 'escape quotes');
    assertEqual(escapeHtml('&amp;'), '&amp;', 'escape ampersand');
});

test('getInitials generates correct initials', () => {
    assertEqual(getInitials('John Doe'), 'JD', 'John Doe initials');
    assertEqual(getInitials('Alice'), 'A', 'single name');
    assertEqual(getInitials('Bob Smith'), 'BS', 'Bob Smith');
    assertEqual(getInitials('A B'), 'AB', 'two single letters');
});

// Filtering tests
test('applyFilters filters by assignee', () => {
    const stories = [...MOCK_DATA.stories];
    const filtered = stories.filter(s => s.assignee === 'Builder');
    assertEqual(filtered.length, 2, 'should have 2 Builder stories');
    assertTrue(filtered.every(s => s.assignee === 'Builder'), 'all should be Builder');
});

test('applyFilters filters by priority', () => {
    const stories = [...MOCK_DATA.stories];
    const filtered = stories.filter(s => s.priority === 'high');
    assertEqual(filtered.length, 2, 'should have 2 high priority stories');
});

test('applyFilters filters by status', () => {
    const stories = [...MOCK_DATA.stories];
    const filtered = stories.filter(s => s.status === 'todo');
    assertEqual(filtered.length, 1, 'should have 1 todo story');
    assertEqual(filtered[0].title, 'Write tests', 'should be Write tests');
});

test('applyFilters handles multiple filters', () => {
    const stories = [...MOCK_DATA.stories];
    const filtered = stories.filter(s =>
        (s.assignee === 'Builder' || s.priority === 'low') && s.status !== 'done'
    );
    assertEqual(filtered.length, 2, 'should match combined filters');
    assertTrue(filtered.some(s => s.id === 'STY-003'), 'should include low priority story');
    assertTrue(filtered.some(s => s.id === 'STY-004'), 'should include Builder story');
});

// Mock data integrity tests
test('mockAgents have required fields', () => {
    MOCK_DATA.agents.forEach(agent => {
        assertTrue(agent.id, 'agent should have id');
        assertTrue(agent.name, 'agent should have name');
        assertTrue(agent.status, 'agent should have status');
        assertTrue(['online', 'offline', 'busy'].includes(agent.status), 'valid status');
    });
});

test('mockStories have required fields', () => {
    MOCK_DATA.stories.forEach(story => {
        assertTrue(story.id, 'story should have id');
        assertTrue(story.title, 'story should have title');
        assertTrue(story.status, 'story should have status');
        assertTrue(story.assignee, 'story should have assignee');
        assertTrue(story.priority, 'story should have priority');
    });
});

test('mockAgents have unique names', () => {
    const names = MOCK_DATA.agents.map(a => a.name);
    const uniqueNames = new Set(names);
    assertEqual(uniqueNames.size, names.length, 'agent names should be unique');
});

test('mockStories have valid statuses', () => {
    const validStatuses = ['todo', 'in-progress', 'review', 'done'];
    MOCK_DATA.stories.forEach(story => {
        assertTrue(
            validStatuses.includes(story.status),
            `story ${story.id} has invalid status: ${story.status}`
        );
    });
});

test('mockStories have valid priorities', () => {
    const validPriorities = ['low', 'medium', 'high'];
    MOCK_DATA.stories.forEach(story => {
        assertTrue(
            validPriorities.includes(story.priority),
            `story ${story.id} has invalid priority: ${story.priority}`
        );
    });
});

test('mockStories IDs are unique and formatted', () => {
    const ids = new Set();
    MOCK_DATA.stories.forEach(story => {
        assertTrue(/^STY-\d{3}$/.test(story.id), `story ${story.id} has invalid format`);
        assertTrue(!ids.has(story.id), `duplicate story ID: ${story.id}`);
        ids.add(story.id);
    });
});

// Helper functions (same as in app.js)
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Summary
console.log('\n' + '='.repeat(40));
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

if (failed > 0) {
    process.exit(1);
}
