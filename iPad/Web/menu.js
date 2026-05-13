/**
 * Shared navigation menu for qwertz games.
 * Renders once: sidebar on wide screens, burger + overlay on narrow.
 * Dispatches custom events for page-specific handlers (stats, admin, restart, tutorial).
 */
(function () {
    const MENU_BREAKPOINT = 900;
    const SIDEBAR_ID = 'app-menu';
    const BURGER_ID = 'menuBurger';
    const SIDEBAR_OVERLAY_CLASS = 'sidebar-overlay-open';
    const BACKDROP_ID = 'sidebarBackdrop';

    function buildMenuHTML() {
        return `
<button type="button" class="sidebar-close" id="sidebarClose" aria-label="Menü schließen">&times;</button>
<ul class="sidebar-nav">
  <li><a href="#bestenliste" class="menu-item menu-link menu-action" data-action="stats">Bestenliste</a></li>
  <li><a href="analytics.html" class="menu-item menu-link">Analytics</a></li>
  <li><a href="#einstellungen" class="menu-item menu-link menu-action" data-action="settings">Einstellungen</a></li>
  <li>
    <button type="button" class="menu-item menu-item-with-sub" data-action="tutorial" aria-expanded="false">Hilfe</button>
    <ul class="sidebar-sub">
      <li><a href="#tutorial-step-1" class="menu-item sub menu-link">Warum dieses Spiel?</a></li>
      <li><a href="#tutorial-step-2" class="menu-item sub menu-link">Spielprinzip</a></li>
      <li><a href="#tutorial-step-3" class="menu-item sub menu-link">Fingerplatzierung und Grundreihe</a></li>
      <li><a href="#tutorial-step-4" class="menu-item sub menu-link">Fingerzuordnung</a></li>
      <li><a href="#tutorial-step-5" class="menu-item sub menu-link">Farbcodierung</a></li>
      <li><a href="#tutorial-step-6" class="menu-item sub menu-link">Die Benutzeroberfläche</a></li>
    </ul>
  </li>
  <li>
    <button type="button" class="menu-item menu-item-with-sub" aria-expanded="false">qwertzpiele</button>
    <ul class="sidebar-sub">
      <li><a href="index.html" class="menu-item sub menu-link">qwertznake</a></li>
      <li><a href="tetris.html" class="menu-item sub menu-link">qwertzris</a></li>
      <li><a href="pong.html" class="menu-item sub menu-link">qwertzPong</a></li>
      <li><a href="breakout.html" class="menu-item sub menu-link">qwertz breaker</a></li>
      <li><a href="invaders.html" class="menu-item sub menu-link">qwertz invaders</a></li>
      <li><a href="pinball.html" class="menu-item sub menu-link">qwertz pinball</a></li>
      <li><a href="mario.html" class="menu-item sub menu-link">qwertz plummer</a></li>
      <li><a href="qwertzman.html" class="menu-item sub menu-link">qwertz man</a></li>
      <li><a href="qwertzoids.html" class="menu-item sub menu-link">qwertzoids</a></li>
      <li><a href="frogqwertz.html" class="menu-item sub menu-link">frogqwertz</a></li>
    </ul>
  </li>
  <li><a href="#admin" class="menu-item menu-link menu-action" data-action="admin">Admin</a></li>
</ul>
`;
    }

    function dispatch(name, detail) {
        document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }

    function isWide() {
        return window.matchMedia('(min-width: ' + MENU_BREAKPOINT + 'px)').matches;
    }

    function init() {
        var sidebar = document.getElementById(SIDEBAR_ID);
        if (!sidebar) return;

        sidebar.classList.add('sidebar');
        sidebar.innerHTML = buildMenuHTML();

        var header = document.querySelector('.container header');
        if (!header) return;

        var burger = document.createElement('button');
        burger.type = 'button';
        burger.className = 'menu-burger';
        burger.id = BURGER_ID;
        burger.setAttribute('aria-label', 'Menü öffnen');
        burger.innerHTML = '<span></span><span></span><span></span>';
        header.insertBefore(burger, header.firstChild);

        var closeBtn = sidebar.querySelector('#sidebarClose');
        var nav = sidebar.querySelector('.sidebar-nav');

        function closeOverlay() {
            document.body.classList.remove(SIDEBAR_OVERLAY_CLASS);
            var b = document.getElementById(BACKDROP_ID);
            if (b) b.remove();
        }

        function openOverlay() {
            document.body.classList.add(SIDEBAR_OVERLAY_CLASS);
            var b = document.getElementById(BACKDROP_ID);
            if (!b) {
                b = document.createElement('div');
                b.id = BACKDROP_ID;
                b.className = 'sidebar-backdrop';
                b.setAttribute('aria-hidden', 'true');
                document.body.appendChild(b);
                b.addEventListener('click', closeOverlay);
            }
        }

        function toggleOverlay() {
            if (document.body.classList.contains(SIDEBAR_OVERLAY_CLASS)) {
                closeOverlay();
            } else {
                openOverlay();
            }
        }

        burger.addEventListener('click', function () {
            toggleOverlay();
        });
        if (closeBtn) {
            closeBtn.addEventListener('click', closeOverlay);
        }

        nav.addEventListener('click', function (e) {
            var item = e.target.closest('.menu-item');
            if (!item || item.classList.contains('disabled')) return;
            if (item.classList.contains('menu-link') && !item.classList.contains('menu-action')) return;
            /* Don’t close overlay when only expanding/collapsing a submenu */
            if (item.classList.contains('menu-item-with-sub')) return;

            var action = item.getAttribute('data-action');
            var step = item.getAttribute('data-step');

            if (action === 'stats' || action === 'admin' || action === 'settings') {
                closeOverlay();
                return;
            }
            if (item.classList.contains('menu-action')) {
                e.preventDefault();
            }
        });

        nav.querySelectorAll('.menu-item-with-sub').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                if (e.target.closest('.menu-link')) return;
                var sub = this.nextElementSibling;
                if (sub && sub.classList.contains('sidebar-sub')) {
                    sub.classList.toggle('open');
                    this.setAttribute('aria-expanded', sub.classList.contains('open'));
                }
            });
        });

        window.addEventListener('resize', function () {
            if (isWide()) {
                closeOverlay();
            }
        });

        window.addEventListener('hashchange', function () {
            var h = window.location.hash.substring(1);
            if (h === 'bestenliste' || h === 'einstellungen' || h === 'admin' || h.indexOf('tutorial-step-') === 0) closeOverlay();
        });

        initViewportFitter();
    }

    function initViewportFitter() {
        var container = document.querySelector('.container');
        var canvas = document.getElementById('gameCanvas');
        var keyboard = document.querySelector('.keyboard-section');
        var virtualKeyboard = keyboard ? keyboard.querySelector('.virtual-keyboard') : null;
        if (!container || !canvas || !keyboard) return;

        function numberStyle(element, property) {
            var value = parseFloat(window.getComputedStyle(element)[property]);
            return Number.isFinite(value) ? value : 0;
        }

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function outerHeight(element) {
            if (!element) return 0;
            var style = window.getComputedStyle(element);
            if (style.display === 'none' || style.position === 'fixed' || style.position === 'absolute') {
                return 0;
            }
            return element.getBoundingClientRect().height +
                (parseFloat(style.marginTop) || 0) +
                (parseFloat(style.marginBottom) || 0);
        }

        function fitKeyboardWidth() {
            if (!virtualKeyboard) return;

            var keyboardStyle = window.getComputedStyle(virtualKeyboard);
            var horizontalPadding = (parseFloat(keyboardStyle.paddingLeft) || 0) +
                (parseFloat(keyboardStyle.paddingRight) || 0);
            var row = virtualKeyboard.querySelector('.keyboard-row');
            var rowStyle = row ? window.getComputedStyle(row) : null;
            var rowGap = rowStyle ? parseFloat(rowStyle.columnGap || rowStyle.gap) : 4;
            if (!Number.isFinite(rowGap)) rowGap = 4;

            var separator = virtualKeyboard.querySelector('.keyboard-separator');
            var separatorWidth = 6;
            if (separator) {
                var separatorStyle = window.getComputedStyle(separator);
                separatorWidth = separator.getBoundingClientRect().width +
                    (parseFloat(separatorStyle.marginLeft) || 0) +
                    (parseFloat(separatorStyle.marginRight) || 0);
            }

            var defaultKeyWidth = document.body.classList.contains('viewport-fit-tight') ? 22 :
                (document.body.classList.contains('viewport-fit-compact') ? 26 : 32);
            var defaultKeyHeight = document.body.classList.contains('viewport-fit-tight') ? 24 :
                (document.body.classList.contains('viewport-fit-compact') ? 29 : 36);
            var defaultSpaceWidth = document.body.classList.contains('viewport-fit-tight') ? 118 :
                (document.body.classList.contains('viewport-fit-compact') ? 150 : 200);

            var availableWidth = Math.max(0, virtualKeyboard.clientWidth - horizontalPadding);
            var fittedKeyWidth = Math.floor((availableWidth - separatorWidth - (11 * rowGap)) / 11);
            var keyWidth = clamp(fittedKeyWidth, 16, defaultKeyWidth);
            var keyHeight = clamp(Math.round(keyWidth * 1.125), 20, defaultKeyHeight);
            var spaceWidth = clamp(Math.round(keyWidth * 6.25), 96, defaultSpaceWidth);

            virtualKeyboard.style.setProperty('--keyboard-key-width', keyWidth + 'px');
            virtualKeyboard.style.setProperty('--keyboard-key-height', keyHeight + 'px');
            virtualKeyboard.style.setProperty('--keyboard-space-width', spaceWidth + 'px');
        }

        function fit() {
            var viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            var viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
            var isNarrow = viewportWidth < MENU_BREAKPOINT;
            var availablePageHeight = Math.max(320, viewportHeight - (isNarrow ? 12 : 32));

            document.body.classList.toggle('viewport-fit-compact', viewportHeight < 760);
            document.body.classList.toggle('viewport-fit-tight', viewportHeight < 620);
            fitKeyboardWidth();

            container.style.maxHeight = availablePageHeight + 'px';

            var verticalPadding = numberStyle(container, 'paddingTop') + numberStyle(container, 'paddingBottom');
            var nonGameHeight = verticalPadding;
            Array.prototype.forEach.call(container.children, function (child) {
                if (child.classList && child.classList.contains('game-area')) return;
                nonGameHeight += outerHeight(child);
            });

            var gameArea = canvas.closest('.game-area');
            var gameMargins = gameArea ? numberStyle(gameArea, 'marginTop') + numberStyle(gameArea, 'marginBottom') : 0;
            var usableGameHeight = Math.max(130, availablePageHeight - nonGameHeight - gameMargins);
            var availableGameWidth = Math.max(160, (gameArea ? gameArea.clientWidth : container.clientWidth) - 10);
            var aspect = (canvas.width || 1) / (canvas.height || 1);
            var fittedHeight = Math.min(usableGameHeight, availableGameWidth / aspect);
            var fittedWidth = fittedHeight * aspect;

            canvas.style.width = Math.max(120, Math.floor(fittedWidth)) + 'px';
            canvas.style.height = Math.max(120, Math.floor(fittedHeight)) + 'px';
        }

        var fitTimer = 0;
        function scheduleFit() {
            window.clearTimeout(fitTimer);
            fitTimer = window.setTimeout(fit, 40);
        }

        fit();
        window.addEventListener('resize', scheduleFit);
        window.addEventListener('orientationchange', scheduleFit);
        if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFit);
        if (window.ResizeObserver) {
            var observer = new ResizeObserver(scheduleFit);
            observer.observe(container);
            observer.observe(keyboard);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
