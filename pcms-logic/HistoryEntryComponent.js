// HistoryEntryComponent.js - Read-only History Entry Display

class HistoryEntryComponent {
    constructor(entry, app) {
        this.entry = entry;
        this.app = app;
        this.isExpanded = false;
        this.showPcmsCode = false;
    }

    render() {
        const card = document.createElement('div');
        card.className = 'history-entry';
        card.setAttribute('data-entry-id', this.entry.id);

        const timestamp = new Date(this.entry.timestamp);
        const formattedDate = timestamp.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const formattedTime = timestamp.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const restoredBadge = this.entry.restoredFrom
            ? `<span class="history-badge restored">Restored from: ${this.entry.restoredFrom}</span>`
            : '';

        card.innerHTML = `
            <div class="history-entry-header">
                <div class="history-entry-meta">
                    <div class="history-entry-timestamp">
                        <span class="history-date">${formattedDate}</span>
                        <span class="history-time">${formattedTime}</span>
                    </div>
                    ${this.entry.name ? `<span class="history-entry-name">${this.entry.name}</span>` : ''}
                    ${restoredBadge}
                    ${this.entry.notes ? `<span class="history-entry-notes-inline">${this.entry.notes}</span>` : ''}
                </div>
                <div class="history-entry-summary">
                    <span class="history-summary-item"><strong>${this.entry.sensors.length}</strong> sensor${this.entry.sensors.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="history-entry-actions">
                    <button class="btn-icon-small toggle-details" title="Toggle Details">
                        <svg class="chevron-icon" xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
                            <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/>
                        </svg>
                    </button>
                    <button class="btn-restore" title="Restore this configuration">
                        <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                            <path d="M480-120q-138 0-240.5-91.5T122-440h82q14 104 92.5 172T480-200q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h110v80H120v-240h80v94q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Z"/>
                        </svg>
                        Restore
                    </button>
                </div>
            </div>

            <div class="history-entry-details hidden">
                <div class="history-section">
                    <h4>Associated Sensors</h4>
                    <div class="history-pills">
                        ${this.renderSensorPills()}
                    </div>
                </div>

                <div class="history-section">
                    <h4>Rules</h4>
                    <div class="history-rules-list">
                        ${this.renderRules()}
                    </div>
                </div>

                <div class="history-section">
                    <div class="history-section-header">
                        <h4>PCMS Code</h4>
                        <button class="btn-text toggle-pcms-code">Show Code</button>
                    </div>
                    <div class="history-pcms-code hidden">
                        <pre>${this.entry.pcmsCode || 'No code generated'}</pre>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners(card);
        return card;
    }

    renderSensorPills() {
        if (!this.entry.sensors || this.entry.sensors.length === 0) {
            return '<span class="no-data">No sensors associated</span>';
        }

        return this.entry.sensors.map(sensor => {
            return `<span class="pill pill-sensor">${sensor.name}</span>`;
        }).join('');
    }

    renderRules() {
        if (!this.entry.rules || this.entry.rules.length === 0) {
            return '<div class="no-data">No rules configured</div>';
        }

        return this.entry.rules.map((rule, index) => {
            const metric = this.app.data.metrics.find(m => m.id == rule.metric);
            const sensor = this.app.data.sensors.find(s => s.id == rule.sensor);

            const metricName = metric ? metric.name : 'Unknown Metric';
            const sensorName = this.getDisplaySensorName(rule, metric, sensor);
            const conditionText = rule.operator === 'less' ? 'less than' : 'greater than';
            const unitText = this.getUnitText(metric);
            const screen1Text = rule.screen1.filter(l => l).join(' | ') || '-';
            const displayText = rule.sameAsScreen1
                ? screen1Text
                : `${screen1Text} → ${rule.screen2.filter(l => l).join(' | ') || '-'}`;

            if (this.app.showThresholdFirst) {
                return `
                    <div class="view-logic-item">
                        <span class="view-logic-number">#${index + 1}</span>
                        <span class="pill ${this.getThresholdClass(rule.threshold)}">${rule.threshold} ${unitText}</span>
                        <span class="pill pill-metric">${metricName}</span>
                        <span class="pill pill-sensor">${sensorName}</span>
                        <span class="view-logic-text">→</span>
                        <span class="view-logic-display-content">${displayText}</span>
                    </div>
                `;
            }

            return `
                <div class="view-logic-item">
                    <span class="view-logic-number">#${index + 1}</span>
                    <span class="view-logic-text">If</span>
                    <span class="pill pill-metric">${metricName}</span>
                    <span class="pill pill-sensor">${sensorName}</span>
                    <span class="view-logic-text">is ${conditionText}</span>
                    <span class="pill ${this.getThresholdClass(rule.threshold)}">${rule.threshold} ${unitText}</span>
                    <span class="view-logic-text">then</span>
                    <span class="view-logic-display-content">${displayText}</span>
                </div>
            `;
        }).join('');
    }

    getDisplaySensorName(rule, metric, sensor) {
        if (metric && (metric.value.includes('_any') || metric.value.includes('_all'))) {
            return metric.value.includes('_any') ? 'Any Sensor' : 'All Sensors';
        }
        return sensor ? sensor.name : 'Unknown Sensor';
    }

    getUnitText(metric) {
        if (!metric) return '';
        if (metric.value.includes('speed')) return 'MPH';
        if (metric.value.includes('travel_time')) return 'minutes';
        return 'vehicles/minute';
    }

    getThresholdClass(threshold) {
        const value = parseInt(threshold);
        if (isNaN(value)) return 'pill-condition';
        if (value <= 30) return 'pill-threshold-stopped';
        if (value <= 55) return 'pill-threshold-slow';
        return 'pill-threshold-freeflow';
    }

    attachEventListeners(card) {
        // Toggle details
        const toggleBtn = card.querySelector('.toggle-details');
        const details = card.querySelector('.history-entry-details');
        const chevron = card.querySelector('.chevron-icon');

        toggleBtn.addEventListener('click', () => {
            this.isExpanded = !this.isExpanded;
            details.classList.toggle('hidden', !this.isExpanded);
            chevron.style.transform = this.isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        // Toggle PCMS code
        const toggleCodeBtn = card.querySelector('.toggle-pcms-code');
        const codeSection = card.querySelector('.history-pcms-code');

        toggleCodeBtn.addEventListener('click', () => {
            this.showPcmsCode = !this.showPcmsCode;
            codeSection.classList.toggle('hidden', !this.showPcmsCode);
            toggleCodeBtn.textContent = this.showPcmsCode ? 'Hide Code' : 'Show Code';
        });

        // Restore button
        const restoreBtn = card.querySelector('.btn-restore');
        restoreBtn.addEventListener('click', () => {
            if (confirm('Restore this configuration? This will replace your current rules.')) {
                this.app.restoreFromHistory(this.entry);
            }
        });
    }
}
