const test = require('node:test');
const assert = require('node:assert/strict');

const {
    GAMES,
    makeControlKeys,
    nextKeyFor,
    cellRectsFromGrid
} = require('./arcade-shared');

test('all planned arcade games are configured with actions and first playable level', () => {
    const expected = ['breakout', 'invaders', 'pinball', 'mario', 'qwertzman', 'qwertzoids', 'frogqwertz'];

    expected.forEach(gameId => {
        const config = GAMES[gameId];
        assert.ok(config, gameId + ' config exists');
        assert.ok(config.actions.length >= 2, gameId + ' has keyboard actions');
        assert.equal(config.usesLevels, true, gameId + ' enables custom level flow');
        const game = config.create(null);
        assert.ok(game && typeof game === 'object', gameId + ' creates built-in level state');
    });
});

test('initial control keys are unique for each game', () => {
    Object.values(GAMES).forEach(config => {
        const keys = makeControlKeys(config.actions);
        assert.equal(Object.keys(keys).length, config.actions.length);
        assert.equal(new Set(Object.values(keys)).size, config.actions.length, config.id + ' control keys are unique');
    });
});

test('key changes avoid the current key and occupied control keys', () => {
    const action = { id: 'left', pool: 'left' };
    const next = nextKeyFor(action, 'q', new Set(['w', 'e']), 0);

    assert.notEqual(next, 'q');
    assert.notEqual(next, 'w');
    assert.notEqual(next, 'e');
});

test('custom level grid converts active cells to canvas rectangles', () => {
    const grid = Array(14 * 14).fill(false);
    grid[0] = true;
    grid[15] = true;

    const rects = cellRectsFromGrid(grid, 14, 14);

    assert.equal(rects.length, 2);
    assert.equal(rects[0].x, 0);
    assert.equal(rects[0].y, 0);
    assert.ok(rects[1].x > 0);
    assert.ok(rects[1].y > 0);
});

test('frogqwertz river logs are aligned to reachable hop rows', () => {
    const game = GAMES.frogqwertz.create(null);
    const reachableRows = new Set();
    for (let y = game.frog.y; y >= 0; y -= 28) {
        reachableRows.add(y);
    }

    game.logs.forEach(log => {
        assert.ok(reachableRows.has(log.y), 'log row ' + log.y + ' is reachable by frog hops');
    });
});

test('frogqwertz built-in logs are reachable from the starting column', () => {
    const game = GAMES.frogqwertz.create(null);
    const frogCenter = game.frog.x + game.frog.w / 2;

    game.logs.forEach(log => {
        assert.ok(log.x <= frogCenter && log.x + log.w >= frogCenter, 'log at y ' + log.y + ' covers starting column');
    });
});
