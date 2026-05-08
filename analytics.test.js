const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildAnalyticsResponse,
    normalizeStatisticsRecord,
    normalizeLevelPayload,
    levelsWithGridSize,
    isValidAdminPassword,
    LEVEL_GRID_SIZE,
    MAX_LEVEL_BARRIERS
} = require('./server');

test('analytics normalizes legacy records without game or source fields', () => {
    const normalized = normalizeStatisticsRecord({
        id: 1,
        timestamp: '2026-01-01T10:00:00.000Z',
        name: 'Player',
        points: 12,
        kpm: 24,
        duration: 120
    }, 0);

    assert.equal(normalized.game, 'qwertZnake');
    assert.equal(normalized.source, 'legacy-statistics.json');
    assert.equal(normalized.durationSeconds, 120);
    assert.equal(normalized.date, '2026-01-01');
});

test('analytics infers tetris records from lines while preserving explicit source/game', () => {
    const analytics = buildAnalyticsResponse({
        games: [
            {
                id: 1,
                timestamp: '2026-01-01T10:00:00.000Z',
                name: 'A',
                points: 10,
                kpm: 20,
                duration: 120
            },
            {
                id: 2,
                timestamp: '2026-01-02T10:00:00.000Z',
                name: 'B',
                points: 30,
                kpm: 40,
                duration: 60,
                lines: 3
            },
            {
                id: 3,
                timestamp: '2026-01-02T11:00:00.000Z',
                name: 'C',
                points: 20,
                kpm: 50,
                accuracy: 95,
                wpm: 12,
                duration: 30,
                game: 'custom-game',
                source: 'lab'
            }
        ]
    });

    assert.equal(analytics.totals.sessions, 3);
    assert.equal(analytics.totals.durationSeconds, 210);
    assert.equal(analytics.totals.bestPoints, 30);
    assert.equal(analytics.totals.averageKpm, 36.7);
    assert.equal(analytics.byGame.find(row => row.game === 'qwertzis').sessions, 1);
    assert.equal(analytics.bySourceGame.find(row => row.game === 'custom-game').source, 'lab');
    assert.equal(analytics.series.overall.length, 2);
    assert.equal(analytics.series.byGame.qwertZnake[0].date, '2026-01-01');
});

test('analytics tolerates malformed or empty statistics payloads', () => {
    const analytics = buildAnalyticsResponse({});

    assert.equal(analytics.totals.sessions, 0);
    assert.deepEqual(analytics.byGame, []);
    assert.deepEqual(analytics.records, []);
});

test('analytics password check uses the configured admin password', () => {
    assert.equal(isValidAdminPassword('Znake'), true);
    assert.equal(isValidAdminPassword('wrong'), false);
    assert.equal(isValidAdminPassword(undefined), false);
});

test('level payload validation accepts the 40x40 editor grid', () => {
    const normalized = normalizeLevelPayload({
        name: 'Randtest',
        gridSize: 'big',
        barriers: [{ x: LEVEL_GRID_SIZE - 1, y: LEVEL_GRID_SIZE - 1 }]
    });

    assert.deepEqual(normalized.level.barriers, [{ x: 39, y: 39 }]);
    assert.equal(normalized.level.gridSize, 'big');
});

test('level payload validation rejects cells outside the editor grid', () => {
    const normalized = normalizeLevelPayload({
        name: 'Zu weit',
        gridSize: 'big',
        barriers: [{ x: LEVEL_GRID_SIZE, y: 0 }]
    });

    assert.equal(normalized.error, 'Invalid barrier coordinates');
});

test('level payload validation rejects non-finite coordinates', () => {
    const normalized = normalizeLevelPayload({
        name: 'Kaputt',
        gridSize: 'big',
        barriers: [{ x: NaN, y: 0 }]
    });

    assert.equal(normalized.error, 'Invalid barrier coordinates');
});

test('level payload validation scopes coordinates to the selected grid size', () => {
    const valid = normalizeLevelPayload({
        name: 'Mittel',
        gridSize: 'medium',
        barriers: [{ x: 29, y: 29 }]
    });
    const invalid = normalizeLevelPayload({
        name: 'Mittel',
        gridSize: 'medium',
        barriers: [{ x: 30, y: 0 }]
    });

    assert.equal(valid.level.gridSize, 'medium');
    assert.deepEqual(valid.level.barriers, [{ x: 29, y: 29 }]);
    assert.equal(invalid.error, 'Invalid barrier coordinates');
});

test('levels without a grid size are treated as big legacy levels', () => {
    const levels = levelsWithGridSize({
        levels: [{ id: 1, name: 'Alt', barriers: [] }]
    });

    assert.equal(levels[0].gridSize, 'big');
});

test('level payload validation rejects unknown grid sizes', () => {
    const normalized = normalizeLevelPayload({
        name: 'Falsch',
        gridSize: 'tiny',
        barriers: [{ x: 0, y: 0 }]
    });

    assert.equal(normalized.error, 'Invalid grid size');
});

test('level payload validation allows a fully blocked editor grid', () => {
    const barriers = Array.from({ length: MAX_LEVEL_BARRIERS }, (_, index) => ({
        x: index % LEVEL_GRID_SIZE,
        y: Math.floor(index / LEVEL_GRID_SIZE)
    }));

    const normalized = normalizeLevelPayload({
        name: 'Voll',
        barriers
    });

    assert.equal(normalized.level.barriers.length, MAX_LEVEL_BARRIERS);
});
