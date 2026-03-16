// RuleComponent.js - Accordion-style Rule Component

class RuleComponent {
    constructor(rule, index, app) {
        this.rule = rule;
        this.index = index;
        this.app = app;
        this.isExpanded = !!rule._expanded;
    }

    render() {
        const card = document.createElement('div');
        card.className = 'rule-card' + (this.isExpanded ? ' expanded' : '');
        card.setAttribute('data-rule-id', this.rule.id);

        card.innerHTML = `
            <div class="rule-header" data-action="toggle">
                <div class="rule-summary">
                    ${this.renderSummary()}
                </div>
                <div class="rule-header-actions">
                    <button class="btn-icon-small duplicate-rule" title="Duplicate">
                        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
                            <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
                        </svg>
                    </button>
                    <button class="btn-icon-small delete-rule" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
                            <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
                        </svg>
                    </button>
                    <svg class="rule-chevron" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor" style="transform: rotate(${this.isExpanded ? '180' : '0'}deg)">
                        <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/>
                    </svg>
                </div>
            </div>
            <div class="rule-details${this.isExpanded ? '' : ' collapsed'}">
                <div class="rule-edit-controls">
                    <div class="rule-selectors">
                        <div class="input-group">
                            <label class="input-label">Metric</label>
                            <select class="metric-select compact-select">
                                <option value="">Select...</option>
                                ${this.renderMetricOptions()}
                            </select>
                        </div>
                        <span class="separator sensor-separator" ${this.isAggregateMetric() ? 'style="display:none"' : ''}>at</span>
                        <div class="input-group sensor-input-group" ${this.isAggregateMetric() ? 'style="display:none"' : ''}>
                            <label class="input-label">Sensor</label>
                            ${this.renderSensorInput()}
                        </div>
                        <div class="input-group">
                            <label class="input-label">Condition</label>
                            <select class="operator-select compact-select">
                                ${this.renderOperatorOptions()}
                            </select>
                        </div>
                        <div class="input-group">
                            <label class="input-label">Threshold</label>
                            <div class="threshold-wrapper">
                                <input type="number" class="threshold-input compact-input" placeholder="0" min="0" max="999" value="${this.rule.threshold || ''}">
                                <span class="unit-label"></span>
                            </div>
                        </div>
                    </div>
                    ${this.renderDisplayInputs()}
                </div>
            </div>
        `;

        this.attachEventListeners(card);
        this.updateUnitLabel(card);

        return card;
    }

    renderSummary() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        const sensor = this.app.data.sensors.find(s => s.id == this.rule.sensor);

        const metricName = metric ? metric.name : '<span class="incomplete">Select Metric</span>';
        const sensorName = this.getSensorNameForSummary(metric, sensor);
        const isAggregate = this.isAggregateMetric();
        const sensorPill = isAggregate ? '' : `<span class="pill pill-sensor">${sensorName}</span>`;
        const conditionText = this.rule.operator === 'less' ? 'less than' : 'greater than';
        const unitText = this.getUnitTextFull();
        const thresholdText = this.rule.threshold || '<span class="incomplete">?</span>';

        let displayText;
        if (this.rule.outputType === 'flash') {
            displayText = '<span class="pill pill-flash">Flash</span>';
        } else {
            const pills = this.rule.btPills || { screen1: [null, null, null], screen2: [null, null, null] };
            const formatLine = (text, pill) => {
                if (pill) {
                    const label = this.getPillLabel(pill.sensorId);
                    return `[${label}]${text || ''}`.trim();
                }
                return text || '';
            };
            const s1Lines = this.rule.screen1.map((l, i) => formatLine(l, pills.screen1[i])).filter(l => l);
            const s2Lines = this.rule.screen2.map((l, i) => formatLine(l, pills.screen2[i])).filter(l => l);
            const screen1Text = s1Lines.join(' | ') || '<span class="incomplete">Set display</span>';
            displayText = this.rule.sameAsScreen1
                ? screen1Text
                : `${screen1Text} → ${s2Lines.join(' | ') || '-'}`;
        }

