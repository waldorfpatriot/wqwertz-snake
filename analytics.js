(function () {
    const PASSWORD_STORAGE_KEY = 'qwertz_analytics_password';
    const COLORS = ['#287d68', '#2b6cb0', '#b54b4b', '#b17819', '#5b5f97', '#65743a'];
    const KPI_LABELS = {
        sessions: 'Sessions',
        durationMinutes: 'Time spent',
        averagePoints: 'Avg points',
        bestPoints: 'Best points',
        averageKpm: 'Avg T/min',
        averageAccuracy: 'Avg accuracy',
        averageWpm: 'Avg WPM'
    };

    const state = {
        analytics: null,
        loading: false,
        password: ''
    };

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatNumber(value) {
        if (value == null || Number.isNaN(Number(value))) return '-';
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
    }

    function formatPercent(value) {
        return value == null ? '-' : formatNumber(value) + '%';
    }

    function formatDuration(seconds) {
        const safeSeconds = Math.max(0, Number(seconds) || 0);
        if (safeSeconds < 60) return Math.round(safeSeconds) + 's';
        const minutes = safeSeconds / 60;
        if (minutes < 60) return formatNumber(minutes) + 'm';
        const hours = minutes / 60;
        return formatNumber(hours) + 'h';
    }

    function formatDateTime(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function valueForKpi(point, kpi) {
        const value = point ? point[kpi] : null;
        return value == null ? null : Number(value);
    }

    function kpiValue(data, key) {
        const totals = data.totals || {};
        if (key === 'time') return formatDuration(totals.durationSeconds);
        if (key === 'accuracy') return formatPercent(totals.averageAccuracy);
        return formatNumber(totals[key]);
    }

    function renderKpis(data) {
        const cards = [
            ['Sessions', kpiValue(data, 'sessions')],
            ['Time spent', kpiValue(data, 'time')],
            ['Best points', kpiValue(data, 'bestPoints')],
            ['Avg points', kpiValue(data, 'averagePoints')],
            ['Avg T/min', kpiValue(data, 'averageKpm')],
            ['Avg accuracy', kpiValue(data, 'accuracy')]
        ];

        $('kpiCards').innerHTML = cards.map(function (card) {
            return '<article class="card"><div class="label">' + escapeHtml(card[0]) + '</div><div class="value">' + escapeHtml(card[1]) + '</div></article>';
        }).join('');
    }

    function renderSourceGameTable(data) {
        const rows = data.bySourceGame || [];
        if (!rows.length) {
            $('sourceGameRows').innerHTML = '<tr><td colspan="7" class="empty">No statistics yet.</td></tr>';
            return;
        }

        $('sourceGameRows').innerHTML = rows.map(function (row) {
            return '<tr>' +
                '<td>' + escapeHtml(row.game || '-') + '</td>' +
                '<td>' + escapeHtml(row.source || '-') + '</td>' +
                '<td>' + formatNumber(row.sessions) + '</td>' +
                '<td>' + formatDuration(row.durationSeconds) + '</td>' +
                '<td>' + formatNumber(row.bestPoints) + '</td>' +
                '<td>' + formatNumber(row.averageKpm) + '</td>' +
                '<td>' + formatPercent(row.averageAccuracy) + '</td>' +
            '</tr>';
        }).join('');
    }

    function renderRecentTable(data) {
        const rows = data.records || [];
        if (!rows.length) {
            $('recentRows').innerHTML = '<tr><td colspan="9" class="empty">No sessions have been recorded.</td></tr>';
            return;
        }

        $('recentRows').innerHTML = rows.slice(0, 80).map(function (row) {
            return '<tr>' +
                '<td>' + escapeHtml(formatDateTime(row.timestamp)) + '</td>' +
                '<td>' + escapeHtml(row.player) + '</td>' +
                '<td>' + escapeHtml(row.game) + '</td>' +
                '<td>' + escapeHtml(row.source) + '</td>' +
                '<td>' + formatNumber(row.points) + '</td>' +
                '<td>' + formatDuration(row.durationSeconds) + '</td>' +
                '<td>' + formatNumber(row.kpm) + '</td>' +
                '<td>' + formatPercent(row.accuracy) + '</td>' +
                '<td>' + formatNumber(row.wpm) + '</td>' +
            '</tr>';
        }).join('');
    }

    function resizeCanvas(canvas) {
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width * ratio));
        canvas.height = Math.max(1, Math.floor(rect.height * ratio));
        const ctx = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { ctx: ctx, width: rect.width, height: rect.height };
    }

    function buildSeries(data, mode, kpi) {
        if (!data || !data.series) return [];
        if (mode === 'overall') {
            return [{
                name: 'Overall',
                color: COLORS[0],
                points: (data.series.overall || []).map(function (point) {
                    return { date: point.date, value: valueForKpi(point, kpi) };
                }).filter(function (point) { return point.value != null; })
            }];
        }

        return Object.keys(data.series.byGame || {}).sort().map(function (game, index) {
            return {
                name: game,
                color: COLORS[index % COLORS.length],
                points: data.series.byGame[game].map(function (point) {
                    return { date: point.date, value: valueForKpi(point, kpi) };
                }).filter(function (point) { return point.value != null; })
            };
        }).filter(function (series) {
            return series.points.length > 0;
        });
    }

    function drawLegend(container, series) {
        container.innerHTML = series.map(function (item) {
            return '<span><i class="swatch" style="background:' + item.color + '"></i>' + escapeHtml(item.name) + '</span>';
        }).join('');
    }

    function drawLineChart(canvas, legend, series, options) {
        const size = resizeCanvas(canvas);
        const ctx = size.ctx;
        const width = size.width;
        const height = size.height;
        const padding = { top: 18, right: 18, bottom: 36, left: 54 };
        const chartWidth = Math.max(1, width - padding.left - padding.right);
        const chartHeight = Math.max(1, height - padding.top - padding.bottom);
        const allPoints = series.flatMap(function (item) { return item.points; });

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        drawLegend(legend, series);

        if (!allPoints.length) {
            ctx.fillStyle = '#687586';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data for this chart yet.', width / 2, height / 2);
            return;
        }

        const dates = Array.from(new Set(allPoints.map(function (point) { return point.date; }))).sort();
        const values = allPoints.map(function (point) { return point.value; });
        const maxValue = Math.max.apply(null, values.concat([1]));
        const minValue = Math.min.apply(null, values.concat([0]));
        const range = Math.max(1, maxValue - minValue);

        function xFor(date) {
            const index = dates.indexOf(date);
            if (dates.length === 1) return padding.left + chartWidth / 2;
            return padding.left + (index / (dates.length - 1)) * chartWidth;
        }

        function yFor(value) {
            return padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
        }

        ctx.strokeStyle = '#d9ded7';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#687586';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight / 4) * i;
            const value = maxValue - (range / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            ctx.fillText(formatNumber(value), padding.left - 8, y);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const dateStep = Math.max(1, Math.ceil(dates.length / 5));
        dates.forEach(function (date, index) {
            if (index % dateStep !== 0 && index !== dates.length - 1) return;
            ctx.fillText(date === 'unknown' ? 'unknown' : date.substring(5), xFor(date), height - padding.bottom + 14);
        });

        series.forEach(function (item) {
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            item.points.forEach(function (point, index) {
                const x = xFor(point.date);
                const y = yFor(point.value);
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            ctx.fillStyle = item.color;
            item.points.forEach(function (point) {
                const x = xFor(point.date);
                const y = yFor(point.value);
                ctx.beginPath();
                ctx.arc(x, y, options && options.smallPoints ? 3 : 4, 0, Math.PI * 2);
                ctx.fill();
            });
        });
    }

    function renderCharts() {
        const data = state.analytics;
        if (!data) return;

        const kpi = $('kpiSelect').value;
        const mode = $('seriesMode').value;
        const title = KPI_LABELS[kpi] || kpi;
        $('primaryChartTitle').textContent = title + ' over time';

        const primarySeries = buildSeries(data, mode, kpi);
        const durationSeries = buildSeries(data, mode, 'durationMinutes');
        drawLineChart($('primaryChart'), $('primaryLegend'), primarySeries, {});
        drawLineChart($('durationChart'), $('durationLegend'), durationSeries, { smallPoints: true });
    }

    function render(data) {
        renderKpis(data);
        renderSourceGameTable(data);
        renderRecentTable(data);
        renderCharts();
    }

    function setLocked(locked, message) {
        $('authPanel').classList.toggle('hidden', !locked);
        $('analyticsContent').classList.toggle('hidden', locked);
        $('authError').textContent = message || '';
        if (locked) {
            const input = $('analyticsPassword');
            input.value = '';
            input.focus();
        }
    }

    function clearStoredPassword(message) {
        state.password = '';
        sessionStorage.removeItem(PASSWORD_STORAGE_KEY);
        setLocked(true, message || '');
    }

    async function verifyPassword(password) {
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        });
        if (!response.ok) return false;
        const result = await response.json();
        return Boolean(result.valid);
    }

    async function unlock(password) {
        $('authError').textContent = 'Checking password...';
        const valid = await verifyPassword(password);
        if (!valid) {
            clearStoredPassword('Wrong password.');
            return;
        }

        state.password = password;
        sessionStorage.setItem(PASSWORD_STORAGE_KEY, password);
        setLocked(false);
        await loadAnalytics();
    }

    async function loadAnalytics() {
        if (state.loading) return;
        if (!state.password) {
            clearStoredPassword();
            return;
        }
        state.loading = true;
        $('status').textContent = 'Loading analytics...';
        try {
            const response = await fetch('/api/analytics', {
                headers: {
                    Accept: 'application/json',
                    'X-Admin-Password': state.password
                }
            });
            if (response.status === 401) {
                clearStoredPassword('Session locked. Enter the admin password again.');
                return;
            }
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const data = await response.json();
            state.analytics = data;
            $('status').textContent = 'Generated ' + formatDateTime(data.generatedAt) + ' from ' + formatNumber((data.records || []).length) + ' latest rows.';
            render(data);
        } catch (error) {
            $('status').textContent = 'Could not load analytics: ' + error.message;
        } finally {
            state.loading = false;
        }
    }

    function init() {
        $('authForm').addEventListener('submit', function (event) {
            event.preventDefault();
            const password = $('analyticsPassword').value;
            unlock(password).catch(function () {
                clearStoredPassword('Could not verify password.');
            });
        });
        $('logoutButton').addEventListener('click', function () {
            clearStoredPassword('Locked.');
        });
        $('refreshButton').addEventListener('click', loadAnalytics);
        $('kpiSelect').addEventListener('change', renderCharts);
        $('seriesMode').addEventListener('change', renderCharts);
        window.addEventListener('resize', function () {
            window.clearTimeout(init.resizeTimer);
            init.resizeTimer = window.setTimeout(renderCharts, 100);
        });

        state.password = sessionStorage.getItem(PASSWORD_STORAGE_KEY) || '';
        if (state.password) {
            setLocked(false);
            loadAnalytics();
        } else {
            setLocked(true);
        }
    }

    if (typeof window !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }
})();
