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
                        <span class="separator sensor-separator" ${this.shouldHideSensorInput() ? 'style="display:none"' : ''}>${this.getSensorSeparatorText()}</span>
                        <div class="input-group sensor-input-group" ${this.shouldHideSensorInput() ? 'style="display:none"' : ''}>
                            <label class="input-label sensor-input-label">${this.getSensorLabelText()}</label>
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
        // BACKEND NOTE: Hide the sensor pill in the collapsed summary whenever
        // the sensor input itself is hidden (aggregate metrics OR Travel Time).
        const sensorPill = this.shouldHideSensorInput() ? '' : `<span class="pill pill-sensor">${sensorName}</span>`;
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
                    // BACKEND NOTE: Insert the [LABEL] at the pill's position inside the text,
                    // not always at the start. Old pills without a position default to 0.
                    // getChipLabel produces "PCMS TT", "Route1 DT", etc. - the same short form
                    // the chip in the input uses, so the collapsed summary stays consistent.
                    const label = `[${this.getChipLabel(pill)}]`;
                    const t = text || '';
                    const pos = Math.max(0, Math.min(pill.position ?? 0, t.length));
                    return (t.slice(0, pos) + label + t.slice(pos)).trim();
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

    /**
     * BACKEND NOTE: Returns true ONLY when the selected metric is "Bluetooth Travel Time"
     * (metric.value === 'bt_travel_time'). This metric uses a Bluetooth ROUTE
     * (not a regular sensor) as its data source.
     */
    isBluetoothTravelTimeMetric() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        return metric && metric.value === 'bt_travel_time';
    }

    /**
     * BACKEND NOTE: The word between the metric and the sensor/route dropdown.
     * - "Bluetooth Travel Time" -> "via"  (because the time is measured VIA a route)
     * - All other metrics       -> "at"   (because the metric is measured AT a sensor)
     */
    getSensorSeparatorText() {
        return this.isBluetoothTravelTimeMetric() ? 'via' : 'at';
    }

    /**
     * BACKEND NOTE: The label above the sensor/route dropdown.
     * - "Bluetooth Travel Time" -> "Route"  (selecting a Bluetooth route)
     * - All other metrics       -> "Sensor" (selecting a regular sensor)
     */
    getSensorLabelText() {
        return this.isBluetoothTravelTimeMetric() ? 'Route' : 'Sensor';
    }

    isAggregateMetric() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        return metric && (metric.value.includes('_any') || metric.value.includes('_all'));
    }

    /**
     * BACKEND NOTE: Returns true ONLY when the selected metric is "Travel Time"
     * (metric.value === 'travel_time'). Note: this does NOT match "Bluetooth Travel Time"
     * (bt_travel_time) - that one still uses a Route dropdown.
     */
    isTravelTimeMetric() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        return metric && metric.value === 'travel_time';
    }

    /**
     * BACKEND NOTE: When this returns true, the UI hides BOTH the separator word
     * (the "at"/"via" text) AND the sensor/route dropdown. Two cases:
     *   1. Aggregate metrics ("Lowest Speed at Any Sensor") - they apply to all sensors
     *      automatically, so no individual sensor pick is needed.
     *   2. "Travel Time" - product decision: this metric does not require a sensor pick.
     */
    shouldHideSensorInput() {
        return this.isAggregateMetric() || this.isTravelTimeMetric();
    }

    getAggregateSensorText() {
        const metric = this.app.data.metrics.find(m => m.id == this.rule.metric);
        if (!metric) return '';
        if (metric.value.includes('_any')) return 'Any Sensor';
        if (metric.value.includes('_all')) return 'All Sensors';
        return '';
    }

    /**
     * BACKEND NOTE: HTML-escape a string before inserting it into a template literal.
     * Used when rendering the user-typed text inside the contenteditable chip-editable div,
     * so characters like "<" or "&" do not break the HTML.
     */
    escapeHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * BACKEND NOTE: Returns true when `node` is a rendered pill chip element inside
     * a contenteditable line. Recognises BOTH the blue Bluetooth chips (.bt-pill-chip)
     * and the orange PCMS chips (.pcms-pill-chip). All DOM-walk helpers in this file
     * use this to: (a) treat the chip as the pill marker, and (b) skip the chip's
     * inner text from being counted as user-typed text.
     */
    _isPillChipNode(node) {
        return !!(node && node.nodeType === Node.ELEMENT_NODE && node.classList &&
                  (node.classList.contains('bt-pill-chip') || node.classList.contains('pcms-pill-chip')));
    }

    /**
     * BACKEND NOTE: Reads a contenteditable .chip-editable div and returns:
     *   text         - the user-typed characters (text nodes only; pill chip content is excluded)
     *   pillPosition - the character index where the pill chip sits in the text, or null if absent
     * The pill chip is identified by the .bt-pill-chip CSS class and is contenteditable=false,
     * so its inner text is NOT counted as user-typed text.
     */
    parseChipEditable(div) {
        let text = '';
        let pillPosition = null;
        for (const node of div.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (this._isPillChipNode(node)) {
                if (pillPosition === null) {
                    pillPosition = text.length;
                }
            }
        }
        return { text, pillPosition };
    }

    /**
     * BACKEND NOTE: Given drop coordinates (clientX, clientY) inside a chip-editable div,
     * returns the character index in the typed text where the dropped pill should be inserted.
     *   - Drop directly on the existing pill chip   -> returns the pill's current text position
     *     (so dragging a new sensor onto an existing chip just swaps the sensor, position kept)
     *   - Drop on text                              -> returns the caret position within the text
     *   - Drop outside any text run / unsupported   -> returns the end of the text (safe fallback)
     */
    getDropTextOffset(editableDiv, clientX, clientY) {
        const textNow = this.parseChipEditable(editableDiv).text;

        let range = null;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(clientX, clientY);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(clientX, clientY);
            if (pos) range = { startContainer: pos.offsetNode, startOffset: pos.offset };
        }

        if (!range || !range.startContainer || !editableDiv.contains(range.startContainer)) {
            return textNow.length;
        }

        // If the caret landed inside the pill chip, treat the drop as "at the pill's location"
        let node = range.startContainer;
        while (node && node !== editableDiv) {
            if (this._isPillChipNode(node)) {
                return this.textLengthBeforeNode(editableDiv, node);
            }
            node = node.parentNode;
        }

        return this.computeTextOffset(editableDiv, range.startContainer, range.startOffset);
    }

    /**
     * BACKEND NOTE: Returns (and lazily creates) a single off-screen 1x1 element used as
     * the "drag image" for pill drags. Passing this to dataTransfer.setDragImage() makes
     * the browser draw NOTHING under the cursor during a drag - the user instead sees
     * the blue drop-preview "|" inside the input as their feedback. The element is kept
     * in the DOM (off-screen) because browsers require setDragImage's element to be
     * attached to the document at the moment dragstart fires.
     */
    _getEmptyDragImage() {
        let ghost = document.getElementById('bt-drag-ghost');
        if (!ghost) {
            ghost = document.createElement('div');
            ghost.id = 'bt-drag-ghost';
            ghost.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
            document.body.appendChild(ghost);
        }
        return ghost;
    }

    /**
     * BACKEND NOTE: Inserts a big blue vertical bar (".bt-drop-cursor") at the given text
     * position inside the contenteditable, so the user can see EXACTLY where the pill will
     * land if they release the mouse. Used live during dragover. Safe to call repeatedly:
     * if the cursor is already at this position the call is a no-op (avoids DOM churn).
     */
    showDropCursor(editableDiv, position) {
        if (!editableDiv) return;
        if (editableDiv.dataset.dropCursorPos === String(position)) return;
        this.hideDropCursor(editableDiv);
        editableDiv.dataset.dropCursorPos = String(position);

        const cursor = document.createElement('span');
        cursor.className = 'bt-drop-cursor';
        cursor.setAttribute('contenteditable', 'false');

        // Walk top-level child nodes, accumulating typed text length, and insert the
        // cursor span at the right spot. Text nodes may need to be split when the
        // position falls in the middle of one.
        let acc = 0;
        const children = Array.from(editableDiv.childNodes);
        for (const node of children) {
            if (node.nodeType === Node.TEXT_NODE) {
                const len = node.textContent.length;
                if (acc + len >= position) {
                    const offsetInNode = position - acc;
                    if (offsetInNode === 0) {
                        editableDiv.insertBefore(cursor, node);
                    } else if (offsetInNode === len) {
                        if (node.nextSibling) editableDiv.insertBefore(cursor, node.nextSibling);
                        else editableDiv.appendChild(cursor);
                    } else {
                        const after = node.splitText(offsetInNode);
                        editableDiv.insertBefore(cursor, after);
                    }
                    return;
                }
                acc += len;
            }
            // Pill chips and any stray elements contribute zero text - just keep walking.
        }
        // Position is at or past the end of the typed text - append at end.
        editableDiv.appendChild(cursor);
    }

    /**
     * BACKEND NOTE: Removes any drop-cursor indicators and merges adjacent text nodes
     * back together (showDropCursor may have split a text node to insert the cursor).
     */
    hideDropCursor(editableDiv) {
        if (!editableDiv) return;
        editableDiv.querySelectorAll('.bt-drop-cursor').forEach(el => el.remove());
        delete editableDiv.dataset.dropCursorPos;
        editableDiv.normalize();
    }

    /**
     * BACKEND NOTE: Sums the length of all text nodes in `root` that appear BEFORE `target`
     * in document order. Pill chips do not contribute (their inner text is not user-typed).
     */
    textLengthBeforeNode(root, target) {
        let total = 0;
        let done = false;
        const walk = (node) => {
            if (done) return;
            if (node === target) { done = true; return; }
            if (node.nodeType === Node.TEXT_NODE) {
                total += node.textContent.length;
                return;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (this._isPillChipNode(node) || (node.classList && node.classList.contains('bt-drop-cursor'))) return;
                for (const child of node.childNodes) {
                    walk(child);
                    if (done) return;
                }
            }
        };
        walk(root);
        return total;
    }

    /**
     * BACKEND NOTE: Translates a DOM (container, offset) selection point into a character
     * offset inside the typed text of `root`. Pill chips are skipped (they do not count).
     * - container is a text node -> offset is the char index within that text node
     * - container is an element  -> offset is the index of a child node (positions BEFORE it)
     */
    computeTextOffset(root, container, offsetWithin) {
        let total = 0;
        let done = false;
        const accumulate = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                total += node.textContent.length;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (this._isPillChipNode(node) || (node.classList && node.classList.contains('bt-drop-cursor'))) return;
                for (const child of node.childNodes) accumulate(child);
            }
        };
        const walk = (node) => {
            if (done) return;
            if (node === container) {
                if (node.nodeType === Node.TEXT_NODE) {
                    total += Math.max(0, Math.min(offsetWithin, node.textContent.length));
                } else {
                    const limit = Math.min(offsetWithin, node.childNodes.length);
                    for (let i = 0; i < limit; i++) accumulate(node.childNodes[i]);
                }
                done = true;
                return;
            }
            if (node.nodeType === Node.TEXT_NODE) {
                total += node.textContent.length;
                return;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (this._isPillChipNode(node) || (node.classList && node.classList.contains('bt-drop-cursor'))) return;
                for (const child of node.childNodes) {
                    walk(child);
                    if (done) return;
                }
            }
        };
        walk(root);
        return done ? total : 0;
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

        const renderLineInput = (screen, lineIdx) => {
            const screenKey = `screen${screen}`;
            const pill = this.rule.btPills[screenKey][lineIdx];
            const value = this.rule[screenKey][lineIdx] || '';
            const disabled = (screen === 2 && this.rule.sameAsScreen1) ? 'disabled' : '';

            // BACKEND NOTE: Every screen line is a contenteditable <div> now (not <input>),
            // because every metric type can host pill drops (PCMS pills for non-BT metrics,
            // Bluetooth-route pills for BT metrics, both for either side once dropped).
            // <input type="text"> cannot host an inline pill chip as a child element.
            //
            // pill.position is the character index in the typed text where the pill chip
            // sits (0..text.length). Examples for text "ABCD":
            //   position = 0  -> [pill]ABCD   (pill at the start)
            //   position = 2  -> AB[pill]CD   (pill in the middle)
            //   position = 4  -> ABCD[pill]   (pill at the end)
            // Older saved pills do NOT have a position field. We default to 0 so that
            // existing rules keep their original look (pill at the start).
            const text = value;
            const position = pill ? Math.max(0, Math.min(pill.position ?? 0, text.length)) : 0;
            const beforeText = pill ? text.slice(0, position) : text;
            const afterText = pill ? text.slice(position) : '';

            // BACKEND NOTE: chip class is driven by pill.pillType (pcms -> orange, bt -> blue);
            // chip label is "PCMS TT", "PCMS DT", "Route1 TT", "Route1 DT" etc.
            const chipKindClass = pill ? this.getChipKindClass(pill) : 'bt-pill-chip';
            const chipLabel = pill ? this.escapeHtml(this.getChipLabel(pill)) : '';
            const pillChip = pill
                ? `<span class="${chipKindClass}" contenteditable="false">${chipLabel}<button class="bt-pill-remove" data-screen="${screen}" data-line="${lineIdx + 1}">&times;</button></span>`
                : '';
            const hasWarning = pill && text.length > 6;
            const editableAttr = disabled ? 'false' : 'true';

            return `<div class="chip-input-container${hasWarning ? ' bt-char-warning-field' : ''}" data-screen="${screen}" data-line="${lineIdx + 1}">
                <div class="chip-editable screen-line-inline compact-input${disabled ? ' is-disabled' : ''}"
                     contenteditable="${editableAttr}"
                     data-screen="${screen}"
                     data-line="${lineIdx + 1}"
                     data-placeholder="Line ${lineIdx + 1}"
                     spellcheck="false">${this.escapeHtml(beforeText)}${pillChip}${this.escapeHtml(afterText)}</div>
            </div>`;
        };

        // BACKEND NOTE: Pill source area is shown for ALL message-type rules now
        // (PCMS for non-BT metrics, BT routes for BT metrics). See renderMetricPillSources.
        const pillSource = this.renderMetricPillSources();

        // Any pill (PCMS or BT) plus typed text over 6 chars triggers the warning.
        const hasAnyWarning = [0, 1, 2].some(i =>
            (this.rule.btPills.screen1[i] && (this.rule.screen1[i] || '').length > 6) ||
            (this.rule.btPills.screen2[i] && (this.rule.screen2[i] || '').length > 6)
        );
        const warningHint = hasAnyWarning
            ? `<div class="bt-char-warning-hint">Pill values use 2–3 characters of the 8-character limit. Shorten highlighted fields to 6 or fewer, or add another rule.</div>`
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

    /* =========================================================================
     * BACKEND NOTE: Pill data model
     *
     * A dropped pill is stored in rule.btPills[screenKey][lineIdx] as:
     *
     *   {
     *     pillType: 'pcms' | 'bluetooth',   // which pill source it was dragged from
     *     mode:     'travel_time' | 'delay_time',  // what kind of value it represents
     *     sensorId: <id> | null,            // the BT route id (only for pillType='bluetooth')
     *     position: <number>                // character index in the typed text (0..text.length)
     *   }
     *
     * Backward compat: pills saved BEFORE this feature only had { sensorId, position }
     * (and they were always Bluetooth + Travel Time). Any pill missing pillType is
     * treated as 'bluetooth', any pill missing mode is treated as 'travel_time'.
     *
     * The drag payload (dataTransfer) is a JSON string with the same shape MINUS the
     * position - position is computed at the drop point, not the drag source.
     *
     * Per-rule state added for this feature:
     *   rule.displayDelayTime (boolean) - controls whether the Delay Time pill source
     *                                     section is shown. Treated as false when undefined.
     * ======================================================================= */

    /** Returns 'pcms' or 'bluetooth'. Defaults to 'bluetooth' for legacy pills. */
    getPillKind(pill) {
        return (pill && pill.pillType) || 'bluetooth';
    }

    /** Returns 'travel_time' or 'delay_time'. Defaults to 'travel_time' for legacy pills. */
    getPillMode(pill) {
        return (pill && pill.mode) || 'travel_time';
    }

    /** Short two-letter form: 'TT' / 'DT'. Used in chip labels and the collapsed summary. */
    getModeAbbreviation(mode) {
        return mode === 'delay_time' ? 'DT' : 'TT';
    }

    /** Full human form: 'Travel Time' / 'Delay Time'. Used in source pill labels and section headers. */
    getModeName(mode) {
        return mode === 'delay_time' ? 'Delay Time' : 'Travel Time';
    }

    /**
     * Compact label used inside a screen-line chip and in the collapsed summary.
     * Examples: "PCMS TT", "PCMS DT", "Route1 TT", "Route1 DT".
     */
    getChipLabel(pill) {
        const abbr = this.getModeAbbreviation(this.getPillMode(pill));
        const baseName = this.getPillKind(pill) === 'pcms' ? 'PCMS' : this.getPillLabel(pill.sensorId);
        return `${baseName} ${abbr}`;
    }

    /** CSS class that drives the chip's color: orange for PCMS, blue for BT. */
    getChipKindClass(pill) {
        return this.getPillKind(pill) === 'pcms' ? 'pcms-pill-chip' : 'bt-pill-chip';
    }

    /**
     * BACKEND NOTE: Renders the entire metric-pills source area shown above the
     * Screen 1 / Screen 2 input rows. Always produces a "Travel Time" section, and
     * a "Delay Time" section only when rule.displayDelayTime is true (toggled by the
     * "Display Delay Time" checkbox in the Travel Time section's header).
     *
     * Which pills appear in each section depends on the selected metric:
     *   - Bluetooth metrics (Speed (+ Bluetooth), Bluetooth Travel Time)
     *       -> one BLUE pill per BT route assigned to the current device
     *   - All other metrics (Speed, Travel Time, Lowest Speed at Any Sensor)
     *       -> one ORANGE "PCMS" pill (PCMS itself is the data source - no per-sensor pills)
     */
    renderMetricPillSources() {
        const isBt = this.isBluetoothMetric();
        const showDelay = !!this.rule.displayDelayTime;

        const renderSection = (mode, includeCheckbox) => {
            const sectionTitle = this.getModeName(mode);
            const pillsHtml = isBt
                ? this.renderBluetoothRoutePills(mode)
                : this.renderPcmsPill(mode);
            const checkboxHtml = includeCheckbox
                ? `<label class="display-delay-time-toggle" title="Show a second pill source for Delay Time values">
                       <input type="checkbox" class="display-delay-time" ${showDelay ? 'checked' : ''}>
                       Display Delay Time
                   </label>`
                : '';
            return `
                <div class="metric-pills-section ${mode === 'delay_time' ? 'delay-time-section' : 'travel-time-section'}">
                    <div class="metric-pills-section-header">
                        <span class="metric-pills-section-label">${sectionTitle}</span>
                        ${checkboxHtml}
                    </div>
                    <div class="metric-pills-section-list">${pillsHtml}</div>
                </div>
            `;
        };

        // The Travel Time section is ALWAYS shown. The Delay Time section is gated
        // by the Display Delay Time checkbox (which lives in the TT section header).
        return `
            <div class="metric-pills-area">
                ${renderSection('travel_time', true)}
                ${showDelay ? renderSection('delay_time', false) : ''}
            </div>
        `;
    }

    /**
     * BACKEND NOTE: Renders the orange PCMS pill for a given mode. Used for non-BT
     * metrics. There is exactly ONE PCMS pill per mode (PCMS is the device itself,
     * not a per-sensor data source, so there are no variants to choose between).
     * The data-* attributes carry the info dragstart needs to build the drag payload.
     */
    renderPcmsPill(mode) {
        const label = `PCMS ${this.getModeName(mode)}`;
        return `<span class="metric-pill-draggable pcms-pill-draggable"
                      draggable="true"
                      data-pill-type="pcms"
                      data-pill-mode="${mode}">${label}</span>`;
    }

    /**
     * BACKEND NOTE: Renders one blue draggable pill PER Bluetooth route assigned
     * to the current device (sensors where isBluetooth === true and which appear in
     * currentDevice.associatedSensors). Each pill carries its route's sensor id plus
     * the mode (travel_time | delay_time). Returns a hint string when there are no
     * BT routes available so the user is not staring at an empty section.
     */
    renderBluetoothRoutePills(mode) {
        const associated = this.app.currentDevice?.associatedSensors || [];
        const btRoutes = this.app.data.sensors.filter(s => s.isBluetooth === true && associated.includes(s.id));
        if (btRoutes.length === 0) {
            return `<span class="metric-pills-empty-hint">No Bluetooth routes assigned to this device</span>`;
        }
        const modeName = this.getModeName(mode);
        return btRoutes.map(route =>
            `<span class="metric-pill-draggable bt-pill-draggable"
                   draggable="true"
                   data-pill-type="bluetooth"
                   data-pill-mode="${mode}"
                   data-sensor-id="${route.id}">${this.escapeHtml(route.name)} ${modeName}</span>`
        ).join('');
    }

    renderMetricOptions() {
        const webBeaconMetrics = ['speed', 'speed_any'];
        const metrics = this.app.currentDeviceType === 'webbeacon'
            ? this.app.data.metrics.filter(m => webBeaconMetrics.includes(m.value))
            : this.app.data.metrics;
        return metrics.map(metric => {
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
        const isBtTravelTime = metric && metric.value === 'bt_travel_time';

        // BACKEND NOTE: "Bluetooth Travel Time" metric.
        // The dropdown must contain ONLY Bluetooth routes (sensors where isBluetooth === true).
        // Regular sensors must NOT appear here. The selected value is still saved into rule.sensor
        // (same field as a regular sensor id), so no schema change is required - the value is
        // simply the id of a Bluetooth route sensor instead of a regular sensor.
        if (isBtTravelTime) {
            const btRoutes = this.app.data.sensors.filter(s => s.isBluetooth === true);
            return btRoutes.map(route => {
                const selected = this.rule.sensor == route.id ? 'selected' : '';
                return `<option value="${route.id}" ${selected}>${route.name}</option>`;
            }).join('');
        }

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
            const wasBtTravelTime = this.isBluetoothTravelTimeMetric();
            this.rule.metric = e.target.value;
            const isBluetooth = this.isBluetoothMetric();
            const isBtTravelTime = this.isBluetoothTravelTimeMetric();
            // Clear sensor when switching between bluetooth and non-bluetooth metrics
            if (wasBluetooth !== isBluetooth) {
                this.rule.sensor = '';
                // BACKEND NOTE: Pills are NO LONGER cleared on metric change. With the
                // generic Travel Time / Delay Time pill model, a dropped pill (PCMS or
                // Bluetooth) is a valid display value regardless of which metric drives
                // the rule's threshold. We preserve the user's work; they can click the
                // x on any chip they no longer want, or drag a different one over it.
            }
            // BACKEND NOTE: Also clear the sensor when entering or leaving "Bluetooth Travel Time".
            // Reason: that metric uses a Bluetooth ROUTE list (only isBluetooth === true items),
            // while the other BT metric ("Speed (+ Bluetooth)") uses a mixed list of regular
            // sensors AND routes. The old selection may not exist in the new dropdown.
            else if (wasBtTravelTime !== isBtTravelTime) {
                this.rule.sensor = '';
            }
            // BACKEND NOTE: Clear the sensor when switching INTO "Travel Time".
            // That metric does not use a sensor at all, so any previously-selected
            // sensor id should not be saved on the rule.
            if (this.isTravelTimeMetric()) {
                this.rule.sensor = '';
            }
            this.updateUnitLabel(card);
            this.updateOperatorDropdown(card);
            this.updateSensorInput(card);
            // BACKEND NOTE: Re-render the display inputs whenever the metric crosses the
            // BT/non-BT boundary, so the pill source area swaps between the orange PCMS
            // pill and the blue Bluetooth-route pills. (Switching between two non-BT
            // metrics, or between two BT metrics, does NOT change the pill source, so
            // we skip the re-render in those cases to preserve user focus.)
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
            // BACKEND NOTE: All screen-line + sameAs handler wiring is shared with the code
            // path used after a re-render (reRenderDisplayInputs), so it is factored out.
            this.attachDisplayInputHandlers(card, card);

            // BT pill drag/drop
            this.attachBtPillHandlers(card);
        }
    }

    /**
     * BACKEND NOTE: Wires up the input listeners for the three Screen-1 and three Screen-2
     * line fields, plus the "Same as S1" checkbox. Works with BOTH widget types:
     *   - <input type="text">              -> used for non-Bluetooth metrics (no pill possible)
     *   - <div class="chip-editable">      -> used for Bluetooth metrics, can host a pill chip
     * `scope` is the element to search within for screen-line-inline / .same-as-screen1
     * (this is `card` for the initial render, or the freshly-built display container after
     * a re-render). `card` is always the full rule card, used for warning highlights and
     * to update the collapsed summary.
     */
    attachDisplayInputHandlers(scope, card) {
        scope.querySelectorAll('.screen-line-inline').forEach(el => {
            const isEditable = el.tagName.toLowerCase() === 'div';

            if (isEditable) {
                // BACKEND NOTE: Enforce the 8-character text limit on contenteditable.
                // <div contenteditable> has no native maxlength attribute, so we must
                // block the insertion BEFORE it lands in the DOM. Doing it after
                // (truncating in the input event) would corrupt the cursor position.
                el.addEventListener('beforeinput', (e) => {
                    const types = ['insertText', 'insertCompositionText', 'insertFromPaste'];
                    if (!types.includes(e.inputType)) return;
                    const insertText = e.dataTransfer
                        ? e.dataTransfer.getData('text/plain')
                        : (e.data || '');
                    const sel = window.getSelection();
                    const selectionLen = sel ? sel.toString().length : 0;
                    const currentLen = this.parseChipEditable(el).text.length;
                    if (currentLen - selectionLen + insertText.length > 8) {
                        e.preventDefault();
                    }
                });

                // BACKEND NOTE: Block the browser's native drop behaviour for pill drops.
                // We process pill drops at the chip-input-container level (see
                // attachBtPillHandlers) so that we can compute WHERE in the text the pill
                // should land. Without these handlers the browser would try to drop the
                // pill data as plain text into the contenteditable, garbling the content.
                el.addEventListener('dragover', (e) => {
                    if (e.dataTransfer && e.dataTransfer.types.includes('application/bt-pill')) {
                        e.preventDefault();
                    }
                });
                el.addEventListener('drop', (e) => {
                    if (e.dataTransfer && e.dataTransfer.types.includes('application/bt-pill')) {
                        e.preventDefault();
                    }
                });
            }

            el.addEventListener('input', (e) => {
                const screen = e.target.dataset.screen;
                const line = parseInt(e.target.dataset.line) - 1;

                let value;
                let pillPosition = null;
                if (isEditable) {
                    // Read the current text + pill position from the DOM tree
                    const parsed = this.parseChipEditable(e.target);
                    value = parsed.text.toUpperCase();
                    pillPosition = parsed.pillPosition;
                } else {
                    value = e.target.value.toUpperCase();
                    e.target.value = value;
                }

                if (screen === '1') {
                    this.rule.screen1[line] = value;
                    if (this.rule.sameAsScreen1) {
                        this.rule.screen2[line] = value;
                    }
                } else if (screen === '2') {
                    this.rule.screen2[line] = value;
                }

                // BACKEND NOTE: For contenteditable lines, sync the pill's position to the model.
                // If the pill chip was deleted from the DOM (e.g. user backspaced through it),
                // pillPosition will be null, and we clear the pill from the model too so the
                // saved data stays consistent with what the user sees.
                if (isEditable && this.rule.btPills) {
                    const screenKey = `screen${screen}`;
                    const pill = this.rule.btPills[screenKey][line];
                    if (pill) {
                        if (pillPosition === null) {
                            this.rule.btPills[screenKey][line] = null;
                        } else {
                            pill.position = pillPosition;
                        }
                    }
                }

                this.checkBtCharWarning(card, parseInt(screen), line);
                this.updateSummary(card);
                this.app.saveToLocalStorage();
                this.app.updateDevOutput();
            });
        });

        const sameAsCheckbox = scope.querySelector('.same-as-screen1');
        if (sameAsCheckbox) {
            sameAsCheckbox.addEventListener('change', (e) => {
                this.rule.sameAsScreen1 = e.target.checked;
                // BACKEND NOTE: When the box is checked we copy Screen-1 TEXT into Screen-2.
                // We do NOT copy pills here - that matches the existing product behaviour.
                if (e.target.checked) {
                    for (let i = 0; i < this.rule.screen1.length; i++) {
                        this.rule.screen2[i] = this.rule.screen1[i] || '';
                    }
                }
                // Re-render so the contenteditable disabled state and copied text are
                // applied correctly (input.disabled / input.value do not work on a div).
                this.reRenderDisplayInputs(card);
                this.updateSummary(card);
                this.app.saveToLocalStorage();
                this.app.updateDevOutput();
            });
        }

        // BACKEND NOTE: "Display Delay Time" toggle.
        // Controls whether the second pill source section (Delay Time) is shown.
        // It does NOT affect any pills the user has already dropped into screen
        // lines - existing Delay Time chips stay visible/usable in the inputs even
        // when the box is unchecked. Toggling only shows/hides the DRAG SOURCE.
        const displayDelayTimeCheckbox = scope.querySelector('.display-delay-time');
        if (displayDelayTimeCheckbox) {
            displayDelayTimeCheckbox.addEventListener('change', (e) => {
                this.rule.displayDelayTime = e.target.checked;
                this.reRenderDisplayInputs(card);
                this.app.saveToLocalStorage();
                this.app.updateDevOutput();
            });
        }
    }

    attachBtPillHandlers(card) {
        // BACKEND NOTE: Single selector covers both pill kinds - PCMS pills and BT route
        // pills both carry the .metric-pill-draggable class. The pill kind/mode/sensor
        // are read from the element's data-* attributes set by the renderers.
        card.querySelectorAll('.metric-pill-draggable').forEach(draggable => {
            draggable.addEventListener('dragstart', (e) => {
                e.stopPropagation(); // Prevent rule-slot reorder from activating

                // BACKEND NOTE: Encode the FULL pill descriptor as JSON in the drag payload
                // (kind, mode, optional sensorId). The drop handler decodes this to build
                // the pill object that gets stored on the rule. The MIME type is kept as
                // 'application/bt-pill' for backward compat with the dragover/drop handlers
                // (the value is now a JSON string instead of a bare sensor id).
                const sensorIdRaw = draggable.dataset.sensorId;
                const sensorId = sensorIdRaw === undefined || sensorIdRaw === ''
                    ? null
                    : (isNaN(Number(sensorIdRaw)) ? sensorIdRaw : Number(sensorIdRaw));
                const payload = JSON.stringify({
                    pillType: draggable.dataset.pillType,
                    mode:     draggable.dataset.pillMode,
                    sensorId: sensorId
                });
                e.dataTransfer.setData('application/bt-pill', payload);
                e.dataTransfer.effectAllowed = 'copy';

                // BACKEND NOTE: Suppress the browser's default drag image (the half-transparent
                // pill that follows the cursor). It overlaps the input field and makes it hard
                // to see where the pill will land. Instead the user gets ONLY the big blue "|"
                // drop-preview cursor inside the input. We point setDragImage at a 1x1
                // transparent element kept off-screen in the document body - browsers require
                // the element to be in the DOM at the moment of the dragstart call.
                e.dataTransfer.setDragImage(this._getEmptyDragImage(), 0, 0);
            });
            // BACKEND NOTE: Safety cleanup - if the user cancels the drag (releases outside
            // any container, presses Escape, etc.) the dragleave on the last hovered container
            // SHOULD clear the preview, but this guarantees no stray "|" indicator is left.
            draggable.addEventListener('dragend', () => {
                card.querySelectorAll('.chip-editable').forEach(el => this.hideDropCursor(el));
                card.querySelectorAll('.chip-input-container.bt-drop-target')
                    .forEach(c => c.classList.remove('bt-drop-target'));
            });
        });

        // Drop targets (chip-input containers)
        card.querySelectorAll('.chip-input-container').forEach(container => {
            container.addEventListener('dragover', (e) => {
                if (e.dataTransfer.types.includes('application/bt-pill')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    container.classList.add('bt-drop-target');

                    // BACKEND NOTE: Live drop preview - render a big blue "|" inside the
                    // contenteditable at the exact spot where the pill will land if the
                    // user releases the mouse here. Recomputed every dragover; the helper
                    // skips the DOM update if the position has not changed.
                    const editable = container.querySelector('.chip-editable');
                    if (editable) {
                        const pos = this.getDropTextOffset(editable, e.clientX, e.clientY);
                        this.showDropCursor(editable, pos);
                    }
                }
            });

            container.addEventListener('dragleave', (e) => {
                // BACKEND NOTE: dragleave also fires when the cursor crosses between this
                // container and one of its children, so we only clear the highlight + drop
                // preview when the pointer has actually left the container's bounds.
                if (e.relatedTarget && container.contains(e.relatedTarget)) return;
                container.classList.remove('bt-drop-target');
                const editable = container.querySelector('.chip-editable');
                this.hideDropCursor(editable);
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('bt-drop-target');

                // BACKEND NOTE: The drag payload is a JSON string built in dragstart with shape
                //   { pillType: 'pcms'|'bluetooth', mode: 'travel_time'|'delay_time', sensorId: <id|null> }
                // We parse it here and combine it with the computed drop position to build the
                // pill object stored on the rule. If the JSON is missing or invalid, we bail.
                let descriptor;
                try {
                    descriptor = JSON.parse(e.dataTransfer.getData('application/bt-pill'));
                } catch (_) {
                    return;
                }
                if (!descriptor || !descriptor.pillType) return;

                const screen = parseInt(container.dataset.screen);
                const lineIdx = parseInt(container.dataset.line) - 1;
                const screenKey = `screen${screen}`;

                if (!this.rule.btPills) {
                    this.rule.btPills = { screen1: [null, null, null], screen2: [null, null, null] };
                }

                // BACKEND NOTE: Compute WHERE in the typed text the pill should land.
                // We use the drop's screen coordinates (e.clientX, e.clientY) and translate
                // them into a character index inside the contenteditable. If the position
                // cannot be determined (older browser, drop on whitespace, etc.), we fall
                // back to the END of the text - that is the most "least-surprising" default.
                const editable = container.querySelector('.chip-editable');
                let position = 0;
                if (editable) {
                    position = this.getDropTextOffset(editable, e.clientX, e.clientY);
                    this.hideDropCursor(editable); // remove live drop preview before re-render
                }

                // BACKEND NOTE: Full pill object stored on the rule. See the data-model
                // comment near getPillKind() for the schema. sensorId is null for PCMS pills.
                this.rule.btPills[screenKey][lineIdx] = {
                    pillType: descriptor.pillType,
                    mode:     descriptor.mode || 'travel_time',
                    sensorId: descriptor.sensorId ?? null,
                    position
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

        // BACKEND NOTE: Same handler-wiring as the initial render. Shared with
        // attachEventListeners() so the contenteditable / chip pill logic only lives
        // in one place. `newDisplay` is the freshly-built display container we just
        // appended; `card` is still the full rule card (used by the handlers for
        // warnings and the collapsed summary).
        this.attachDisplayInputHandlers(newDisplay, card);

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

        // BACKEND NOTE: Hide both the separator and the sensor group when the
        // selected metric does not use a sensor. This covers aggregate metrics
        // (e.g. "Lowest Speed at Any Sensor") AND "Travel Time".
        const hideSensor = this.shouldHideSensorInput();
        sensorGroup.style.display = hideSensor ? 'none' : '';
        if (sensorSeparator) sensorSeparator.style.display = hideSensor ? 'none' : '';

        if (hideSensor) {
            this.updateSummary(card);
            return;
        }

        // BACKEND NOTE: When the user changes the metric we must also refresh
        // the separator word ("at" vs "via") and the label text ("Sensor" vs "Route")
        // so the UI matches the newly selected metric.
        if (sensorSeparator) sensorSeparator.textContent = this.getSensorSeparatorText();
        const sensorLabel = sensorGroup.querySelector('.sensor-input-label');
        if (sensorLabel) sensorLabel.textContent = this.getSensorLabelText();

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
