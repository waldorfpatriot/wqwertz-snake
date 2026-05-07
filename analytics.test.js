const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildAnalyticsResponse,
    normalizeStatisticsRecord
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