        if (this.app.showThresholdFirst) {
            return `
                <span class="pill ${this.getThresholdClass()}">${thresholdText} ${unitText}</span>
                <span class="pill pill-metric">${metricName}</span>
                ${sensorPill}
                <span class="rule-summary-text">→</span>
                <span class="rule-display-content">${displayText}</span>
            `;
        }

        return `
            <span class="rule-summary-text">If</span>
            <span class="pill pill-metric">${metricName}</span>
            ${sensorPill}
            <span class="rule-summary-text">is ${conditionText}</span>
            <span class="pill ${this.getThresholdClass()}">${thresholdText} ${unitText}</span>
            <span class="rule-summary-text">then</span>
            <span class="rule-display-content">${displayText}</span>
        `;
    }

    getSensorNameForSummary(metric, sensor) {
        if (metric && (metric.value.includes('_any') || metric.value.includes('_all'))) {
            return metric.value.includes('_any') ? 'Any Sensor' : 'All Sensors';
        }
        return sensor ? sensor.name : '<span class="incomplete">Select Sensor</span>';
    }

    getUnitTextFull() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        if (!metric) return '';
        if (metric.value.includes('speed')) return 'MPH';
        if (metric.value.includes('travel_time')) return 'minutes';
        return 'vehicles/minute';
    }

    /** Returns the base metric type, stripping the bt_ prefix */
    getBaseMetricValue() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        if (!metric) return '';
        return metric.value.replace('bt_', '');
    }

    getThresholdClass() {
        const threshold = parseInt(this.rule.threshold);
        if (isNaN(threshold)) return 'pill-condition';
        if (threshold <= 30) return 'pill-threshold-stopped';
        if (threshold <= 55) return 'pill-threshold-slow';
        return 'pill-threshold-freeflow';
    }

    getSensorName() {
        if (this.isAggregateMetric()) {
            return this.getAggregateSensorText();
        }
        const sensor = this.app.data.sensors.find(s => s.id == this.rule.sensor);
        return sensor ? sensor.name : '';
    }

    isBluetoothMetric() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        return metric && metric.value.startsWith('bt_');
    }

    isAggregateMetric() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        return metric && (metric.value.includes('_any') || metric.value.includes('_all'));
    }

    getAggregateSensorText() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        if (!metric) return '';
        if (metric.value.includes('_any')) return 'Any Sensor';
        if (metric.value.includes('_all')) return 'All Sensors';
        return '';
    }

    renderDisplayInputs() {
        if (this.rule.outputType === 'flash') {
            return `
                <div class="rule-display-inputs flash-output">
                    <div class="flash-output-label">
                        <span class="pill pill-flash">Flash</span>
                        <span class="flash-output-text">Web beacon will flash when condition is met</span>
                    </div>
                </div>
            `;
        }

        // Ensure btPills exists (backward compat)
        if (!this.rule.btPills) {
            this.rule.btPills = { screen1: [null, null, null], screen2: [null, null, null] };
        }

        const isBt = this.isBluetoothMetric();

        const renderLineInput = (screen, lineIdx) => {
            const screenKey = `screen${screen}`;
            const pill = this.rule.btPills[screenKey][lineIdx];
            const value = this.rule[screenKey][lineIdx] || '';
            const disabled = (screen === 2 && this.rule.sameAsScreen1) ? 'disabled' : '';

            if (isBt) {
                const pillChip = pill
                    ? `<span class="bt-pill-chip">${this.getPillLabel(pill.sensorId)}<button class="bt-pill-remove" data-screen="${screen}" data-line="${lineIdx + 1}">&times;</button></span>`
                    : '';
                const hasWarning = pill && value.length > 6;

                return `<div class="chip-input-container${hasWarning ? ' bt-char-warning-field' : ''}" data-screen="${screen}" data-line="${lineIdx + 1}">
                    ${pillChip}
                    <input type="text" class="screen-line-inline compact-input" data-screen="${screen}" data-line="${lineIdx + 1}" maxlength="8" placeholder="Line ${lineIdx + 1}" value="${value}" ${disabled}>
                </div>`;
            }
            return `<input type="text" class="screen-line-inline compact-input" data-screen="${screen}" data-line="${lineIdx + 1}" maxlength="8" placeholder="Line ${lineIdx + 1}" value="${value}" ${disabled}>`;
        };

        const pillSource = isBt ? this.renderPillSource() : '';

        // Check if any line has a BT pill + text over 6 chars
        const hasAnyWarning = isBt && [0, 1, 2].some(i =>
            (this.rule.btPills.screen1[i] && (this.rule.screen1[i] || '').length > 6) ||
            (this.rule.btPills.screen2[i] && (this.rule.screen2[i] || '').length > 6)
        );
        const warningHint = hasAnyWarning
            ? `<div class="bt-char-warning-hint">Route values use 2–3 characters of the 8-character limit. Shorten highlighted fields to 6 or fewer, or add another rule.</div>`
            : '';

        return `
            <div class="rule-display-inputs">
                ${pillSource}
                <div class="screen-input-row">
                    <label class="screen-label-inline">Screen 1:</label>
                    ${renderLineInput(1, 0)}
                    ${renderLineInput(1, 1)}
                    ${renderLineInput(1, 2)}
                </div>
                <div class="screen-input-row">
                    <label class="screen-label-inline">Screen 2:</label>
                    ${renderLineInput(2, 0)}
                    ${renderLineInput(2, 1)}
                    ${renderLineInput(2, 2)}
                    <label class="same-screen-checkbox-inline">
                        <input type="checkbox" class="same-as-screen1" ${this.rule.sameAsScreen1 ? 'checked' : ''}>
                        Same as S1
                    </label>
                </div>
                ${warningHint}
            </div>
        `;
    }

    /**
     * Returns a short label for a pill chip given a sensorId.
     * Uses the sensor name from the data.
     */
    getPillLabel(sensorId) {
        const sensor = this.app.data.sensors.find(s => s.id == sensorId);
        return sensor ? sensor.name : '??';
    }

    /**
     * Renders the draggable sensor pills for BT metric rules.
     * Shows all bluetooth route sensors (isBluetooth: true).
     * The value type (speed or travel_time) is determined automatically
     * by the rule's selected metric.
     */
    renderPillSource() {
        const associated = this.app.currentDevice?.associatedSensors || [];
        const btSensors = this.app.data.sensors.filter(s => s.isBluetooth === true && associated.includes(s.id));
        if (btSensors.length === 0) return '';

        const sensorPills = btSensors.map(sensor =>
            `<span class="bt-pill-draggable" draggable="true" data-sensor-id="${sensor.id}">${sensor.name}</span>`
        ).join('');

        return `
            <div class="bt-pills-source">
                <span class="bt-pills-label">Drag to a display line:</span>
                <div class="bt-pills-list">${sensorPills}</div>
            </div>
        `;
    }

    renderMetricOptions() {
        return this.app.data.metrics.map(metric => {
            const selected = this.rule.metric == metric.id ? 'selected' : '';
            return `<option value="${metric.id}" ${selected}>${metric.name}</option>`;
        }).join('');
    }

    renderSensorInput() {
        if (this.isAggregateMetric()) {
            return `<div class="sensor-static-text compact-select">${this.getAggregateSensorText()}</div>`;
        } else {
            return `<select class="sensor-select compact-select">
                        <option value="">Select...</option>
                        ${this.renderSensorOptions()}
                    </select>`;
        }
    }

    renderSensorOptions() {
        if (!this.app.currentDevice) return '';
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        const isBtSpeed = metric && metric.value === 'bt_speed';

        if (isBtSpeed) {
            // Speed + Bluetooth: show ALL sensors assigned to the device (regular + BT)
            const allSensors = this.app.currentDevice.associatedSensors.map(sensorId =>
                this.app.data.sensors.find(s => s.id === sensorId)
            ).filter(Boolean);
            // Also include BT virtual sensors
            const btSensors = this.app.data.sensors.filter(s => s.isBluetooth === true);
            const combined = [...allSensors, ...btSensors.filter(bt => !allSensors.some(a => a.id === bt.id))];
            return combined.map(sensor => {
                const selected = this.rule.sensor == sensor.id ? 'selected' : '';
                return `<option value="${sensor.id}" ${selected}>${sensor.name}</option>`;
            }).join('');
        }

        // Regular metrics use the device's associated sensors (exclude bluetooth)
        return this.app.currentDevice.associatedSensors.map(sensorId => {
            const sensor = this.app.data.sensors.find(s => s.id === sensorId);
            if (!sensor || sensor.isBluetooth) return '';
            const selected = this.rule.sensor == sensor.id ? 'selected' : '';
            return `<option value="${sensor.id}" ${selected}>${sensor.name}</option>`;
        }).join('');
    }

    renderOperatorOptions() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        const baseValue = metric ? metric.value.replace('bt_', '') : '';

        if (metric && baseValue.includes('speed')) {
            return `<option value="less" ${this.rule.operator === 'less' ? 'selected' : ''}>is less than</option>`;
        }
        if (metric && baseValue.includes('travel_time')) {
            return `<option value="greater" ${this.rule.operator === 'greater' ? 'selected' : ''}>is greater than</option>`;
        }
        return `
            <option value="less" ${this.rule.operator === 'less' ? 'selected' : ''}>is less than</option>
            <option value="greater" ${this.rule.operator === 'greater' ? 'selected' : ''}>is greater than</option>
        `;
    }

    attachEventListeners(card) {
        // Toggle expand/collapse
        const header = card.querySelector('.rule-header');
        header.addEventListener('click', (e) => {
            // Don't toggle if clicking on action buttons
            if (e.target.closest('.duplicate-rule') || e.target.closest('.delete-rule')) {
                return;
            }
            this.toggleExpand(card);
        });

        // Duplicate button
        card.querySelector('.duplicate-rule').addEventListener('click', (e) => {
            e.stopPropagation();
            this.app.duplicateRule(this.rule.id);
        });

        // Delete button
        card.querySelector('.delete-rule').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this rule?')) {
                this.app.deleteRule(this.rule.id);
            }
        });

        // Metric change
        card.querySelector('.metric-select').addEventListener('change', (e) => {
            const wasBluetooth = this.isBluetoothMetric();
            this.rule.metric = e.target.value;
            const isBluetooth = this.isBluetoothMetric();
            // Clear sensor when switching between bluetooth and non-bluetooth metrics
            if (wasBluetooth !== isBluetooth) {
                this.rule.sensor = '';
                // Clear pills when leaving BT metrics
                if (!isBluetooth) {
                    this.rule.btPills = { screen1: [null, null, null], screen2: [null, null, null] };
                }
            }
            this.updateUnitLabel(card);
            this.updateOperatorDropdown(card);
            this.updateSensorInput(card);
            // Re-render display inputs to show/hide pill source
            if (wasBluetooth !== isBluetooth) {
                this.reRenderDisplayInputs(card);
            }
            this.updateSummary(card);
            this.app.saveToLocalStorage();
            this.app.updateDevOutput();
            this.app.updateFallbackTabState();
        });

        // Sensor change
        const sensorSelect = card.querySelector('.sensor-select');
        if (sensorSelect) {
            sensorSelect.addEventListener('change', (e) => {
                this.rule.sensor = e.target.value;
                this.updateSummary(card);
                this.app.saveToLocalStorage();
                this.app.updateDevOutput();
            });
        }

        // Operator change
        card.querySelector('.operator-select').addEventListener('change', (e) => {
            this.rule.operator = e.target.value;
            this.updateSummary(card);
            this.app.saveToLocalStorage();
            this.app.updateDevOutput();
        });

        // Threshold change
        card.querySelector('.threshold-input').addEventListener('input', (e) => {
            this.rule.threshold = e.target.value;
            this.updateSummary(card);
            this.app.saveToLocalStorage();
            this.app.updateDevOutput();
        });

        // Screen inputs (only for message-type rules, not flash)
        if (this.rule.outputType !== 'flash') {
            card.querySelectorAll('.screen-line-inline').forEach(input => {
                input.addEventListener('input', (e) => {
                    const screen = e.target.dataset.screen;
                    const line = parseInt(e.target.dataset.line) - 1;
                    const value = e.target.value.toUpperCase();
                    e.target.value = value;

                    if (screen === '1') {
                        this.rule.screen1[line] = value;
                        if (this.rule.sameAsScreen1) {
                            this.rule.screen2[line] = value;
                        }
                    } else if (screen === '2') {
                        this.rule.screen2[line] = value;
                    }

                    this.checkBtCharWarning(card, parseInt(screen), line);
                    this.updateSummary(card);
                    this.app.saveToLocalStorage();
                    this.app.updateDevOutput();
                });
            });

            const sameAsCheckbox = card.querySelector('.same-as-screen1');
            if (sameAsCheckbox) {
                sameAsCheckbox.addEventListener('change', (e) => {
                    this.rule.sameAsScreen1 = e.target.checked;
                    const screen2Inputs = card.querySelectorAll('.screen-line-inline[data-screen="2"]');
                    screen2Inputs.forEach((input, i) => {
                        input.disabled = e.target.checked;
                        if (e.target.checked) {
                            input.value = this.rule.screen1[i] || '';
                            this.rule.screen2[i] = this.rule.screen1[i] || '';
                        }
                    });
                    this.updateSummary(card);
                    this.app.saveToLocalStorage();
                    this.app.updateDevOutput();
                });
            }

            // BT pill drag/drop
            this.attachBtPillHandlers(card);
        }
    }

    attachBtPillHandlers(card) {
        // Draggable pill sources (one per sensor)
        card.querySelectorAll('.bt-pill-draggable').forEach(draggable => {
            draggable.addEventListener('dragstart', (e) => {
                e.stopPropagation(); // Prevent rule-slot reorder from activating
                e.dataTransfer.setData('application/bt-pill', draggable.dataset.sensorId);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

        // Drop targets (chip-input containers)
        card.querySelectorAll('.chip-input-container').forEach(container => {
            container.addEventListener('dragover', (e) => {
                if (e.dataTransfer.types.includes('application/bt-pill')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    container.classList.add('bt-drop-target');
                }
            });

            container.addEventListener('dragleave', () => {
                container.classList.remove('bt-drop-target');
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('bt-drop-target');
                const sensorId = e.dataTransfer.getData('application/bt-pill');
                if (!sensorId) return;

                const screen = parseInt(container.dataset.screen);
                const lineIdx = parseInt(container.dataset.line) - 1;
                const screenKey = `screen${screen}`;

                if (!this.rule.btPills) {
                    this.rule.btPills = { screen1: [null, null, null], screen2: [null, null, null] };
                }

                this.rule.btPills[screenKey][lineIdx] = {
                    sensorId: isNaN(Number(sensorId)) ? sensorId : Number(sensorId)
                };

                this.reRenderDisplayInputs(card);
                this.checkBtCharWarning(card, screen, lineIdx);
                this.updateSummary(card);
                this.app.saveToLocalStorage();
            });
        });

        // Remove pill buttons
        card.querySelectorAll('.bt-pill-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const screen = parseInt(btn.dataset.screen);
                const lineIdx = parseInt(btn.dataset.line) - 1;
                const screenKey = `screen${screen}`;

                if (this.rule.btPills && this.rule.btPills[screenKey]) {
                    this.rule.btPills[screenKey][lineIdx] = null;
                }

                this.reRenderDisplayInputs(card);
                this.updateSummary(card);
                this.app.saveToLocalStorage();
            });
        });
    }

    reRenderDisplayInputs(card) {
        const displayContainer = card.querySelector('.rule-display-inputs');
        if (!displayContainer) return;

        const parent = displayContainer.parentElement;
        displayContainer.remove();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.renderDisplayInputs();
        const newDisplay = tempDiv.firstElementChild;
        parent.appendChild(newDisplay);

        // Re-attach screen input listeners
        newDisplay.querySelectorAll('.screen-line-inline').forEach(input => {
            input.addEventListener('input', (e) => {
                const screen = e.target.dataset.screen;
                const line = parseInt(e.target.dataset.line) - 1;
                const value = e.target.value.toUpperCase();
                e.target.value = value;

                if (screen === '1') {
                    this.rule.screen1[line] = value;
                    if (this.rule.sameAsScreen1) {
                        this.rule.screen2[line] = value;
                    }
                } else if (screen === '2') {
                    this.rule.screen2[line] = value;
                }

                this.checkBtCharWarning(card, parseInt(screen), line);
                this.updateSummary(card);
                this.app.saveToLocalStorage();
                this.app.updateDevOutput();
            });
        });

        const sameAsCheckbox = newDisplay.querySelector('.same-as-screen1');
        if (sameAsCheckbox) {
            sameAsCheckbox.addEventListener('change', (e) => {
                this.rule.sameAsScreen1 = e.target.checked;
                const screen2Inputs = newDisplay.querySelectorAll('.screen-line-inline[data-screen="2"]');
                screen2Inputs.forEach((input, i) => {
                    input.disabled = e.target.checked;
                    if (e.target.checked) {
                        input.value = this.rule.screen1[i] || '';
                        this.rule.screen2[i] = this.rule.screen1[i] || '';
                    }
                });
                this.updateSummary(card);
                this.app.saveToLocalStorage();
                this.app.updateDevOutput();
            });
        }

        // Re-attach BT pill handlers
        this.attachBtPillHandlers(card);
    }

    toggleExpand(card) {
        this.isExpanded = !this.isExpanded;
        this.rule._expanded = this.isExpanded;
        const details = card.querySelector('.rule-details');
        const chevron = card.querySelector('.rule-chevron');

        details.classList.toggle('collapsed', !this.isExpanded);
        chevron.style.transform = this.isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        card.classList.toggle('expanded', this.isExpanded);
    }

    updateSummary(card) {
        const summaryEl = card.querySelector('.rule-summary');
        if (summaryEl) {
            summaryEl.innerHTML = this.renderSummary();
        }
    }

    updateUnitLabel(card) {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        const unitLabel = card.querySelector('.unit-label');

        if (!metric) {
            unitLabel.textContent = '';
            return;
        }

        const baseValue = metric.value.replace('bt_', '');
        if (baseValue.includes('speed')) {
            unitLabel.textContent = 'MPH';
        } else if (baseValue.includes('travel_time')) {
            unitLabel.textContent = 'minutes';
        } else {
            unitLabel.textContent = 'VPM';
        }
    }

    updateOperatorDropdown(card) {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        const operatorSelect = card.querySelector('.operator-select');

        if (!metric) {
            operatorSelect.innerHTML = `
                <option value="less">is less than</option>
                <option value="greater">is greater than</option>
            `;
            return;
        }

        const baseValue = metric.value.replace('bt_', '');
        if (baseValue.includes('speed')) {
            operatorSelect.innerHTML = `<option value="less" selected>is less than</option>`;
            this.rule.operator = 'less';
        } else if (baseValue.includes('travel_time')) {
            operatorSelect.innerHTML = `<option value="greater" selected>is greater than</option>`;
            this.rule.operator = 'greater';
        } else {
            operatorSelect.innerHTML = `
                <option value="less" ${this.rule.operator === 'less' ? 'selected' : ''}>is less than</option>
                <option value="greater" ${this.rule.operator === 'greater' ? 'selected' : ''}>is greater than</option>
            `;
        }
    }

    updateSensorInput(card) {
        const sensorGroup = card.querySelector('.sensor-input-group');
        const sensorSeparator = card.querySelector('.sensor-separator');
        if (!sensorGroup) return;

        // Hide sensor group and "at" separator for aggregate metrics (e.g. Lowest Speed at Any Sensor)
        const isAggregate = this.isAggregateMetric();
        sensorGroup.style.display = isAggregate ? 'none' : '';
        if (sensorSeparator) sensorSeparator.style.display = isAggregate ? 'none' : '';

        if (isAggregate) {
            this.updateSummary(card);
            return;
        }

        // Keep the label, replace the input
        const existingInput = sensorGroup.querySelector('.sensor-select, .sensor-static-text');
        if (existingInput) {
            existingInput.remove();
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.renderSensorInput();
        const newInput = tempDiv.firstElementChild;
        sensorGroup.appendChild(newInput);

        // Re-attach event listener if it's a select
        if (newInput.classList.contains('sensor-select')) {
            newInput.addEventListener('change', (e) => {
                this.rule.sensor = e.target.value;
                this.updateSummary(card);
                this.app.saveToLocalStorage();
                this.app.updateDevOutput();
            });
        }

        this.updateSummary(card);
    }

    /**
     * Checks if a display line with a BT pill has text exceeding 6 characters.
     * If so, highlights the input and shows a user-friendly warning modal.
     * @param {HTMLElement} card - The rule card element
     * @param {number} screen - Screen number (1 or 2)
     * @param {number} lineIdx - Zero-based line index
     */
    checkBtCharWarning(card, screen, lineIdx) {
        const screenKey = `screen${screen}`;
        const pill = this.rule.btPills?.[screenKey]?.[lineIdx];
        const text = this.rule[screenKey]?.[lineIdx] || '';

        // Target the chip-input-container for the highlight
        const container = card.querySelector(`.chip-input-container[data-screen="${screen}"][data-line="${lineIdx + 1}"]`);

        if (pill && text.length > 6) {
            if (container) container.classList.add('bt-char-warning-field');
            this.showBtCharWarningModal();
        } else {
            if (container) container.classList.remove('bt-char-warning-field');
        }

        // Toggle the inline warning hint based on whether any red fields remain
        const displayInputs = card.querySelector('.rule-display-inputs');
        if (!displayInputs) return;
        const anyWarning = displayInputs.querySelector('.chip-input-container.bt-char-warning-field');
        let hint = displayInputs.querySelector('.bt-char-warning-hint');
        if (anyWarning && !hint) {
            hint = document.createElement('div');
            hint.className = 'bt-char-warning-hint';
            hint.textContent = 'Route values use 2\u20133 characters of the 8-character limit. Shorten highlighted fields to 6 or fewer, or add another rule.';
            displayInputs.appendChild(hint);
        } else if (!anyWarning && hint) {
            hint.remove();
        }
    }

    /**
     * Shows the BT character warning modal with friendly messaging.
     */
    showBtCharWarningModal() {
        const modal = document.getElementById('bt-char-warning-modal');
        if (!modal) return;
        modal.classList.remove('hidden');

        // Remove old listeners by replacing buttons
        const okBtn = document.getElementById('bt-char-warn-ok');
        const addBtn = document.getElementById('bt-char-warn-add-rule');

        const newOk = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOk, okBtn);
        newOk.addEventListener('click', () => modal.classList.add('hidden'));

        const newAdd = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAdd, addBtn);
        newAdd.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.app.addRule();
        });
    }
}
