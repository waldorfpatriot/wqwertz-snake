const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function renderMenu(learningPage) {
    const sidebar = { innerHTML: '', classList: { add() {} } };
    const context = vm.createContext({
        document: {
            readyState: 'complete',
            getElementById(id) {
                if (id === 'app-menu') return sidebar;
                if (id === 'learningStartButton' && learningPage) return {};
                return null;
            },
            querySelector() { return null; }
        }
    });
    // Run the browser's real renderer; omitting the header skips unrelated layout setup.
    vm.runInContext(fs.readFileSync(require.resolve('./menu.js'), 'utf8'), context);
    return sidebar.innerHTML;
}

test('the games submenu retains six games and hides the four excluded games', () => {
    for (const learningPage of [true, false]) {
        const html = renderMenu(learningPage);
        const submenu = html.match(/>qwertzpiele<\/button>\s*<ul class="sidebar-sub">([\s\S]*?)<\/ul>/);
        assert.ok(submenu, 'The games submenu should still be present');
        const links = Array.from(submenu[1].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g), match => [match[1], match[2]]);
        assert.deepEqual(links, [
            ['index.html', 'qwertznake'],
            ['tetris.html', 'qwertzris'],
            ['pong.html', 'qwertzPong'],
            ['breakout.html', 'qwertz breaker'],
            ['qwertzman.html', 'qwertz man'],
            ['frogqwertz.html', 'frogqwertz']
        ]);
        for (const excluded of ['mario.html', 'pinball.html', 'invaders.html', 'qwertzoids.html']) {
            assert.ok(!html.includes(`href="${excluded}"`), `${excluded} should be hidden from the sidebar`);
        }
    }
});

test('hiding games preserves the learning, help, results, settings and support navigation', () => {
    for (const learningPage of [true, false]) {
        const html = renderMenu(learningPage);
        for (const href of ['#bestenliste', 'analytics.html', '#einstellungen', '/support', '/privacy', '#admin']) {
            assert.ok(html.includes(`href="${href}"`), `${href} should remain in the sidebar`);
        }
        for (let step = 1; step <= 6; step++) {
            assert.ok(html.includes(`href="#tutorial-step-${step}"`));
        }
        const prefix = learningPage ? '' : 'index.html';
        assert.ok(html.includes(`href="${prefix}#lernen"`));
        assert.ok(html.includes(`href="${prefix}#lern-bestenliste"`));
        for (const action of ['stats', 'settings', 'tutorial', 'admin']) {
            assert.ok(html.includes(`data-action="${action}"`));
        }
        if (learningPage) {
            assert.ok(html.includes('data-action="learning"'));
            assert.ok(html.includes('data-action="learning-leaderboard"'));
        }
    }
});
