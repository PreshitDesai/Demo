// PCMS Logic Builder Application
class PCMSApp {
    constructor() {
        this.data = {
            devices: [], sensors: [], metrics: [], messageSets: [],
            webBeacons: []
        };
        this.currentDevice = null;
        this.currentDeviceType = 'pcms'; // 'pcms' or 'webbeacon'
        this.rules = [];
        this.devMode = false;
        this.ruleIdCounter = 1;

        // Message Sets (simple snapshots in project history)
        this.messageSets = [];
        this.viewingMessageSet = null;

        // Drafts (work in progress configurations)
        this.drafts = [];
        this.currentDraft = null;
        this.isDraftMode = false;

        // Fallback message for bluetooth out-of-bounds scenario
        this.fallbackMessage = { screen1: ['', '', ''], screen2: ['', '', ''], sameAsScreen1: false };

        // Display preferences
        this.showThresholdFirst = localStorage.getItem('pcms_threshold_first') === 'true';
        // Second Travel Time is opt-in per session; always starts unchecked.
        this.showSensorsForSecondTravelTime = false;
        localStorage.removeItem('pcms_show_sensors_2');

        // Expanded state per accordion (1 = regular sensors, 2 = regular sensors #2, 3 = bluetooth routes)
        this.sensorsAccordionExpanded = { 1: false, 2: false, 3: false };

        this.init();
    }

    async init() {
        await this.loadData();
        this.mergeBtSensors();
        this.loadDeviceConfigurations();
        this.loadMessageSets();
        this.loadDrafts();
        this.setupEventListeners();
        this.setupSensorsAccordionListeners();
        this.setupMessageSetListeners();
        this.setupHomepageListeners();
        this.loadFromLocalStorage();
        this.populateDeviceList();
        this.renderProjectHistory();
        this.renderDraftsList();

        // Listen for bluetooth route changes
        document.addEventListener('btRoutesChanged', () => {
            this.mergeBtSensors();
            if (this.currentDevice) {
                this.renderRules();
            }
        });

        // Show homepage by default
        this.goToHomepage();
    }

    /**
     * Merge virtual sensors from BluetoothRouteManager into the sensors array.
     * Removes any existing BT sensors first, then appends current BT route sensors.
     */
    mergeBtSensors() {
        // Remove existing BT virtual sensors
        this.data.sensors = this.data.sensors.filter(s => !s.isBluetooth);
        // Append current BT route sensors
        if (window.btRouteManager) {
            this.data.sensors.push(...window.btRouteManager.getVirtualSensors());
        }
    }

    // ========================================
    // HOMEPAGE
    // ========================================

    setupHomepageListeners() {
        // Home button in tab bar
        const homeBtn = document.getElementById('toggle-home');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => this.goToHomepage());
        }

        // New Draft button on homepage
        const newDraftBtn = document.getElementById('homepage-new-draft-btn');
        if (newDraftBtn) {
            newDraftBtn.addEventListener('click', () => this.createBlankDraft());
        }

        // Draft from Existing button on homepage
        const fromExistingBtn = document.getElementById('homepage-draft-from-existing-btn');
        if (fromExistingBtn) {
            fromExistingBtn.addEventListener('click', () => this.showDraftFromExisting());
        }
    }

    goToHomepage() {
        // Clear any active modes
        if (this.isDraftMode) {
            this.hideDraftMode();
        }
        if (this.viewingMessageSet) {
            this.closeMessageSetViewer();
        }

        // Hide all other sections
        const logicBuilder = document.querySelector('.logic-builder');
        const messageSetViewer = document.getElementById('message-set-viewer');
        const homepage = document.getElementById('homepage');
        const tabBar = document.querySelector('.vertical-tab-bar');
        const devicesPanel = document.getElementById('devices-panel');
        const mainContent = document.querySelector('.main-content');

        if (logicBuilder) logicBuilder.classList.add('hidden');
        if (messageSetViewer) messageSetViewer.classList.add('hidden');
        if (homepage) homepage.classList.remove('hidden');

        // Hide sidebar and devices panel on homepage, remove padding
        if (tabBar) tabBar.classList.add('hidden');
        if (devicesPanel) devicesPanel.classList.add('hidden');
        if (mainContent) mainContent.classList.add('no-sidebar');

        // Hide developer mode button on homepage
        const devModeBtn = document.getElementById('dev-mode-toggle');
        if (devModeBtn) devModeBtn.classList.add('hidden');

        // Update tab button active state
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        const homeBtn = document.getElementById('toggle-home');
        if (homeBtn) homeBtn.classList.add('active');

        // Render homepage content
        this.renderHomepage();
    }

    renderHomepage() {
        this.renderHomepageHistory();
        this.renderHomepageDrafts();
    }

    renderHomepageHistory() {
        const container = document.getElementById('homepage-history-list');
        const countEl = document.getElementById('homepage-history-count');

        if (!container) return;

        // Sort message sets by timestamp, newest first
        const sorted = [...this.messageSets].sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        // Update count
        if (countEl) {
            countEl.textContent = `${sorted.length} ${sorted.length === 1 ? 'entry' : 'entries'}`;
        }

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="homepage-empty-state">
                    <p>No project history yet</p>
                    <p class="hint">Published configurations will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        sorted.forEach((messageSet, index) => {
            const card = document.createElement('div');
            card.className = `homepage-history-card${index === 0 ? ' current' : ''}`;
            card.dataset.messageSetId = messageSet.id;

            const timestamp = new Date(messageSet.timestamp);
            const formattedDate = timestamp.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });

            // Count devices and rules
            const deviceCount = messageSet.devices ? messageSet.devices.length : 0;
            const ruleCount = messageSet.devices
                ? messageSet.devices.reduce((sum, d) => sum + (d.rules ? d.rules.length : 0), 0)
                : 0;

            card.innerHTML = `
                <div class="homepage-card-title-row">
                    <span class="homepage-card-name">${messageSet.name}</span>
                    ${index === 0 ? '<span class="homepage-card-badge current">CURRENT</span>' : ''}
                </div>
                <div class="homepage-card-notes">${messageSet.notes || ''}</div>
                <div class="homepage-card-date">${formattedDate}</div>
                <div class="homepage-card-meta">
                    <span class="homepage-card-stat">${deviceCount} devices</span>
                </div>
                <div class="homepage-draft-actions">
                    <button class="btn-duplicate" data-id="${messageSet.id}">Duplicate to Draft</button>
                </div>
            `;

            // Click on card (except duplicate button) to view
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-duplicate')) {
                    document.getElementById('homepage').classList.add('hidden');
                    this.viewMessageSet(messageSet);
                }
            });

            // Duplicate button handler
            card.querySelector('.btn-duplicate').addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateToNewDraft(messageSet);
            });

            container.appendChild(card);
        });
    }

    renderHomepageDrafts() {
        const container = document.getElementById('homepage-drafts-list');

        if (!container) return;

        if (this.drafts.length === 0) {
            container.innerHTML = `
                <div class="homepage-empty-state">
                    <p>No drafts</p>
                    <p class="hint">Click "+ New Draft" to create one, or duplicate from history</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        this.drafts.forEach(draft => {
            const card = document.createElement('div');
            card.className = 'homepage-draft-card';
            card.dataset.draftId = draft.id;

            const createdDate = new Date(draft.created).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });

            const basedOnText = draft.basedOn
                ? `Based on: ${draft.basedOn.name}`
                : 'New configuration';

            // Count rules
            const ruleCount = draft.devices
                ? draft.devices.reduce((sum, d) => sum + (d.rules ? d.rules.length : 0), 0)
                : 0;

            card.innerHTML = `
                <div class="homepage-card-title-row">
                    <span class="homepage-draft-badge">DRAFT</span>
                    <span class="homepage-card-name">${draft.name}</span>
                </div>
                <div class="homepage-draft-based-on">${basedOnText}</div>
                <div class="homepage-card-date">Created: ${createdDate}</div>
                <div class="homepage-draft-actions">
                    <button class="btn-delete" data-id="${draft.id}">Delete</button>
                </div>
            `;

            // Click on card (except delete button) to edit
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-delete')) {
                    document.getElementById('homepage').classList.add('hidden');
                    this.editDraft(draft);
                }
            });

            // Delete button handler
            card.querySelector('.btn-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteDraft(draft.id);
                this.renderHomepageDrafts();
            });

            container.appendChild(card);
        });
    }

    loadDeviceConfigurations() {
        const deviceConfigs = JSON.parse(localStorage.getItem('pcms_device_configs') || '{}');

        // Apply saved sensor associations to devices
        this.data.devices.forEach(device => {
            if (deviceConfigs[device.deviceNumber]) {
                device.associatedSensors = deviceConfigs[device.deviceNumber].associatedSensors;
                device.associatedSensors2 = deviceConfigs[device.deviceNumber].associatedSensors2 || [];
            }
        });
    }

    async loadData() {
        try {
            const data = await fetch('./data/mockdata.json').then(r => r.json());
            //const data = await this.loadDevices();

            // Add backwards-compatible aliases to all devices
            data.devices.forEach(d => {
                d.deviceNumber = d.id;
                d.deviceName = d.name;
            });

            // Split by deviceType
            this.data.devices = data.devices.filter(d => d.deviceType === 'pcms');
            this.data.webBeacons = data.devices.filter(d => d.deviceType === 'webbeacon');
            this.data.sensors = data.sensors;
            this.data.metrics = data.metrics;
        } catch (error) {
            console.error('Error loading data from JSON, using embedded fallback:', error);
            this.loadFallbackData();
        }
    }
    //async loadDevices() {
    //    try {
    //        const response = await fetch(`/LogicSet?handler=LoadDevices&projectId=${encodeURIComponent(ProjectName)}`, {
    //            method: 'GET',
    //            headers: {
    //                'Accept': 'application/json'
    //            }
    //        });

    //        if (!response.ok) {
    //            throw new Error("Server returned " + response.status);
    //        }

    //        const data = await response.json();
    //        console.log("Devices loaded:", data.devices);

    //        //this.devices = data.devices;
    //        return data;
    //    } catch (err) {
    //        console.error("Could not load devices:", err);
    //    }
    //}


    loadFallbackData() {
        // Fallback data for when JSON can't be loaded (e.g., file:// protocol)
        // Helper to add backwards-compatible aliases
        const addAliases = (d) => { d.deviceNumber = d.id; d.deviceName = d.name; return d; };

        this.data.devices = [
            { id: 42, name: "IH35 SB Split PC...", deviceType: "pcms", associatedSensors: [1, 2, 3, 5] },
            { id: 43, name: "IH35 NB PCMS 2", deviceType: "pcms", associatedSensors: [6, 7, 8, 9] },
            { id: 44, name: "IH35 NB PCMS 1", deviceType: "pcms", associatedSensors: [9, 10, 11, 12, 13] },
            { id: 45, name: "IH410 PCMS 2", deviceType: "pcms", associatedSensors: [14, 15, 16, 17] },
            { id: 46, name: "IH410 PCMS 1", deviceType: "pcms", associatedSensors: [17, 18, 19, 20, 21] },
            { id: 47, name: "1604 EB PCMS 2", deviceType: "pcms", associatedSensors: [22, 23, 24, 25] },
            { id: 48, name: "1604 EB PCMS 1", deviceType: "pcms", associatedSensors: [21, 25, 26, 27, 28, 29] }
        ].map(addAliases);

        this.data.webBeacons = [
            { id: 101, name: "1604 EB Web Beacon 2", deviceType: "webbeacon", associatedSensors: [22, 23, 24, 25] },
            { id: 102, name: "1604 EB Web Beacon 1", deviceType: "webbeacon", associatedSensors: [21, 25, 26, 27, 28, 29] },
            { id: 103, name: "IH35 SB Web Beacon 2", deviceType: "webbeacon", associatedSensors: [30, 31, 32, 33] }
        ].map(addAliases);

        this.data.sensors = [
            { id: 1, name: "SB IH35 Split S1" },
            { id: 2, name: "SB IH35 Split S2" },
            { id: 3, name: "SB IH35 Split S3" },
            { id: 5, name: "SB IH35 Split S4" },
            { id: 6, name: "NB IH35 S8" },
            { id: 7, name: "NB IH35 S7" },
            { id: 8, name: "NB IH35 S6" },
            { id: 9, name: "NB IH35 S5" },
            { id: 10, name: "NB IH35 S4" },
            { id: 11, name: "NB IH35 S3" },
            { id: 12, name: "NB IH35 S2" },
            { id: 13, name: "NB IH35 S1" },
            { id: 14, name: "IH410 S8" },
            { id: 15, name: "IH410 S7" },
            { id: 16, name: "IH410 S6" },
            { id: 17, name: "IH410 S5" },
            { id: 18, name: "IH410 S4" },
            { id: 19, name: "IH410 S3" },
            { id: 20, name: "IH410 S2" },
            { id: 21, name: "IH410 S1" },
            { id: 22, name: "EB 1604 S8" },
            { id: 23, name: "EB 1604 S7" },
            { id: 24, name: "EB 1604 S6" },
            { id: 25, name: "EB 1604 S5" }
        ];

        this.data.metrics = [
            { id: 1, name: "Speed", value: "speed" },
            { id: 2, name: "Travel Time", value: "travel_time" },
            { id: 3, name: "Speed (+ Bluetooth)", value: "bt_speed" },
            { id: 4, name: "Bluetooth Travel Time", value: "bt_travel_time" },
            { id: 5, name: "Lowest Speed at Any Sensor", value: "speed_any" }
        ];

        console.log('Loaded fallback data:', this.data.devices.length, 'devices,', this.data.webBeacons.length, 'web beacons,', this.data.sensors.length, 'sensors');
    }

    setupEventListeners() {
        // Device list will be handled by individual button clicks (set in populateDeviceList)

        // Add rule button
        document.getElementById('add-rule-btn').addEventListener('click', () => {
            this.addRule();
        });

        // Developer mode toggle
        document.getElementById('dev-mode-toggle').addEventListener('click', () => {
            this.toggleDevMode();
        });

        // PCMS code toggle (replaces the old "threshold first" checkbox)
        const pcmsCodeToggle = document.getElementById('pcms-code-toggle');
        if (pcmsCodeToggle) {
            pcmsCodeToggle.checked = this.devMode;
            pcmsCodeToggle.addEventListener('change', () => {
                this.toggleDevMode();
            });
        }

        // Show Sensors for Second Travel Time toggle
        const showSensors2Toggle = document.getElementById('show-sensors-2-toggle');
        if (showSensors2Toggle) {
            showSensors2Toggle.checked = this.showSensorsForSecondTravelTime;
            this.applySecondSensorsVisibility();
            showSensors2Toggle.addEventListener('change', (e) => {
                // Hide attempt while list 2 still has sensors: defer to the bulk-removal
                // modal, which lets the user clear sensors (and any referencing rules) in
                // one pass. The toggle is reverted to checked until that flow resolves.
                if (!e.target.checked) {
                    const list2 = (this.currentDevice && this.currentDevice.associatedSensors2) || [];
                    if (list2.length > 0) {
                        e.target.checked = true;
                        this.openSensorBulkRemovalModal();
                        return;
                    }
                }
                this.showSensorsForSecondTravelTime = e.target.checked;
                this.applySecondSensorsVisibility();
                // The PCMS Travel Time 2 / Delay Time 2 pills are gated on this flag inside
                // renderPcmsPill, so re-render the rule cards so they appear/disappear in
                // unison with the toggle.
                this.renderRules();
            });
        }

        // Section tab switching (Logic only now, fallback is inline)
        document.querySelectorAll('.section-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.classList.contains('disabled')) return;
                const targetTab = tab.dataset.tab;
                document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('#device-edit-view > .tab-content').forEach(panel => {
                    panel.classList.toggle('active', panel.id === `${targetTab}-tab`);
                });
            });
        });
    }

    populateDeviceList() {
        const container = document.getElementById('device-list');
        container.innerHTML = '';

        this.data.devices.forEach(device => {
            const button = document.createElement('button');
            button.className = 'device-item';
            button.textContent = device.deviceName;
            button.dataset.deviceId = device.deviceNumber;
            button.addEventListener('click', () => {
                // If viewing history, scroll to and expand the device accordion
                if (this.viewingMessageSet) {
                    this.scrollToHistoryDevice(device.deviceNumber);
                } else if (this.isDraftMode) {
                    // Check if we're in the overview or device edit view
                    const overview = document.getElementById('draft-overview');
                    if (overview && !overview.classList.contains('hidden')) {
                        this.scrollToDraftDevice(device.deviceNumber);
                    } else {
                        this.selectDevice(device.deviceNumber);
                    }
                } else {
                    this.selectDevice(device.deviceNumber);
                }
            });
            container.appendChild(button);
        });

        // Populate web beacons list
        this.populateWebBeaconList();

        // Populate main device selector dropdown
        this.populateMainDeviceSelect();
    }

    populateWebBeaconList() {
        const container = document.getElementById('web-beacon-list');
        if (!container) return;
        container.innerHTML = '';

        this.data.webBeacons.forEach(beacon => {
            const button = document.createElement('button');
            button.className = 'device-item web-beacon-item';
            button.textContent = beacon.name;
            button.dataset.deviceId = beacon.id;
            button.addEventListener('click', () => {
                if (this.viewingMessageSet) {
                    // TODO: scroll to beacon in history view
                } else if (this.isDraftMode) {
                    const overview = document.getElementById('draft-overview');
                    if (overview && !overview.classList.contains('hidden')) {
                        this.scrollToDraftDevice(beacon.id);
                    } else {
                        this.selectDevice(beacon.id, 'webbeacon');
                    }
                } else {
                    this.selectDevice(beacon.id, 'webbeacon');
                }
            });
            container.appendChild(button);
        });
    }

    // Scroll to and expand/collapse a device in the history view
    scrollToHistoryDevice(deviceNumber) {
        const container = document.getElementById('version-devices-content');
        if (!container) return;

        const deviceCards = container.querySelectorAll('.history-device-card');
        const device = this.data.devices.find(d => d.deviceNumber === deviceNumber);
        if (!device) return;

        let targetCard = null;

        // Find the matching card
        deviceCards.forEach(card => {
            const deviceName = card.querySelector('.history-device-name');
            if (deviceName && deviceName.textContent === device.deviceName) {
                targetCard = card;
            }
        });

        if (!targetCard) return;

        const content = targetCard.querySelector('.history-device-content');
        const chevron = targetCard.querySelector('.history-device-chevron');
        const isCurrentlyCollapsed = content && content.classList.contains('collapsed');

        // Check if this device is already active (clicked again)
        const deviceItem = document.querySelector(`.device-item[data-device-id="${deviceNumber}"]`);
        const isAlreadyActive = deviceItem && deviceItem.classList.contains('active');

        if (isAlreadyActive && !isCurrentlyCollapsed) {
            // Toggle: collapse if already expanded and active
            if (content) content.classList.add('collapsed');
            if (chevron) chevron.style.transform = 'rotate(0deg)';

            // Remove active state
            document.querySelectorAll('.device-item').forEach(item => {
                item.classList.remove('active');
            });
            return;
        }

        // Expand this device
        if (content) content.classList.remove('collapsed');
        if (chevron) chevron.style.transform = 'rotate(180deg)';

        // Update active state in device list
        document.querySelectorAll('.device-item').forEach(item => {
            item.classList.remove('active');
            if (parseInt(item.dataset.deviceId) === deviceNumber) {
                item.classList.add('active');
            }
        });

        // Check if card is in viewport - container itself is the scroll container
        const containerRect = container.getBoundingClientRect();
        const cardRect = targetCard.getBoundingClientRect();

        const isInView = cardRect.top >= containerRect.top &&
            cardRect.bottom <= containerRect.bottom;

        if (!isInView) {
            // Snap scroll (instant) to bring card into view
            const headerOffset = 16;
            const scrollTop = container.scrollTop + (cardRect.top - containerRect.top - headerOffset);

            container.scrollTop = scrollTop; // Direct assignment for instant snap
        }

        // Highlight briefly
        targetCard.classList.add('highlighted');
        setTimeout(() => targetCard.classList.remove('highlighted'), 2000);
    }

    populateMainDeviceSelect() {
        const select = document.getElementById('main-device-select');
        if (!select) return;

        select.innerHTML = '<option value="">Select Device...</option>';

        // PCMS Devices
        const pcmsGroup = document.createElement('optgroup');
        pcmsGroup.label = 'PCMS Devices';
        this.data.devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceNumber;
            option.textContent = device.deviceName;
            option.dataset.type = 'pcms';
            pcmsGroup.appendChild(option);
        });
        select.appendChild(pcmsGroup);

        // Web Beacons
        if (this.data.webBeacons.length > 0) {
            const wbGroup = document.createElement('optgroup');
            wbGroup.label = 'Web Beacons';
            this.data.webBeacons.forEach(beacon => {
                const option = document.createElement('option');
                option.value = beacon.id;
                option.textContent = beacon.name;
                option.dataset.type = 'webbeacon';
                wbGroup.appendChild(option);
            });
            select.appendChild(wbGroup);
        }

        // Add change listener
        select.addEventListener('change', (e) => {
            if (e.target.value) {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const type = selectedOption.dataset.type || 'pcms';
                this.selectDevice(parseInt(e.target.value), type);
            } else {
                this.selectDevice(null);
            }
        });
    }

    updateMainDeviceSelect() {
        const select = document.getElementById('main-device-select');
        if (!select) return;

        if (this.currentDevice) {
            select.value = this.currentDevice.deviceNumber;
        } else {
            select.value = '';
        }
    }

    // Sensors Accordion Methods
    setupSensorsAccordionListeners() {
        [1, 2, 3].forEach(n => {
            const toggle = document.getElementById(`sensors-accordion-${n}-toggle`);
            if (toggle) {
                toggle.addEventListener('click', () => this.toggleSensorsAccordion(n));
            }
        });
    }

    toggleSensorsAccordion(n) {
        const content = document.getElementById(`sensors-accordion-${n}-content`);
        const accordion = document.getElementById(`sensors-accordion-${n}`);
        if (!content || !accordion) return;

        const chevron = accordion.querySelector('.sensors-accordion-chevron');
        const isCollapsed = content.classList.contains('collapsed');
        content.classList.toggle('collapsed', !isCollapsed);
        this.sensorsAccordionExpanded[n] = isCollapsed;

        if (chevron) {
            chevron.style.transform = isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        this.renderSensorsAccordion();
    }

    applySecondSensorsVisibility() {
        const accordion2 = document.getElementById('sensors-accordion-2');
        if (!accordion2) return;
        accordion2.classList.toggle('hidden', !this.showSensorsForSecondTravelTime);
    }

    openSensorBulkRemovalModal() {
        if (!this.currentDevice) return;
        const list2 = this.currentDevice.associatedSensors2 || [];
        if (list2.length === 0) return;

        const container = document.getElementById('sensor-bulk-removal-list');
        if (container) {
            container.innerHTML = list2.map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                if (!sensor) return '';
                const rulesUsing = this.getRulesUsingSensor(sensorId);
                return this.renderSensorBulkGroup(sensor, rulesUsing);
            }).join('');
        }

        // Keep the visible accordion state consistent (the toggle was snapped back).
        this.renderSensorsAccordion();

        const modal = document.getElementById('sensor-bulk-removal-modal');
        if (modal) modal.classList.remove('hidden');
    }

    renderSensorBulkGroup(sensor, rulesUsing) {
        const hasRules = rulesUsing.length > 0;
        const count = rulesUsing.length;
        const countLabel = hasRules
            ? `<span class="sensor-bulk-rule-count">${count} rule${count === 1 ? '' : 's'}</span>`
            : `<span class="sensor-bulk-rule-count sensor-bulk-rule-count-empty">No rules</span>`;

        if (hasRules) {
            const rulesHtml = rulesUsing.map(rule => {
                const globalIndex = this.rules.indexOf(rule);
                const ruleNumber = globalIndex >= 0 ? globalIndex + 1 : '?';
                return `
                    <label class="sensor-removal-rule-item">
                        <span class="sensor-removal-rule-left">
                            <input type="checkbox" class="sensor-bulk-rule-checkbox" data-sensor-id="${sensor.id}" data-rule-index="${globalIndex}">
                            <span class="sensor-removal-rule-number">#${ruleNumber}</span>
                        </span>
                        <span class="sensor-removal-rule-text">${this.renderRuleSummaryForRemoval(rule, sensor.id)}</span>
                    </label>
                `;
            }).join('');
            return `
                <div class="sensor-bulk-group" data-sensor-id="${sensor.id}">
                    <div class="sensor-bulk-group-header">
                        <span class="sensor-bulk-sensor-name">${sensor.name}</span>
                        ${countLabel}
                    </div>
                    <div class="sensor-bulk-rules-list">${rulesHtml}</div>
                </div>
            `;
        }

        // Sensor has no rules — a single sensor-level checkbox drives the removal.
        return `
            <div class="sensor-bulk-group sensor-bulk-group-norules" data-sensor-id="${sensor.id}">
                <label class="sensor-bulk-group-header sensor-bulk-sensor-row">
                    <input type="checkbox" class="sensor-bulk-sensor-checkbox" data-sensor-id="${sensor.id}">
                    <span class="sensor-bulk-sensor-name">${sensor.name}</span>
                    ${countLabel}
                </label>
            </div>
        `;
    }

    toggleSensorBulkAll(checked) {
        document.querySelectorAll('#sensor-bulk-removal-list .sensor-bulk-rule-checkbox, #sensor-bulk-removal-list .sensor-bulk-sensor-checkbox')
            .forEach(cb => { cb.checked = !!checked; });
    }

    closeSensorBulkRemovalModal() {
        const modal = document.getElementById('sensor-bulk-removal-modal');
        if (modal) modal.classList.add('hidden');
        // The hide attempt was abandoned — the toggle already snapped back to checked.
    }

    confirmSensorBulkRemoval() {
        if (!this.currentDevice) { this.closeSensorBulkRemovalModal(); return; }

        // 1. Clear sensor references from every checked rule-row.
        document.querySelectorAll('#sensor-bulk-removal-list .sensor-bulk-rule-checkbox:checked').forEach(cb => {
            const sensorId = Number(cb.dataset.sensorId);
            const ruleIdx = parseInt(cb.dataset.ruleIndex, 10);
            const rule = this.rules[ruleIdx];
            if (rule) this.removeSensorFromRule(rule, sensorId);
        });

        // 2. Decide which sensors leave list 2:
        //    - "No-rules" sensors: leave iff their sensor-level checkbox was checked.
        //    - "Has-rules" sensors: leave iff they now have zero remaining rule usage
        //      (i.e. the user cleared every rule that referenced them).
        const list2 = this.currentDevice.associatedSensors2 || [];
        const noRulesCheckedIds = new Set(
            Array.from(document.querySelectorAll('#sensor-bulk-removal-list .sensor-bulk-sensor-checkbox:checked'))
                .map(cb => Number(cb.dataset.sensorId))
        );
        const toRemove = [];
        list2.forEach(sensorId => {
            const stillUsed = this.getRulesUsingSensor(sensorId).length > 0;
            if (stillUsed) return;
            const sensorCheckbox = document.querySelector(`#sensor-bulk-removal-list .sensor-bulk-sensor-checkbox[data-sensor-id="${sensorId}"]`);
            if (sensorCheckbox) {
                if (noRulesCheckedIds.has(sensorId)) toRemove.push(sensorId);
            } else {
                // Sensor was in the "has-rules" bucket and now has none left → removed.
                toRemove.push(sensorId);
            }
        });

        toRemove.forEach(id => {
            const idx = list2.indexOf(id);
            if (idx !== -1) list2.splice(idx, 1);
        });

        this.saveToLocalStorage();
        this.saveDeviceConfiguration();

        // 3. If list 2 is now empty, complete the hide. Otherwise keep the toggle on.
        const toggle = document.getElementById('show-sensors-2-toggle');
        if (list2.length === 0) {
            this.showSensorsForSecondTravelTime = false;
            if (toggle) toggle.checked = false;
            this.applySecondSensorsVisibility();
        } else if (toggle) {
            toggle.checked = true;
        }

        this.renderRules();
        this.renderSensorsAccordion();

        const modal = document.getElementById('sensor-bulk-removal-modal');
        if (modal) modal.classList.add('hidden');
    }

    /** Returns the sensor id list backing a given accordion. */
    getAccordionSensorList(n) {
        if (!this.currentDevice) return [];
        if (n === 2) {
            if (!Array.isArray(this.currentDevice.associatedSensors2)) {
                this.currentDevice.associatedSensors2 = [];
            }
            return this.currentDevice.associatedSensors2;
        }
        if (!Array.isArray(this.currentDevice.associatedSensors)) {
            this.currentDevice.associatedSensors = [];
        }
        return this.currentDevice.associatedSensors;
    }

    renderSensorsAccordion() {
        [1, 2, 3].forEach(n => this.renderSingleAccordion(n));
    }

    renderSingleAccordion(n) {
        const container = document.getElementById(`sensors-accordion-${n}-list`);
        const summaryEl = document.getElementById(`sensors-accordion-${n}-summary`);
        if (!container || !summaryEl) return;

        if (!this.currentDevice) {
            summaryEl.textContent = 'No device selected';
            container.innerHTML = '';
            return;
        }

        const isBluetoothAccordion = n === 3;
        const backingList = this.getAccordionSensorList(isBluetoothAccordion ? 1 : n);

        const availableSensors = [...this.data.sensors]
            .filter(s => isBluetoothAccordion ? s.isBluetooth : !s.isBluetooth)
            .sort((a, b) => a.name.localeCompare(b.name));

        const selectedHere = backingList
            .map(id => availableSensors.find(s => s.id === id))
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (selectedHere.length === 0) {
            summaryEl.innerHTML = isBluetoothAccordion
                ? '<span class="no-sensors-text">No routes selected</span>'
                : '<span class="no-sensors-text">No sensors selected</span>';
        } else {
            summaryEl.innerHTML = selectedHere
                .map(s => `<span class="sensor-summary-pill${isBluetoothAccordion ? ' sensor-summary-pill-bt' : ''}">${s.name}</span>`)
                .join('');
        }

        const expanded = this.sensorsAccordionExpanded[n];
        if (!expanded) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = '';

        const btSelectedCount = isBluetoothAccordion ? backingList.filter(id => {
            const s = this.data.sensors.find(sen => sen.id === id);
            return s && s.isBluetooth;
        }).length : 0;

        availableSensors.forEach(sensor => {
            const isChecked = backingList.includes(sensor.id);
            const atLimit = isBluetoothAccordion && btSelectedCount >= 3 && !isChecked;
            const item = document.createElement('label');
            item.className = 'sensor-checkbox-item'
                + (isBluetoothAccordion ? ' sensor-checkbox-item-bt' : '')
                + (atLimit ? ' sensor-checkbox-disabled' : '');
            item.innerHTML = `
                <input type="checkbox" ${isChecked ? 'checked' : ''} ${atLimit ? 'disabled' : ''} data-sensor-id="${sensor.id}">
                <span>${sensor.name}</span>
            `;
            item.querySelector('input').addEventListener('change', () => {
                this.toggleSensorFromAccordion(sensor.id, n);
            });
            container.appendChild(item);
        });

        if (isBluetoothAccordion && btSelectedCount >= 3) {
            const limitMsg = document.createElement('div');
            limitMsg.className = 'bt-limit-message';
            limitMsg.textContent = 'Maximum of 3 Bluetooth routes per device';
            container.appendChild(limitMsg);
        }
    }

    toggleSensorFromAccordion(sensorId, accordionN = 1) {
        if (!this.currentDevice) return;

        const list = this.getAccordionSensorList(accordionN === 3 ? 1 : accordionN);
        const index = list.indexOf(sensorId);
        if (index !== -1) {
            // User is unchecking a sensor. If it's referenced by any rule, prompt
            // the user to clear it from those rules first; only commit the removal
            // from the accordion if no rule usage remains after the modal flow.
            const rulesUsing = this.getRulesUsingSensor(sensorId);
            if (rulesUsing.length > 0) {
                this.openSensorRemovalModal(sensorId, accordionN);
                return;
            }
            list.splice(index, 1);
        } else {
            // Enforce max 3 Bluetooth routes per device (only on the bluetooth accordion's backing list)
            const sensor = this.data.sensors.find(s => s.id === sensorId);
            if (sensor && sensor.isBluetooth) {
                const btCount = list.filter(id => {
                    const s = this.data.sensors.find(sen => sen.id === id);
                    return s && s.isBluetooth;
                }).length;
                if (btCount >= 3) return;
            }
            list.push(sensorId);
        }

        this.saveDeviceConfiguration();
        this.renderSensorsAccordion();
        this.renderRules();
    }

    /** Returns every rule on the current device that references sensorId (via rule.sensor or any pill). */
    getRulesUsingSensor(sensorId) {
        return (this.rules || []).filter(rule => this.ruleUsesSensor(rule, sensorId));
    }

    ruleUsesSensor(rule, sensorId) {
        if (rule.sensor != null && rule.sensor !== '' && rule.sensor == sensorId) return true;
        if (rule.btPills) {
            for (const key of ['screen1', 'screen2']) {
                const arr = rule.btPills[key] || [];
                for (const pill of arr) {
                    if (pill && pill.sensorId != null && pill.sensorId == sensorId) return true;
                }
            }
        }
        return false;
    }

    /** Clears every reference to sensorId on a single rule (rule.sensor + any pills). */
    removeSensorFromRule(rule, sensorId) {
        if (rule.sensor != null && rule.sensor == sensorId) {
            rule.sensor = '';
        }
        if (rule.btPills) {
            for (const key of ['screen1', 'screen2']) {
                const arr = rule.btPills[key];
                if (!Array.isArray(arr)) continue;
                for (let i = 0; i < arr.length; i++) {
                    if (arr[i] && arr[i].sensorId != null && arr[i].sensorId == sensorId) {
                        arr[i] = null;
                    }
                }
            }
        }
    }

    openSensorRemovalModal(sensorId, accordionN) {
        const sensor = this.data.sensors.find(s => s.id === sensorId);
        if (!sensor) return;

        const rulesUsing = this.getRulesUsingSensor(sensorId);
        this.pendingSensorRemoval = { sensorId, accordionN };

        const listEl = document.getElementById('sensor-removal-rule-list');
        if (listEl) {
            listEl.innerHTML = rulesUsing.map(rule => {
                const globalIndex = this.rules.indexOf(rule);
                const ruleNumber = globalIndex >= 0 ? globalIndex + 1 : '?';
                return `
                    <label class="sensor-removal-rule-item">
                        <span class="sensor-removal-rule-left">
                            <input type="checkbox" class="sensor-removal-rule-checkbox" data-rule-index="${globalIndex}">
                            <span class="sensor-removal-rule-number">#${ruleNumber}</span>
                        </span>
                        <span class="sensor-removal-rule-text">${this.renderRuleSummaryForRemoval(rule, sensorId)}</span>
                    </label>
                `;
            }).join('');
        }

        // Re-render accordions so the checkbox visually reverts until the user confirms/cancels.
        this.renderSensorsAccordion();

        const modal = document.getElementById('sensor-removal-modal');
        if (modal) modal.classList.remove('hidden');
    }

    renderRuleSummaryForRemoval(rule, sensorId) {
        const metric = this.data.metrics.find(m => m.id == rule.metric);
        const metricName = metric ? metric.name : 'Unknown metric';

        let unitText = '';
        if (metric) {
            if (metric.value.includes('speed')) unitText = 'MPH';
            else if (metric.value.includes('travel_time')) unitText = 'minutes';
            else unitText = 'vehicles/minute';
        }

        const conditionText = rule.operator === 'less' ? 'less than' : 'greater than';
        const thresholdText = rule.threshold !== '' && rule.threshold != null ? rule.threshold : '?';

        let sensorPill = '';
        if (metric && (metric.value.includes('_any') || metric.value.includes('_all'))) {
            sensorPill = `<span class="pill pill-sensor">${metric.value.includes('_any') ? 'Any Sensor' : 'All Sensors'}</span>`;
        } else if (rule.sensor) {
            const ruleSensor = this.data.sensors.find(s => s.id == rule.sensor);
            if (ruleSensor) {
                const highlight = ruleSensor.id == sensorId ? ' sensor-removal-sensor-highlight' : '';
                sensorPill = `<span class="pill pill-sensor${highlight}">${ruleSensor.name}</span>`;
            }
        }

        const screen1Text = (rule.screen1 || []).filter(l => l).join(' | ') || '-';
        const screen2Text = (rule.screen2 || []).filter(l => l).join(' | ') || '-';
        const displayText = rule.sameAsScreen1 ? screen1Text : `${screen1Text} → ${screen2Text}`;

        return `
            <span class="sensor-removal-rule-word">If</span>
            <span class="pill pill-metric">${metricName}</span>
            ${sensorPill}
            <span class="sensor-removal-rule-word">is ${conditionText}</span>
            <span class="pill pill-condition">${thresholdText} ${unitText}</span>
            <span class="sensor-removal-rule-word">then</span>
            <span class="sensor-removal-rule-display">${displayText}</span>
        `;
    }

    toggleSensorRemovalAllCheckboxes(checked) {
        document.querySelectorAll('.sensor-removal-rule-checkbox').forEach(cb => {
            cb.checked = !!checked;
        });
    }

    closeSensorRemovalModal() {
        const modal = document.getElementById('sensor-removal-modal');
        if (modal) modal.classList.add('hidden');
        this.pendingSensorRemoval = null;
        this.renderSensorsAccordion();
    }

    confirmSensorRemoval() {
        if (!this.pendingSensorRemoval) {
            this.closeSensorRemovalModal();
            return;
        }
        const { sensorId, accordionN } = this.pendingSensorRemoval;

        const checked = document.querySelectorAll('.sensor-removal-rule-checkbox:checked');
        checked.forEach(cb => {
            const idx = parseInt(cb.dataset.ruleIndex, 10);
            const rule = this.rules[idx];
            if (rule) this.removeSensorFromRule(rule, sensorId);
        });

        this.saveToLocalStorage();
        this.renderRules();
        if (typeof this.updateDevOutput === 'function') this.updateDevOutput();

        // If no rule still references the sensor, commit the accordion removal.
        if (this.getRulesUsingSensor(sensorId).length === 0) {
            const list = this.getAccordionSensorList(accordionN === 3 ? 1 : accordionN);
            const idx = list.indexOf(sensorId);
            if (idx !== -1) list.splice(idx, 1);
            this.saveDeviceConfiguration();
        }

        const modal = document.getElementById('sensor-removal-modal');
        if (modal) modal.classList.add('hidden');
        this.pendingSensorRemoval = null;

        this.renderSensorsAccordion();
    }

    selectDevice(deviceNumber, deviceType = 'pcms') {
        if (!deviceNumber) {
            this.currentDevice = null;
            this.currentDeviceType = 'pcms';
            document.getElementById('add-rule-btn').disabled = true;
            this.rules = [];
            this.fallbackMessage = { screen1: ['', '', ''], screen2: ['', '', ''], sameAsScreen1: false };
            this.renderRules();
            this.renderSensorsAccordion();
            this.updateFallbackTabState();
            this.updateMainDeviceSelect();
            // Update device list panel
            document.querySelectorAll('.device-item').forEach(item => {
                item.classList.remove('active');
            });
            return;
        }

        this.currentDeviceType = deviceType;

        // Look up from the appropriate list (both have unified property names)
        if (deviceType === 'webbeacon') {
            this.currentDevice = this.data.webBeacons.find(b => b.id == deviceNumber);
        } else {
            this.currentDevice = this.data.devices.find(d => d.deviceNumber == deviceNumber);
        }
        if (!this.currentDevice) return;

        // Update main device dropdown
        this.updateMainDeviceSelect();

        // Update active state in device list panel
        document.querySelectorAll('.device-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.deviceId == deviceNumber) {
                item.classList.add('active');
            }
        });

        // Load rules for this device
        const savedRules = this.loadDeviceRules(deviceNumber);
        this.rules = savedRules.length > 0 ? savedRules : [];

        // Load fallback message for this device
        this.fallbackMessage = this.loadFallbackMessage(deviceNumber);

        document.getElementById('add-rule-btn').disabled = false;

        this.renderRules();
        this.renderSensorsAccordion();
        this.updateFallbackTabState();
    }

    saveDeviceConfiguration() {
        const deviceConfigs = JSON.parse(localStorage.getItem('pcms_device_configs') || '{}');
        deviceConfigs[this.currentDevice.deviceNumber] = {
            associatedSensors: this.currentDevice.associatedSensors,
            associatedSensors2: this.currentDevice.associatedSensors2 || []
        };
        localStorage.setItem('pcms_device_configs', JSON.stringify(deviceConfigs));
    }

    loadDeviceConfiguration(deviceNumber) {
        const deviceConfigs = JSON.parse(localStorage.getItem('pcms_device_configs') || '{}');
        return deviceConfigs[deviceNumber] || null;
    }

    addRule() {
        const rule = {
            id: this.ruleIdCounter++,
            metric: '',
            sensor: '',
            operator: 'less',
            threshold: '',
            screen1: ['', '', ''],
            screen2: ['', '', ''],
            sameAsScreen1: false,
            outputType: this.currentDeviceType === 'webbeacon' ? 'flash' : 'message',
            btPills: { screen1: [null, null, null], screen2: [null, null, null] }
        };

        this.rules.push(rule);
        this.renderRules();
        this.saveToLocalStorage();
        this.updateFallbackTabState();
    }

    duplicateRule(ruleId) {
        const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
        if (ruleIndex === -1) return;

        const originalRule = this.rules[ruleIndex];

        // Create a deep copy of the rule with a new ID
        const originalPills = originalRule.btPills || { screen1: [null, null, null], screen2: [null, null, null] };
        const duplicatedRule = {
            id: this.ruleIdCounter++,
            metric: originalRule.metric,
            sensor: originalRule.sensor,
            operator: originalRule.operator,
            threshold: originalRule.threshold,
            screen1: [...originalRule.screen1],
            screen2: [...originalRule.screen2],
            sameAsScreen1: originalRule.sameAsScreen1,
            outputType: originalRule.outputType || 'message',
            btPills: {
                screen1: originalPills.screen1.map(p => p ? { ...p } : null),
                screen2: originalPills.screen2.map(p => p ? { ...p } : null)
            }
        };

        // Insert the duplicated rule right after the original
        this.rules.splice(ruleIndex + 1, 0, duplicatedRule);
        this.renderRules();
        this.saveToLocalStorage();
    }

    deleteRule(ruleId) {
        this.rules = this.rules.filter(r => r.id !== ruleId);
        this.renderRules();
        this.saveToLocalStorage();
        this.updateFallbackTabState();
    }

    moveRule(ruleId, direction) {
        const index = this.rules.findIndex(r => r.id === ruleId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= this.rules.length) return;

        const container = document.getElementById('rules-container');
        const slots = container.querySelectorAll('.rule-slot');
        const currentSlot = slots[index];
        const targetSlot = slots[newIndex];

        const currentCard = currentSlot.querySelector('.rule-card');
        const targetCard = targetSlot.querySelector('.rule-card');

        // Get positions for animation
        const currentRect = currentCard.getBoundingClientRect();
        const targetRect = targetCard.getBoundingClientRect();
        const deltaY = targetRect.top - currentRect.top;

        // Add animating class to prevent pointer events
        currentCard.classList.add('animating');
        targetCard.classList.add('animating');

        // Animate current card to target position
        currentCard.style.transform = `translateY(${deltaY}px)`;
        currentCard.style.zIndex = '10';

        // Animate target card to current position
        targetCard.style.transform = `translateY(${-deltaY}px)`;
        targetCard.style.zIndex = '5';

        // After animation, swap the actual data and re-render
        setTimeout(() => {
            // Swap rules in data
            [this.rules[index], this.rules[newIndex]] = [this.rules[newIndex], this.rules[index]];
            this.saveToLocalStorage();

            // Re-render without animation classes
            this.renderRules();
        }, 250);
    }

    renderRules() {
        const container = document.getElementById('rules-container');

        if (this.rules.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Click "Add Rule" to create your first logic rule</p></div>';
            this.updateDevOutput();
            return;
        }

        container.innerHTML = '';

        this.rules.forEach((rule, index) => {
            // Create slot wrapper with drag handle and number
            const slot = document.createElement('div');
            slot.className = 'rule-slot';
            slot.draggable = true;
            slot.dataset.ruleId = rule.id;
            slot.dataset.index = index;

            // Drag handle with grippy icon
            const dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';
            dragHandle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                    <path d="M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z"/>
                </svg>
            `;
            slot.appendChild(dragHandle);

            // Slot number badge
            const slotNumber = document.createElement('div');
            slotNumber.className = 'slot-number';
            slotNumber.textContent = index + 1;
            slot.appendChild(slotNumber);

            const ruleComponent = new RuleComponent(rule, index + 1, this);
            const ruleElement = ruleComponent.render();
            slot.appendChild(ruleElement);
            container.appendChild(slot);

            // Drag event listeners
            slot.addEventListener('dragstart', (e) => this.handleDragStart(e, slot));
            slot.addEventListener('dragend', (e) => this.handleDragEnd(e, slot));
            slot.addEventListener('dragover', (e) => this.handleDragOver(e, slot));
            slot.addEventListener('dragenter', (e) => this.handleDragEnter(e, slot));
            slot.addEventListener('dragleave', (e) => this.handleDragLeave(e, slot));
            slot.addEventListener('drop', (e) => this.handleDrop(e, slot));
        });

        this.updateDevOutput();
    }

    // Drag and Drop handlers for rule reordering.
    // Ignore drags that carry 'application/bt-pill' — those belong to the
    // BT pill system inside RuleComponent and must not trigger slot reorder.

    _isBtPillDrag(e) {
        return e.dataTransfer.types.includes('application/bt-pill');
    }

    handleDragStart(e, slot) {
        if (this._isBtPillDrag(e)) return;
        this.draggedSlot = slot;
        slot.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', slot.dataset.ruleId);
    }

    handleDragEnd(e, slot) {
        slot.classList.remove('dragging');
        document.querySelectorAll('.rule-slot').forEach(s => {
            s.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });
        this.draggedSlot = null;
    }

    handleDragOver(e, slot) {
        if (this._isBtPillDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e, slot) {
        if (this._isBtPillDrag(e)) return;
        e.preventDefault();
        if (slot !== this.draggedSlot) {
            slot.classList.add('drag-over');
        }
    }

    handleDragLeave(e, slot) {
        // Only remove if actually leaving the slot (not entering a child)
        if (!slot.contains(e.relatedTarget)) {
            slot.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        }
    }

    handleDrop(e, slot) {
        if (this._isBtPillDrag(e)) return;
        e.preventDefault();
        if (slot === this.draggedSlot) return;

        const fromIndex = parseInt(this.draggedSlot.dataset.index);
        const toIndex = parseInt(slot.dataset.index);

        // Reorder the rules array
        const [movedRule] = this.rules.splice(fromIndex, 1);
        this.rules.splice(toIndex, 0, movedRule);

        this.saveToLocalStorage();
        this.renderRules();
    }

    // ========================================
    // FALLBACK MESSAGE TAB
    // ========================================

    deviceHasBluetoothRule() {
        return this.rules.some(rule => {
            const metric = this.data.metrics.find(m => m.id == rule.metric);
            return metric && metric.value.startsWith('bt_');
        });
    }

    updateFallbackTabState() {
        const section = document.getElementById('fallback-section');
        if (!section) return;

        const hasBt = this.deviceHasBluetoothRule();

        if (hasBt) {
            section.classList.remove('hidden');
            this.renderFallbackTab();
        } else {
            section.classList.add('hidden');
        }
    }

    updateFallbackHeaderStyle() {
        const header = document.querySelector('.fallback-section-header');
        if (!header) return;
        const fb = this.fallbackMessage;
        const hasContent = [
            ...(fb.screen1 || []),
            ...(fb.sameAsScreen1 ? [] : (fb.screen2 || []))
        ].some(v => v && v.trim().length > 0);
        header.classList.toggle('fallback-filled', hasContent);
    }

    loadFallbackMessage(deviceNumber) {
        const saved = localStorage.getItem(`device_${deviceNumber}`);
        if (!saved) return { screen1: ['', '', ''], screen2: ['', '', ''], sameAsScreen1: false };
        try {
            const data = JSON.parse(saved);
            return data.fallbackMessage || { screen1: ['', '', ''], screen2: ['', '', ''], sameAsScreen1: false };
        } catch (e) {
            return { screen1: ['', '', ''], screen2: ['', '', ''], sameAsScreen1: false };
        }
    }

    renderFallbackTab() {
        const container = document.getElementById('fallback-content');
        if (!container) return;

        const fb = this.fallbackMessage;
        const s1 = fb.screen1 || ['', '', ''];
        const s2 = fb.sameAsScreen1 ? s1 : (fb.screen2 || ['', '', '']);

        container.innerHTML = `
            <p class="fallback-hint">This message displays when no Bluetooth conditions are met (out-of-bounds scenario).</p>
            <div class="fallback-card-body">
                <div class="fallback-preview-row">
                    <div class="fallback-preview">
                        <span class="fallback-preview-screen-label">Screen 1</span>
                        <span class="fallback-preview-line">${s1[0] || '\u00A0'}</span>
                        <span class="fallback-preview-line">${s1[1] || '\u00A0'}</span>
                        <span class="fallback-preview-line">${s1[2] || '\u00A0'}</span>
                    </div>
                    <div class="fallback-preview">
                        <span class="fallback-preview-screen-label">Screen 2</span>
                        <span class="fallback-preview-line">${s2[0] || '\u00A0'}</span>
                        <span class="fallback-preview-line">${s2[1] || '\u00A0'}</span>
                        <span class="fallback-preview-line">${s2[2] || '\u00A0'}</span>
                    </div>
                </div>
                <div class="fallback-inputs">
                    <div class="fallback-screen-row">
                        <label class="fallback-screen-label">Screen 1:</label>
                        <input type="text" class="compact-input fallback-line" data-screen="1" data-line="0" maxlength="8" placeholder="Line 1" value="${fb.screen1[0] || ''}">
                        <input type="text" class="compact-input fallback-line" data-screen="1" data-line="1" maxlength="8" placeholder="Line 2" value="${fb.screen1[1] || ''}">
                        <input type="text" class="compact-input fallback-line" data-screen="1" data-line="2" maxlength="8" placeholder="Line 3" value="${fb.screen1[2] || ''}">
                    </div>
                    <div class="fallback-screen-row">
                        <label class="fallback-screen-label">Screen 2:</label>
                        <input type="text" class="compact-input fallback-line" data-screen="2" data-line="0" maxlength="8" placeholder="Line 1" value="${fb.screen2[0] || ''}" ${fb.sameAsScreen1 ? 'disabled' : ''}>
                        <input type="text" class="compact-input fallback-line" data-screen="2" data-line="1" maxlength="8" placeholder="Line 2" value="${fb.screen2[1] || ''}" ${fb.sameAsScreen1 ? 'disabled' : ''}>
                        <input type="text" class="compact-input fallback-line" data-screen="2" data-line="2" maxlength="8" placeholder="Line 3" value="${fb.screen2[2] || ''}" ${fb.sameAsScreen1 ? 'disabled' : ''}>
                        <label class="fallback-same-checkbox">
                            <input type="checkbox" id="fallback-same-as-s1" ${fb.sameAsScreen1 ? 'checked' : ''}>
                            Same as S1
                        </label>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        container.querySelectorAll('.fallback-line').forEach(input => {
            input.addEventListener('input', (e) => {
                const value = e.target.value.toUpperCase();
                e.target.value = value;
                const screen = e.target.dataset.screen;
                const line = parseInt(e.target.dataset.line);
                if (screen === '1') {
                    this.fallbackMessage.screen1[line] = value;
                    if (this.fallbackMessage.sameAsScreen1) {
                        this.fallbackMessage.screen2[line] = value;
                    }
                } else {
                    this.fallbackMessage.screen2[line] = value;
                }
                this.saveToLocalStorage();
                this.updateFallbackPreview();
                this.updateFallbackHeaderStyle();
            });
        });

        const sameCheckbox = document.getElementById('fallback-same-as-s1');
        if (sameCheckbox) {
            sameCheckbox.addEventListener('change', (e) => {
                this.fallbackMessage.sameAsScreen1 = e.target.checked;
                this.saveToLocalStorage();
                this.renderFallbackTab();
            });
        }

        this.updateFallbackHeaderStyle();
    }

    updateFallbackPreview() {
        const container = document.getElementById('fallback-content');
        if (!container) return;

        const fb = this.fallbackMessage;
        const s1 = fb.screen1 || ['', '', ''];
        const s2 = fb.sameAsScreen1 ? s1 : (fb.screen2 || ['', '', '']);

        const previews = container.querySelectorAll('.fallback-preview');
        if (previews.length === 2) {
            const lines1 = previews[0].querySelectorAll('.fallback-preview-line');
            const lines2 = previews[1].querySelectorAll('.fallback-preview-line');
            lines1[0].textContent = s1[0] || '\u00A0';
            lines1[1].textContent = s1[1] || '\u00A0';
            lines1[2].textContent = s1[2] || '\u00A0';
            lines2[0].textContent = s2[0] || '\u00A0';
            lines2[1].textContent = s2[1] || '\u00A0';
            lines2[2].textContent = s2[2] || '\u00A0';
        }
    }

    createRuleElement(rule, ruleNumber) {
        const template = document.getElementById('rule-template');
        const clone = template.content.cloneNode(true);
        const ruleCard = clone.querySelector('.rule-card');

        ruleCard.setAttribute('data-rule-id', rule.id);

        // Set rule number
        clone.querySelector('.rule-number').textContent = `#${ruleNumber}`;

        // Populate metric selector (web beacons only get Speed and Lowest Speed)
        const metricSelect = clone.querySelector('.metric-select');
        const webBeaconMetrics = ['speed', 'speed_any'];
        const availableMetrics = this.currentDeviceType === 'webbeacon'
            ? this.data.metrics.filter(m => webBeaconMetrics.includes(m.value))
            : this.data.metrics;
        availableMetrics.forEach(metric => {
            const option = document.createElement('option');
            option.value = metric.id;
            option.textContent = metric.name;
            if (rule.metric == metric.id) option.selected = true;
            metricSelect.appendChild(option);
        });

        // Populate sensor selector
        const sensorSelect = clone.querySelector('.sensor-select');
        const isTravelTime = this.isTravelTimeMetric(rule.metric);
        const selectedMetric = this.data.metrics.find(m => m.id == rule.metric);
        const isBtSpeed = selectedMetric && selectedMetric.value === 'bt_speed';
        if (isTravelTime) {
            // Travel time metrics don't use a sensor
            const naOption = document.createElement('option');
            naOption.value = '';
            naOption.textContent = 'N/A';
            sensorSelect.appendChild(naOption);
            sensorSelect.disabled = true;
            sensorSelect.classList.add('sensor-disabled');
            rule.sensor = '';
        } else if (this.currentDevice) {
            const addedIds = new Set();
            this.currentDevice.associatedSensors.forEach(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                if (sensor && (!sensor.isBluetooth || isBtSpeed)) {
                    const option = document.createElement('option');
                    option.value = sensor.id;
                    option.textContent = sensor.name;
                    if (rule.sensor == sensor.id) option.selected = true;
                    sensorSelect.appendChild(option);
                    addedIds.add(sensor.id);
                }
            });
            // For Speed + Bluetooth, also include BT virtual sensors
            if (isBtSpeed) {
                this.data.sensors.filter(s => s.isBluetooth && !addedIds.has(s.id)).forEach(sensor => {
                    const option = document.createElement('option');
                    option.value = sensor.id;
                    option.textContent = sensor.name;
                    if (rule.sensor == sensor.id) option.selected = true;
                    sensorSelect.appendChild(option);
                });
            }
        }

        // Set operator and threshold
        clone.querySelector('.operator-select').value = rule.operator;
        clone.querySelector('.threshold-input').value = rule.threshold;

        // Update unit label based on metric
        this.updateUnitLabel(ruleCard, rule.metric);

        // Set screen values
        const screen1Lines = clone.querySelectorAll('.screen-line[data-screen="1"]');
        const screen2Lines = clone.querySelectorAll('.screen-line[data-screen="2"]');

        screen1Lines.forEach((input, i) => {
            input.value = rule.screen1[i] || '';
        });

        screen2Lines.forEach((input, i) => {
            input.value = rule.screen2[i] || '';
            if (rule.sameAsScreen1) {
                input.disabled = true;
                input.value = rule.screen1[i] || '';
            }
        });

        const sameCheckbox = clone.querySelector('.same-as-screen1');
        sameCheckbox.checked = rule.sameAsScreen1;

        // Update preview
        this.updateRulePreview(ruleCard);

        // Event listeners
        this.attachRuleEventListeners(ruleCard, rule.id);

        return clone;
    }

    attachRuleEventListeners(ruleCard, ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (!rule) return;

        // Move buttons
        ruleCard.querySelector('.move-up').addEventListener('click', () => {
            this.moveRule(ruleId, 'up');
        });

        ruleCard.querySelector('.move-down').addEventListener('click', () => {
            this.moveRule(ruleId, 'down');
        });

        // Delete button
        ruleCard.querySelector('.delete-rule').addEventListener('click', () => {
            if (confirm('Delete this rule?')) {
                this.deleteRule(ruleId);
            }
        });

        // Metric change
        ruleCard.querySelector('.metric-select').addEventListener('change', (e) => {
            rule.metric = e.target.value;
            this.updateUnitLabel(ruleCard, rule.metric);
            this.updateOperatorOptions(ruleCard, rule.metric);
            this.updateSensorForMetric(ruleCard, rule);
            this.saveToLocalStorage();
            this.updateDevOutput();
        });

        // Sensor change
        ruleCard.querySelector('.sensor-select').addEventListener('change', (e) => {
            rule.sensor = e.target.value;
            this.saveToLocalStorage();
            this.updateDevOutput();
        });

        // Operator change
        ruleCard.querySelector('.operator-select').addEventListener('change', (e) => {
            rule.operator = e.target.value;
            this.saveToLocalStorage();
            this.updateDevOutput();
        });

        // Threshold change
        ruleCard.querySelector('.threshold-input').addEventListener('input', (e) => {
            rule.threshold = e.target.value;
            this.saveToLocalStorage();
            this.updateDevOutput();
        });

        // Screen inputs
        ruleCard.querySelectorAll('.screen-line').forEach(input => {
            input.addEventListener('input', (e) => {
                const screen = e.target.dataset.screen;
                const line = parseInt(e.target.dataset.line) - 1;
                const value = e.target.value.toUpperCase();

                e.target.value = value;

                if (screen === '1') {
                    rule.screen1[line] = value;
                    if (rule.sameAsScreen1) {
                        rule.screen2[line] = value;
                    }
                } else if (screen === '2') {
                    rule.screen2[line] = value;
                }

                this.updateRulePreview(ruleCard);
                this.saveToLocalStorage();
                this.updateDevOutput();
            });
        });

        // Same as screen 1 checkbox
        ruleCard.querySelector('.same-as-screen1').addEventListener('change', (e) => {
            rule.sameAsScreen1 = e.target.checked;

            const screen2Inputs = ruleCard.querySelectorAll('.screen-line[data-screen="2"]');
            screen2Inputs.forEach((input, i) => {
                input.disabled = e.target.checked;
                if (e.target.checked) {
                    input.value = rule.screen1[i] || '';
                    rule.screen2[i] = rule.screen1[i] || '';
                }
            });

            this.updateRulePreview(ruleCard);
            this.saveToLocalStorage();
            this.updateDevOutput();
        });
    }

    updateUnitLabel(ruleCard, metricId) {
        const metric = this.data.metrics.find(m => m.id == metricId);
        const unitLabel = ruleCard.querySelector('.unit-label');

        if (!metric) {
            unitLabel.textContent = '';
            return;
        }

        // Determine unit based on metric type
        if (metric.value.includes('speed')) {
            unitLabel.textContent = 'miles/hour';
        } else if (metric.value.includes('travel_time')) {
            unitLabel.textContent = 'minutes';
        } else {
            unitLabel.textContent = 'vehicles/minute';
        }
    }

    // Check if a metric is a travel time type (no sensor needed)
    isTravelTimeMetric(metricId) {
        const metric = this.data.metrics.find(m => m.id == metricId);
        return metric && metric.value.includes('travel_time');
    }

    // Update sensor dropdown based on current metric selection
    updateSensorForMetric(ruleCard, rule) {
        const sensorSelect = ruleCard.querySelector('.sensor-select');
        sensorSelect.innerHTML = '';
        const metric = this.data.metrics.find(m => m.id == rule.metric);
        const isBtSpeed = metric && metric.value === 'bt_speed';

        if (this.isTravelTimeMetric(rule.metric)) {
            const naOption = document.createElement('option');
            naOption.value = '';
            naOption.textContent = 'N/A';
            sensorSelect.appendChild(naOption);
            sensorSelect.disabled = true;
            sensorSelect.classList.add('sensor-disabled');
            rule.sensor = '';
        } else {
            sensorSelect.disabled = false;
            sensorSelect.classList.remove('sensor-disabled');
            // Re-add the default placeholder
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select Sensor...';
            sensorSelect.appendChild(defaultOption);
            // Repopulate sensors
            if (this.currentDevice) {
                const addedIds = new Set();
                // Device's associated sensors
                this.currentDevice.associatedSensors.forEach(sensorId => {
                    const sensor = this.data.sensors.find(s => s.id === sensorId);
                    if (sensor && (!sensor.isBluetooth || isBtSpeed)) {
                        const option = document.createElement('option');
                        option.value = sensor.id;
                        option.textContent = sensor.name;
                        sensorSelect.appendChild(option);
                        addedIds.add(sensor.id);
                    }
                });
                // For Speed + Bluetooth, also include BT virtual sensors
                if (isBtSpeed) {
                    this.data.sensors.filter(s => s.isBluetooth && !addedIds.has(s.id)).forEach(sensor => {
                        const option = document.createElement('option');
                        option.value = sensor.id;
                        option.textContent = sensor.name;
                        sensorSelect.appendChild(option);
                    });
                }
            }
            rule.sensor = '';
        }
    }

    updateOperatorOptions(ruleCard, metricId) {
        const metric = this.data.metrics.find(m => m.id == metricId);
        const operatorSelect = ruleCard.querySelector('.operator-select');

        if (!metric) return;

        // Speed metrics use "is less than"
        // Travel time metrics use "is greater than"
        if (metric.value.includes('speed')) {
            operatorSelect.value = 'less';
        } else if (metric.value.includes('travel_time')) {
            operatorSelect.value = 'greater';
        }
    }

    updateRulePreview(ruleCard) {
        const rule = this.rules.find(r => r.id == ruleCard.dataset.ruleId);
        if (!rule) return;

        const previewScreens = ruleCard.querySelectorAll('.pcms-screen');

        // Update Screen 1
        const screen1Lines = previewScreens[0].querySelectorAll('.pcms-line');
        rule.screen1.forEach((text, i) => {
            screen1Lines[i].textContent = text || '\u00a0';
        });

        // Update Screen 2
        const screen2Lines = previewScreens[1].querySelectorAll('.pcms-line');
        const screen2Data = rule.sameAsScreen1 ? rule.screen1 : rule.screen2;
        screen2Data.forEach((text, i) => {
            screen2Lines[i].textContent = text || '\u00a0';
        });
    }

    formatRuleOutput(rule) {
        const metric = this.data.metrics.find(m => m.id == rule.metric);
        const isAggregate = metric && (metric.value.includes('_any') || metric.value.includes('_all'));

        // For aggregate metrics, sensor is not required
        if (!rule.metric || !rule.threshold) {
            return 'Incomplete rule';
        }

        // For non-aggregate metrics, sensor is required
        if (!isAggregate && !rule.sensor) {
            return 'Incomplete rule';
        }

        // Build message string
        const screen1 = rule.screen1.join('|');
        const screen2 = rule.sameAsScreen1 ? rule.screen1.join('|') : rule.screen2.join('|');
        const message = `${screen1}^${screen2}`;

        // Use placeholder for aggregate metrics
        const sensorValue = isAggregate ? '[PLACEHOLDER]' : rule.sensor;

        // Format: metric,sensor,threshold,message
        return `${rule.metric},${sensorValue},${rule.threshold},${message}`;
    }

    updateDevOutput() {
        if (!this.devMode) return;

        const rulesOutput = document.getElementById('rules-output');
        const finalOutput = document.getElementById('final-output');

        // Individual rules
        const ruleStrings = this.rules
            .map((rule, i) => `Rule ${i + 1}: ${this.formatRuleOutput(rule)}`)
            .join('\n');

        rulesOutput.textContent = ruleStrings || 'No rules defined';

        // Final concatenated output
        const finalString = this.rules
            .map(rule => this.formatRuleOutput(rule))
            .filter(r => !r.includes('Incomplete'))
            .join(';');

        finalOutput.textContent = finalString || 'No complete rules';
    }

    toggleDevMode() {
        this.devMode = !this.devMode;
        const devOutput = document.getElementById('dev-output');
        const headerBtn = document.getElementById('dev-mode-toggle');
        const pcmsCheckbox = document.getElementById('pcms-code-toggle');

        if (this.devMode) {
            devOutput.classList.remove('hidden');
            if (headerBtn) headerBtn.textContent = 'Hide PCMS Code';
            this.updateDevOutput();
        } else {
            devOutput.classList.add('hidden');
            if (headerBtn) headerBtn.textContent = 'Show PCMS Code';
        }

        if (pcmsCheckbox) pcmsCheckbox.checked = this.devMode;
    }

    saveToLocalStorage() {
        if (!this.currentDevice) return;

        const deviceRules = {
            deviceNumber: this.currentDevice.deviceNumber,
            rules: this.rules,
            fallbackMessage: this.fallbackMessage,
            lastModified: new Date().toISOString()
        };

        localStorage.setItem(`device_${this.currentDevice.deviceNumber}`, JSON.stringify(deviceRules));
    }

    loadDeviceRules(deviceNumber) {
        const saved = localStorage.getItem(`device_${deviceNumber}`);
        if (!saved) return [];

        try {
            const data = JSON.parse(saved);
            // Ensure rule IDs are unique
            if (data.rules && data.rules.length > 0) {
                const maxId = Math.max(...data.rules.map(r => r.id));
                this.ruleIdCounter = maxId + 1;
            }
            return data.rules || [];
        } catch (e) {
            console.error('Error loading device rules:', e);
            return [];
        }
    }

    loadFromLocalStorage() {
        // Load message sets
        const savedSets = localStorage.getItem('pcms_message_sets');
        if (savedSets) {
            try {
                this.data.messageSets = JSON.parse(savedSets);
                this.renderMessageSets();
            } catch (e) {
                console.error('Error loading message sets:', e);
            }
        }
    }

    saveMessageSet() {
        const nameInput = document.getElementById('message-set-name');
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter a name for this message set');
            return;
        }

        if (!this.currentDevice) {
            alert('Please select a device first');
            return;
        }

        const messageSet = {
            id: Date.now(),
            name: name,
            deviceNumber: this.currentDevice.deviceNumber,
            deviceName: this.currentDevice.deviceName,
            rules: JSON.parse(JSON.stringify(this.rules)), // Deep clone
            created: new Date().toISOString()
        };

        this.data.messageSets.push(messageSet);
        localStorage.setItem('pcms_message_sets', JSON.stringify(this.data.messageSets));

        nameInput.value = '';
        this.renderMessageSets();
        alert('Message set saved successfully!');
    }

    loadMessageSet(setId) {
        const messageSet = this.data.messageSets.find(s => s.id === setId);
        if (!messageSet) return;

        // Select the device
        document.getElementById('device-select').value = messageSet.deviceNumber;
        this.selectDevice(messageSet.deviceNumber);

        // Load rules
        this.rules = JSON.parse(JSON.stringify(messageSet.rules)); // Deep clone

        // Update rule ID counter
        if (this.rules.length > 0) {
            const maxId = Math.max(...this.rules.map(r => r.id));
            this.ruleIdCounter = maxId + 1;
        }

        this.renderRules();
        this.saveToLocalStorage();

        alert(`Loaded message set: ${messageSet.name}`);
    }

    deleteMessageSet(setId) {
        if (!confirm('Delete this message set?')) return;

        this.data.messageSets = this.data.messageSets.filter(s => s.id !== setId);
        localStorage.setItem('pcms_message_sets', JSON.stringify(this.data.messageSets));
        this.renderMessageSets();
    }

    renderMessageSets() {
        const container = document.getElementById('message-sets-list');

        if (this.data.messageSets.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No saved message sets</p></div>';
            return;
        }

        if (container) {

            container.innerHTML = '';

            this.data.messageSets.forEach(set => {
                const item = document.createElement('div');
                item.className = 'message-set-item';

                const date = new Date(set.created).toLocaleDateString();

                item.innerHTML = `
                <h4>${set.name}</h4>
                <p>${set.deviceName} - ${set.rules.length} rule(s) - ${date}</p>
                <div class="actions">
                    <button class="btn-primary" onclick="app.loadMessageSet(${set.id})">Load</button>
                    <button class="btn-icon delete-rule" onclick="app.deleteMessageSet(${set.id})">Delete</button>
                </div>
            `;

                container.appendChild(item);
            });
        }
    }

    // ========================================
    // PROJECT HISTORY (Audit Log)
    // ========================================

    loadMessageSets() {
        const saved = localStorage.getItem('pcms_message_sets_v3');
        if (saved) {
            this.messageSets = JSON.parse(saved);
        } else {
            // Initialize with sample message sets for demo
            this.messageSets = this.createSampleMessageSets();
            this.saveMessageSets();
        }
    }

    createSampleMessageSets() {
        const now = new Date();

        return [
            {
                id: 1,
                name: "Holiday Traffic Configuration",
                timestamp: new Date(now.getTime() - 86400000).toISOString(), // 1 day ago
                notes: "Updated configuration for Memorial Day weekend with adjusted IH35 and US281 thresholds",
                devices: this.createSampleDevicesSnapshot([
                    { deviceNumber: 42, ruleCount: 3 },
                    { deviceNumber: 43, ruleCount: 2 },
                    { deviceNumber: 44, ruleCount: 4 },
                    { deviceNumber: 45, ruleCount: 2 },
                    { deviceNumber: 46, ruleCount: 3 },
                    { deviceNumber: 47, ruleCount: 2 },
                    { deviceNumber: 48, ruleCount: 2 }
                ])
            },
            {
                id: 2,
                name: "Standard Weekday",
                timestamp: new Date(now.getTime() - 604800000).toISOString(), // 7 days ago
                notes: "Baseline weekday configuration with morning rush hour thresholds per TxDOT spec",
                devices: this.createSampleDevicesSnapshot([
                    { deviceNumber: 42, ruleCount: 2 },
                    { deviceNumber: 43, ruleCount: 2 },
                    { deviceNumber: 44, ruleCount: 3 },
                    { deviceNumber: 45, ruleCount: 2 },
                    { deviceNumber: 46, ruleCount: 2 },
                    { deviceNumber: 47, ruleCount: 1 },
                    { deviceNumber: 48, ruleCount: 1 }
                ])
            },
            {
                id: 3,
                name: "Initial Project Setup",
                timestamp: new Date(now.getTime() - 2592000000).toISOString(), // 30 days ago
                notes: "Initial baseline configuration for Q1 2025 deployment",
                devices: this.createSampleDevicesSnapshot([
                    { deviceNumber: 42, ruleCount: 2 },
                    { deviceNumber: 43, ruleCount: 1 },
                    { deviceNumber: 44, ruleCount: 2 },
                    { deviceNumber: 45, ruleCount: 1 },
                    { deviceNumber: 46, ruleCount: 2 },
                    { deviceNumber: 47, ruleCount: 0 },
                    { deviceNumber: 48, ruleCount: 0 }
                ])
            }
        ];
    }

    loadDrafts() {
        const saved = localStorage.getItem('pcms_drafts');
        if (saved) {
            this.drafts = JSON.parse(saved);
        } else {
            this.drafts = [];
        }
        //this.drafts = [];
        //const token = document.querySelector('input[name="__RequestVerificationToken"]').value;

        //fetch(`/LogicSet?handler=LoadDrafts&projectId=${encodeURIComponent(ProjectName)}`, {
        //    method: 'GET',
        //    headers: {
        //        'Content-Type': 'application/json',
        //        'RequestVerificationToken': token
        //    }
        //})
        //    .then(response => {
        //        if (!response.ok) {
        //            throw new Error("Server returned " + response.status);
        //        }
        //        return response.json();
        //    })
        //    .then(data => {
        //        console.log("Drafts loaded:", data);

        //        // If your controller returns a list of SetDraft objects:
        //        this.drafts = data;
        //        this.renderHomepageDrafts();
        //    })
        //    .catch(error => {
        //        console.warn('Could not load Drafts from server:', error);
        //    });
    }

    saveDrafts() {
        localStorage.setItem('pcms_drafts', JSON.stringify(this.drafts));
        //const token = document.querySelector('input[name="__RequestVerificationToken"]').value;
        //fetch(`/LogicSet?handler=UpsertDrafts&projectId=${encodeURIComponent(ProjectName)}`, {
        //    method: 'POST',
        //    headers: {
        //        'Content-Type': 'application/json',
        //        'RequestVerificationToken': token
        //    },
        //    body: JSON.stringify(this.currentDraft ? [this.currentDraft] : this.drafts)
        //})
        //    .then(response => {
        //        if (!response.ok) {
        //            throw new Error("Server returned " + response.status);
        //        }
        //        return response.json();
        //    })
        //    .then(data => {
        //        if (data.success) {
        //            console.log("Drafts saved successfully:", data.results);

        //            if (this.currentDraft) {
        //                this.currentDraft.id = data.results[0].draftId;
        //            }
        //            else {
        //                // Update local drafts with returned IDs
        //                data.results.forEach((result, index) => {
        //                    if (result.success && result.draftId > 0) {
        //                        this.drafts[index].id = result.draftId;
        //                    }
        //                });
        //            }

        //            //localStorage.setItem('pcms_drafts', JSON.stringify(this.drafts));

        //        } else {
        //            console.warn("Save failed:", data.error);
        //        }
        //    })
        //    .catch(error => {
        //        console.warn('Could not save Drafts to server:', error);
        //    });
    }

    createSampleDevicesSnapshot(deviceConfigs) {
        return deviceConfigs.map(config => {
            const device = this.data.devices.find(d => d.deviceNumber === config.deviceNumber);
            if (!device) return null;

            const sensors = (device.associatedSensors || []).slice(0, 3).map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                return sensor ? { id: sensor.id, name: sensor.name } : null;
            }).filter(Boolean);

            const rules = this.createSampleRules(config.ruleCount, sensors);

            return {
                deviceNumber: device.deviceNumber,
                deviceName: device.deviceName,
                sensors: sensors,
                rules: rules,
                pcmsCode: this.generatePcmsCodeForRules(rules)
            };
        }).filter(Boolean);
    }

    createSampleRules(count, sensors) {
        if (count === 0) return [];

        const sampleMessages = [
            { screen1: ['SLOW', 'TRAFFIC', 'AHEAD'], screen2: ['USE', 'CAUTION', ''] },
            { screen1: ['EXPECT', 'DELAYS', ''], screen2: ['PLAN', 'AHEAD', ''] },
            { screen1: ['TRAVEL', 'TIME', '15 MIN'], screen2: ['TO', 'DOWNTOWN', ''] },
            { screen1: ['SPEED', 'LIMIT', '55 MPH'], screen2: ['WATCH', 'SPEED', ''] },
            { screen1: ['CONGESTION', 'AHEAD', ''], screen2: ['MERGE', 'LEFT', ''] }
        ];

        const rules = [];
        for (let i = 0; i < count; i++) {
            const msg = sampleMessages[i % sampleMessages.length];
            rules.push({
                id: i + 1,
                metric: (i % 2) + 1, // Cycle through Speed, Travel Time
                sensor: sensors.length > 0 ? sensors[i % sensors.length].id : '',
                operator: i % 2 === 0 ? 'less' : 'greater', // Speed uses less, Travel Time uses greater
                threshold: i % 2 === 0 ? 35 + (i * 5) : 10 + i, // Speed in MPH, Travel Time in minutes
                screen1: msg.screen1,
                screen2: msg.screen2,
                sameAsScreen1: false
            });
        }
        return rules;
    }

    saveMessageSets() {
        localStorage.setItem('pcms_message_sets_v3', JSON.stringify(this.messageSets));
        //const token = document.querySelector('input[name="__RequestVerificationToken"]').value;
        //fetch(`/LogicSet?handler=UpsertMessageSets&projectId=${encodeURIComponent(ProjectName)}`, {
        //    method: 'POST',
        //    headers: {
        //        'Content-Type': 'application/json',
        //        'RequestVerificationToken': token
        //    },
        //    body: JSON.stringify([this.messageSets[this.messageSets.length - 1]])
        //})
        //    .then(response => {
        //        if (!response.ok) {
        //            throw new Error("Server returned " + response.status);
        //        }
        //        return response.json();
        //    })
        //    .then(data => {
        //        if (data.success) {
        //            console.log("Message sets saved successfully:", data.results);

        //            this.renderProjectHistory();

        //            // Remove the draft if it was saved from an existing draft
        //            if (this.currentDraft && this.currentDraft.id) {
        //                this.drafts = this.drafts.filter(d => d.id !== this.currentDraft.id);
        //                //this.saveDrafts();
        //                this.renderDraftsList();
        //            }

        //            // Close modal and exit draft mode
        //            document.getElementById('save-version-modal').classList.add('hidden');
        //            this.hideDraftMode();

        //            // Return to homepage
        //            this.goToHomepage();

        //            alert('Message set published to Project History!');

        //        } else {
        //            console.warn("Save failed:", data.error);
        //        }
        //    })
        //    .catch(error => {
        //        console.warn('Could not save Drafts to server:', error);
        //    });
    }

    // Application History (Timeline)
    loadApplicationHistory() {
        const saved = localStorage.getItem('pcms_application_history');
        if (saved) {
            this.applicationHistory = JSON.parse(saved);
        } else {
            this.applicationHistory = this.createSampleApplicationHistory();
            this.saveApplicationHistory();
        }
    }

    createSampleApplicationHistory() {
        const now = new Date();
        return [
            {
                id: 1,
                timestamp: new Date(now.getTime() - 86400000).toISOString(), // 1 day ago
                messageSetId: 1,
                messageSetName: "Holiday Traffic Configuration",
                version: 3,
                notes: "Added US281 corridor rules, extended timing windows"
            },
            {
                id: 2,
                timestamp: new Date(now.getTime() - 259200000).toISOString(), // 3 days ago
                messageSetId: 1,
                messageSetName: "Holiday Traffic Configuration",
                version: 2,
                notes: "Lowered IH35 speed thresholds from 45 to 35 MPH based on field observations"
            },
            {
                id: 3,
                timestamp: new Date(now.getTime() - 432000000).toISOString(), // 5 days ago
                messageSetId: 2,
                messageSetName: "Standard Weekday",
                version: 2,
                notes: "Adjusted morning rush hour thresholds per TxDOT feedback"
            },
            {
                id: 4,
                timestamp: new Date(now.getTime() - 604800000).toISOString(), // 7 days ago
                messageSetId: 1,
                messageSetName: "Holiday Traffic Configuration",
                version: 1,
                notes: "Initial holiday setup for Memorial Day weekend"
            },
            {
                id: 5,
                timestamp: new Date(now.getTime() - 1209600000).toISOString(), // 14 days ago
                messageSetId: 2,
                messageSetName: "Standard Weekday",
                version: 1,
                notes: "Baseline weekday configuration per project spec"
            }
        ];
    }

    saveApplicationHistory() {
        localStorage.setItem('pcms_application_history', JSON.stringify(this.applicationHistory));
    }

    recordApplication(messageSet, versionNumber) {
        const version = messageSet.versions.find(v => v.version === versionNumber);
        if (!version) return;

        const newEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            messageSetId: messageSet.id,
            messageSetName: messageSet.name,
            version: versionNumber,
            notes: version.notes
        };

        this.applicationHistory.unshift(newEntry);
        this.saveApplicationHistory();
        this.renderApplicationHistory();
    }

    renderApplicationHistory() {
        const container = document.getElementById('project-history-list');
        if (!container) return;

        if (this.applicationHistory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No history yet</p>
                    <p class="empty-state-hint">Applied message sets will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        this.applicationHistory.forEach((entry, index) => {
            const card = document.createElement('div');
            card.className = 'history-timeline-item';

            const timestamp = new Date(entry.timestamp);
            const formattedDate = timestamp.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            const formattedTime = timestamp.toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', hour12: true
            });

            // Check if this is the currently active one (first in list)
            const isActive = index === 0;

            card.innerHTML = `
                <div class="timeline-marker ${isActive ? 'active' : ''}"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-name">${entry.messageSetName}</span>
                        <span class="timeline-version">v${entry.version}</span>
                        ${isActive ? '<span class="timeline-active-badge">CURRENT</span>' : ''}
                    </div>
                    <div class="timeline-notes">${entry.notes}</div>
                    <div class="timeline-date">${formattedDate} at ${formattedTime}</div>
                </div>
            `;

            container.appendChild(card);
        });
    }

    setupMessageSetListeners() {
        // New Message Set button
        const newBtn = document.getElementById('new-message-set-btn');
        if (newBtn) {
            newBtn.addEventListener('click', () => this.createBlankDraft());
        }

        // Search filter
        const searchInput = document.getElementById('message-set-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.messageSetFilter = e.target.value.toLowerCase();
                this.renderMessageSetList();
            });
        }

        // Clear filters button
        const clearBtn = document.getElementById('clear-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.messageSetFilter = '';
                document.getElementById('message-set-search').value = '';
                this.renderMessageSetList();
            });
        }

        // Back to editor button
        const backBtn = document.getElementById('back-to-editor');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.closeMessageSetViewer());
        }

        // Export CSV button
        const exportBtn = document.getElementById('export-snapshot-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportMessageSetCSV());
        }

        // Viewer threshold first toggle
        const viewerThresholdToggle = document.getElementById('viewer-threshold-first-toggle');
        if (viewerThresholdToggle) {
            viewerThresholdToggle.checked = this.showThresholdFirst;
            viewerThresholdToggle.addEventListener('change', (e) => {
                this.showThresholdFirst = e.target.checked;
                localStorage.setItem('pcms_threshold_first', this.showThresholdFirst);
                // Also sync the editor checkbox
                const editorToggle = document.getElementById('threshold-first-toggle');
                if (editorToggle) editorToggle.checked = this.showThresholdFirst;
                // Re-render the version details
                if (this.viewingVersion) {
                    this.showVersionDetails(this.viewingVersion);
                }
            });
        }
    }

    showUploadLogicDialog() {
        const name = prompt('Enter a name for this entry (optional, internal only):');
        const notes = prompt('Add any notes (optional):');
        this.uploadLogicToProject(name, notes);
    }

    uploadLogicToProject(name, notes) {
        // Gather all device configurations
        const devices = this.data.devices.map(device => {
            const rules = this.loadDeviceRules(device.deviceNumber);
            const sensors = (device.associatedSensors || []).map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                return sensor ? { id: sensor.id, name: sensor.name } : null;
            }).filter(Boolean);

            return {
                deviceNumber: device.deviceNumber,
                deviceName: device.deviceName,
                sensors: sensors,
                rules: rules,
                pcmsCode: this.generatePcmsCodeForRules(rules)
            };
        });

        // Gather web beacon configurations
        const webBeacons = this.data.webBeacons.map(beacon => {
            const rules = this.loadDeviceRules(beacon.id);
            const sensors = (beacon.associatedSensors || []).map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                return sensor ? { id: sensor.id, name: sensor.name } : null;
            }).filter(Boolean);

            return {
                deviceNumber: beacon.id,
                deviceName: beacon.name,
                deviceType: 'webbeacon',
                sensors: sensors,
                rules: rules
            };
        });

        // Count total rules across all devices and web beacons
        const allItems = [...devices, ...webBeacons];
        const totalRules = allItems.reduce((sum, d) => sum + d.rules.length, 0);
        const devicesWithRules = allItems.filter(d => d.rules.length > 0).length;

        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            name: name || null,
            notes: notes || null,
            devices: devices,
            webBeacons: webBeacons,
            stats: {
                totalDevices: allItems.length,
                devicesWithRules: devicesWithRules,
                totalRules: totalRules
            }
        };

        this.projectHistory.unshift(entry);
        this.saveProjectHistory();
        this.renderProjectHistoryList();

        alert(`Logic uploaded to project history!\n${allItems.length} devices captured, ${totalRules} total rules.`);
    }

    generatePcmsCodeForRules(rules) {
        if (!rules || rules.length === 0) return '';

        return rules.map(rule => {
            const metric = this.data.metrics.find(m => m.id == rule.metric);
            const sensor = this.data.sensors.find(s => s.id == rule.sensor);

            const metricValue = metric ? metric.value : 'unknown';
            const sensorId = sensor ? sensor.id : 0;
            const threshold = rule.threshold || 0;
            const operator = rule.operator === 'less' ? 'LT' : 'GT';
            const screen1 = rule.screen1.join('|');
            const screen2 = rule.sameAsScreen1 ? screen1 : rule.screen2.join('|');

            return `IF(${metricValue}@${sensorId} ${operator} ${threshold})THEN(S1:${screen1},S2:${screen2})`;
        }).join(';');
    }

    // Render Project History (published message sets as timeline)
    renderProjectHistory() {
        const container = document.getElementById('project-history-list');
        if (!container) return;

        if (this.messageSets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No history yet</p>
                    <p class="empty-state-hint">Published message sets will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        // Sort by timestamp, newest first
        const sorted = [...this.messageSets].sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        sorted.forEach((messageSet, index) => {
            const card = this.createHistoryCard(messageSet, index, sorted);
            container.appendChild(card);
        });
    }

    // Render Drafts list
    renderDraftsList() {
        const container = document.getElementById('message-sets-list');
        if (!container) return;

        if (this.drafts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No drafts</p>
                    <p class="empty-state-hint">Click "+ New" to create a draft, or duplicate from Project History</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        this.drafts.forEach(draft => {
            const card = this.createDraftCard(draft);
            container.appendChild(card);
        });
    }

    renderMessageSetList() {
        // Now just renders drafts since message sets are shown in project history
        this.renderDraftsList();
    }

    // Create a card for project history (published message sets)
    createHistoryCard(messageSet, index, allSets) {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.dataset.messageSetId = messageSet.id;

        const timestamp = new Date(messageSet.timestamp);

        // Calculate date range (from this entry to the next one, or "Present")
        let endDate;
        if (index === 0) {
            endDate = 'Present';
        } else {
            const nextSet = allSets[index - 1];
            const nextTimestamp = new Date(nextSet.timestamp);
            endDate = nextTimestamp.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
        }

        const startDate = timestamp.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        const dateRange = index === 0
            ? `${startDate} - ${endDate}`
            : `${startDate} - ${endDate}`;

        const isActive = index === 0;

        card.innerHTML = `
            <div class="history-card-header">
                <div class="history-card-title">
                    <span class="history-card-name">${messageSet.name}</span>
                    ${isActive ? '<span class="active-badge">CURRENT</span>' : ''}
                </div>
                <div class="history-card-date">${dateRange}</div>
            </div>
            <div class="history-card-notes">${messageSet.notes || ''}</div>
            <div class="history-card-actions">
                <button class="btn-text-small duplicate-btn" data-id="${messageSet.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                        <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
                    </svg>
                    Duplicate to Draft
                </button>
            </div>
        `;

        // View message set on card click (but not on button click)
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.duplicate-btn')) {
                this.viewMessageSet(messageSet);
            }
        });

        // Duplicate button handler
        card.querySelector('.duplicate-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.duplicateToNewDraft(messageSet);
        });

        return card;
    }

    // Create a card for drafts
    createDraftCard(draft) {
        const card = document.createElement('div');
        card.className = 'draft-card';
        card.dataset.draftId = draft.id;

        const createdDate = new Date(draft.created).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        const basedOnText = draft.basedOn
            ? `Based on: ${draft.basedOn.name}`
            : 'New configuration';

        card.innerHTML = `
            <div class="draft-card-header">
                <span class="draft-badge">DRAFT</span>
                <span class="draft-card-name">${draft.name}</span>
            </div>
            <div class="draft-card-meta">
                <span class="draft-based-on">${basedOnText}</span>
                <span class="draft-date">Created: ${createdDate}</span>
            </div>
            <div class="draft-card-actions">
                <button class="btn-small-primary edit-draft-btn" data-id="${draft.id}">Edit</button>
                <button class="btn-text-small delete-draft-btn" data-id="${draft.id}">Delete</button>
            </div>
        `;

        card.querySelector('.edit-draft-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.editDraft(draft);
        });

        card.querySelector('.delete-draft-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteDraft(draft.id);
        });

        return card;
    }

    // Duplicate a message set to create a new draft
    duplicateToNewDraft(messageSet) {
        const defaultName = `${messageSet.name} (Copy)`;
        const name = prompt('Enter a name for the new draft:', defaultName);

        if (!name || !name.trim()) return;

        const draft = {
            id: 0, //Date.now(),
            name: name.trim(),
            created: new Date().toISOString(),
            basedOn: {
                id: messageSet.id,
                name: messageSet.name
            },
            devices: JSON.parse(JSON.stringify(messageSet.devices))
        };

        this.currentDraft = draft;

        this.drafts.push(draft);
        this.saveDrafts();
        this.renderDraftsList();
        this.renderHomepageDrafts();

        //alert(`Created draft "${draft.name}". Click on it to edit.`);
        this.editDraft(draft);
    }

    // Edit a draft - load it into the editor
    editDraft(draft) {
        // If we're currently viewing project history, close it first
        if (this.viewingMessageSet) {
            this.closeMessageSetViewer();
        }

        this.currentDraft = draft;
        this.isDraftMode = true;

        // Load draft device rules into localStorage for editing
        draft.devices.forEach(device => {
            const deviceRules = {
                deviceNumber: device.deviceNumber,
                rules: device.rules,
                fallbackMessage: device.fallbackMessage || { screen1: ['', '', ''], screen2: ['', '', ''], sameAsScreen1: false },
                lastModified: new Date().toISOString()
            };
            localStorage.setItem(`device_${device.deviceNumber}`, JSON.stringify(deviceRules));
        });

        // Load draft web beacon rules into localStorage for editing
        if (draft.webBeacons) {
            draft.webBeacons.forEach(beacon => {
                const beaconRules = {
                    deviceNumber: beacon.deviceNumber,
                    rules: beacon.rules,
                    lastModified: new Date().toISOString()
                };
                localStorage.setItem(`device_${beacon.deviceNumber}`, JSON.stringify(beaconRules));
            });
        }

        // Hide homepage, show logic builder
        const homepage = document.getElementById('homepage');
        const logicBuilder = document.querySelector('.logic-builder');
        const tabBar = document.querySelector('.vertical-tab-bar');
        const devicesPanel = document.getElementById('devices-panel');
        const mainContent = document.querySelector('.main-content');

        if (homepage) homepage.classList.add('hidden');
        if (logicBuilder) logicBuilder.classList.remove('hidden');

        // Show sidebar when leaving homepage, restore padding
        if (tabBar) tabBar.classList.remove('hidden');
        if (devicesPanel) devicesPanel.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('no-sidebar');

        // Hide developer mode button in overview (show only in detail edit)
        const devModeBtn = document.getElementById('dev-mode-toggle');
        if (devModeBtn) devModeBtn.classList.add('hidden');

        // Update tab button active state (none active when in edit mode)
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

        // Show draft mode indicator (orange header)
        this.showDraftMode();

        // Show the overview page first (birds eye view)
        this.showDraftOverview();
    }

    // Delete a draft
    deleteDraft(draftId) {
        if (!confirm('Delete this draft? This cannot be undone.')) return;
        //const token = document.querySelector('input[name="__RequestVerificationToken"]').value;

        //fetch(`/LogicSet?handler=DeleteDraft&messageSetId=${encodeURIComponent(draftId)}&projectId=${encodeURIComponent(ProjectName)}`, {
        //    method: 'POST',
        //    headers: {
        //        'Content-Type': 'application/json',
        //        'RequestVerificationToken': token
        //    }
        //})
        //    .then(response => {
        //        if (!response.ok) {
        //            throw new Error("Server returned " + response.status);
        //        }
        //        return response.json();
        //    })
        //    .then(data => {
        //        if (data.success) {
        //            console.log(`Draft ${draftId} deleted successfully.`);
        //            this.loadDrafts();
        //        } else {
        //            console.warn(`Failed to delete draft ${draftId}.`);
        //            alert("Delete failed.");
        //        }
        //    })
        //    .catch(error => {
        //        console.error("Error deleting draft:", error);
        //        alert("An error occurred while deleting the draft.");
        //    });
        this.drafts = this.drafts.filter(d => d.id !== draftId);

        this.saveDrafts();
        localStorage.setItem('pcms_drafts', JSON.stringify(this.drafts));

        this.renderDraftsList();
    }

    // View a message set (read-only view without versions)
    viewMessageSet(messageSet) {
        // If we're currently editing a draft, ask user to confirm leaving
        if (this.isDraftMode) {
            if (!confirm('You are currently editing a draft. Viewing history will discard unsaved changes. Continue?')) {
                return;
            }
            this.hideDraftMode();
        }

        this.viewingMessageSet = messageSet;

        // Add history mode class to header
        const header = document.getElementById('app-header');
        if (header) {
            header.classList.add('history-mode');
            header.classList.remove('draft-mode');
        }

        // Update header history info
        const headerHistoryName = document.getElementById('header-history-name');
        if (headerHistoryName) {
            headerHistoryName.textContent = messageSet.name;
        }

        // Highlight the selected card in the panel
        document.querySelectorAll('.history-card').forEach(card => {
            card.classList.remove('selected');
            if (card.dataset.messageSetId == messageSet.id) {
                card.classList.add('selected');
            }
        });

        // Hide homepage and main editor, show message set viewer
        const homepage = document.getElementById('homepage');
        const tabBar = document.querySelector('.vertical-tab-bar');
        const devicesPanel = document.getElementById('devices-panel');
        const mainContent = document.querySelector('.main-content');

        if (homepage) homepage.classList.add('hidden');
        document.querySelector('.logic-builder').classList.add('hidden');
        document.getElementById('message-set-viewer').classList.remove('hidden');

        // Show sidebar when leaving homepage, restore padding
        if (tabBar) tabBar.classList.remove('hidden');
        if (devicesPanel) devicesPanel.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('no-sidebar');

        // Hide developer mode button in history view
        const devModeBtn = document.getElementById('dev-mode-toggle');
        if (devModeBtn) devModeBtn.classList.add('hidden');

        // Update tab button active state (none active when viewing history)
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));

        // Sync the threshold toggle checkbox
        const viewerToggle = document.getElementById('viewer-threshold-first-toggle');
        if (viewerToggle) viewerToggle.checked = this.showThresholdFirst;

        // Update header
        document.getElementById('message-set-viewer-name').textContent = messageSet.name;

        // Show message set details (no version list needed)
        this.showMessageSetDetails(messageSet);
    }

    // Show details for a message set (simplified, no versions)
    showMessageSetDetails(messageSet) {
        // Update info in header
        const versionNumberEl = document.getElementById('viewing-version-number');
        if (versionNumberEl) versionNumberEl.style.display = 'none'; // Hide version number

        const timestamp = new Date(messageSet.timestamp);
        const formattedDateTime = timestamp.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
        document.getElementById('viewing-version-date').textContent = formattedDateTime;
        document.getElementById('viewing-version-notes').textContent = messageSet.notes || '';

        // Hide the version list panel since we don't have versions
        const versionListPanel = document.querySelector('.version-list-panel');
        if (versionListPanel) versionListPanel.style.display = 'none';

        // Hide apply button (no longer needed without versions)
        const applyBtn = document.getElementById('apply-version-btn');
        if (applyBtn) applyBtn.style.display = 'none';

        // Render devices
        this.renderMessageSetDevices(messageSet);
    }

    // Render devices for a message set (simplified)
    renderMessageSetDevices(messageSet) {
        const container = document.getElementById('version-devices-content');
        if (!container) return;

        container.innerHTML = '';

        if (!messageSet.devices || messageSet.devices.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No device data</p></div>';
            return;
        }

        // Helper to render a single device/beacon card
        const renderDeviceCard = (device) => {
            const section = document.createElement('div');
            section.className = 'history-device-card';

            const ruleCount = device.rules ? device.rules.length : 0;

            // Build sensor pills HTML
            let sensorPillsHtml = '';
            if (device.sensors && device.sensors.length > 0) {
                const sortedSensors = [...device.sensors].sort((a, b) => a.name.localeCompare(b.name));
                sensorPillsHtml = sortedSensors
                    .map(s => `<span class="history-sensor-pill">${s.name}</span>`)
                    .join('');
            } else if (device.associatedSensors && device.associatedSensors.length > 0) {
                const sensorNames = device.associatedSensors
                    .map(sensorId => this.data.sensors.find(s => s.id === sensorId))
                    .filter(Boolean)
                    .sort((a, b) => a.name.localeCompare(b.name));

                sensorPillsHtml = sensorNames
                    .map(s => `<span class="history-sensor-pill">${s.name}</span>`)
                    .join('');
            }

            section.innerHTML = `
                <div class="history-device-header">
                    <span class="history-device-name">${device.deviceName}</span>
                    <div class="history-device-sensors">${sensorPillsHtml}</div>
                    <div class="history-device-meta">
                        <span class="history-rule-count${ruleCount === 0 ? ' empty' : ''}">${ruleCount} rule${ruleCount !== 1 ? 's' : ''}</span>
                        <svg class="history-device-chevron" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor" style="transform: rotate(180deg);">
                            <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/>
                        </svg>
                    </div>
                </div>
                <div class="history-device-content">
                    ${this.renderDeviceRulesForHistory(device)}
                </div>
            `;

            const header = section.querySelector('.history-device-header');
            const content = section.querySelector('.history-device-content');
            const chevron = section.querySelector('.history-device-chevron');

            header.addEventListener('click', () => {
                content.classList.toggle('collapsed');
                chevron.style.transform = content.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
            });

            return section;
        };

        // Render PCMS devices
        messageSet.devices.forEach(device => {
            container.appendChild(renderDeviceCard(device));
        });

        // Render web beacons if present
        if (messageSet.webBeacons && messageSet.webBeacons.length > 0) {
            const wbHeader = document.createElement('div');
            wbHeader.className = 'overview-section-header';
            wbHeader.innerHTML = `Web Beacons <span class="section-count">${messageSet.webBeacons.length}</span>`;
            container.appendChild(wbHeader);

            messageSet.webBeacons.forEach(beacon => {
                container.appendChild(renderDeviceCard(beacon));
            });
        }
    }

    // Expand all devices in history view
    expandAllHistoryDevices() {
        const contents = document.querySelectorAll('#version-devices-content .history-device-content');
        const chevrons = document.querySelectorAll('#version-devices-content .history-device-chevron');

        contents.forEach(content => content.classList.remove('collapsed'));
        chevrons.forEach(chevron => chevron.style.transform = 'rotate(180deg)');
    }

    // Collapse all devices in history view
    collapseAllHistoryDevices() {
        const contents = document.querySelectorAll('#version-devices-content .history-device-content');
        const chevrons = document.querySelectorAll('#version-devices-content .history-device-chevron');

        contents.forEach(content => content.classList.add('collapsed'));
        chevrons.forEach(chevron => chevron.style.transform = 'rotate(0deg)');
    }

    // Render rules for history view (unified format with full words and pills)
    renderDeviceRulesForHistory(device) {
        if (!device.rules || device.rules.length === 0) {
            return '<div class="history-no-rules">No rules configured</div>';
        }

        let html = '<div class="history-rules-list">';
        device.rules.forEach((rule, index) => {
            const metric = this.data.metrics.find(m => m.id == rule.metric);
            const sensor = this.data.sensors.find(s => s.id == rule.sensor);

            const metricName = metric ? metric.name : 'Unknown Metric';
            let sensorName = sensor ? sensor.name : 'Unknown Sensor';

            // Handle aggregate metrics
            if (metric && (metric.value.includes('_any') || metric.value.includes('_all'))) {
                sensorName = metric.value.includes('_any') ? 'Any Sensor' : 'All Sensors';
            }

            const conditionText = rule.operator === 'less' ? 'less than' : 'greater than';
            let unitText = '';
            if (metric) {
                if (metric.value && metric.value.includes('speed')) unitText = 'MPH';
                else if (metric.value && metric.value.includes('travel_time')) unitText = 'minutes';
                else unitText = 'vehicles/minute';
            }

            let displayText;
            if (rule.outputType === 'flash' || (device.deviceType === 'webbeacon')) {
                displayText = '<span class="pill pill-flash">Flash</span>';
            } else {
                const screen1Text = rule.screen1.filter(l => l).join(' | ') || '—';
                displayText = rule.sameAsScreen1
                    ? screen1Text
                    : `${screen1Text} → ${rule.screen2.filter(l => l).join(' | ') || '—'}`;
            }

            html += `
                <div class="unified-rule-item">
                    <span class="unified-rule-number">#${index + 1}</span>
                    <span class="unified-rule-text">If</span>
                    <span class="pill pill-metric">${metricName}</span>
                    <span class="pill pill-sensor">${sensorName}</span>
                    <span class="unified-rule-text">is ${conditionText}</span>
                    <span class="pill ${this.getThresholdClass(rule.threshold)}">${rule.threshold} ${unitText}</span>
                    <span class="unified-rule-text">then</span>
                    <span class="unified-rule-display">${displayText}</span>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    // Render rules for a device (legacy, kept for compatibility)
    renderDeviceRules(device) {
        return this.renderDeviceRulesForHistory(device);
    }

    renderHistoryDevices(entry) {
        const container = document.getElementById('snapshot-viewer-content');
        container.innerHTML = '';

        entry.devices.forEach(device => {
            const section = document.createElement('div');
            section.className = 'snapshot-device-section';

            const hasRules = device.rules && device.rules.length > 0;
            const sensorCount = device.sensors ? device.sensors.length : 0;
            const ruleCount = device.rules ? device.rules.length : 0;

            section.innerHTML = `
                <div class="snapshot-device-header">
                    <span class="snapshot-device-name">${device.deviceName}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="snapshot-device-stats">
                        <span class="stat"><span class="stat-value">${sensorCount}</span> sensors</span>
                    </div>
                    <svg class="snapshot-device-chevron" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
                        <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/>
                    </svg>
                    </div>
                </div>
                <div class="snapshot-device-content">
                    ${this.renderHistoryDeviceContent(device)}
                </div>
            `;

            // Toggle expand/collapse
            const header = section.querySelector('.snapshot-device-header');
            const content = section.querySelector('.snapshot-device-content');
            const chevron = section.querySelector('.snapshot-device-chevron');

            header.addEventListener('click', () => {
                content.classList.toggle('collapsed');
                chevron.style.transform = content.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
            });

            container.appendChild(section);
        });
    }

    renderHistoryDeviceContent(device) {
        let html = '';

        // Sensors section
        if (device.sensors && device.sensors.length > 0) {
            html += `
                <div class="snapshot-sensors-section">
                    <div class="snapshot-sensors-label">Associated Sensors</div>
                    <div class="snapshot-sensors-list">
                        ${device.sensors.map(s => `<span class="snapshot-sensor-pill">${s.name}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // Rules section
        html += `<div class="snapshot-rules-section">`;
        html += `<div class="snapshot-rules-label">Logic Rules</div>`;

        if (!device.rules || device.rules.length === 0) {
            html += `<div class="snapshot-no-rules">No rules configured for this device</div>`;
        } else {
            html += `<div class="snapshot-rules-list">`;
            device.rules.forEach((rule, index) => {
                html += this.renderHistoryRule(rule, index);
            });
            html += `</div>`;
        }
        html += `</div>`;

        return html;
    }

    getThresholdClass(threshold) {
        const value = parseInt(threshold);
        if (isNaN(value)) return 'pill-condition';
        if (value <= 30) return 'pill-threshold-stopped';
        if (value <= 55) return 'pill-threshold-slow';
        return 'pill-threshold-freeflow';
    }

    renderHistoryRule(rule, index) {
        const metric = this.data.metrics.find(m => m.id == rule.metric);
        const sensor = this.data.sensors.find(s => s.id == rule.sensor);

        const metricName = metric ? metric.name : 'Unknown Metric';
        let sensorName = sensor ? sensor.name : 'Unknown Sensor';

        // Handle aggregate metrics
        if (metric && (metric.value.includes('_any') || metric.value.includes('_all'))) {
            sensorName = metric.value.includes('_any') ? 'Any Sensor' : 'All Sensors';
        }

        const conditionText = rule.operator === 'less' ? 'less than' : 'greater than';
        let unitText = '';
        if (metric) {
            if (metric.value.includes('speed')) unitText = 'MPH';
            else if (metric.value.includes('travel_time')) unitText = 'minutes';
            else unitText = 'vehicles/minute';
        }

        const screen1Text = rule.screen1.filter(l => l).join(' | ') || '-';
        const displayText = rule.sameAsScreen1
            ? screen1Text
            : `${screen1Text} → ${rule.screen2.filter(l => l).join(' | ') || '-'}`;

        if (this.showThresholdFirst) {
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
    }

    closeMessageSetViewer() {
        this.viewingMessageSet = null;

        // Remove history mode class from header
        const header = document.getElementById('app-header');
        if (header) {
            header.classList.remove('history-mode');
        }

        // Clear header history info
        const headerHistoryName = document.getElementById('header-history-name');
        if (headerHistoryName) {
            headerHistoryName.textContent = '';
        }

        // Clear the selected state from all cards
        document.querySelectorAll('.history-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Restore version list panel visibility for next time
        const versionListPanel = document.querySelector('.version-list-panel');
        if (versionListPanel) versionListPanel.style.display = '';

        // Show main editor, hide viewer
        document.querySelector('.logic-builder').classList.remove('hidden');
        document.getElementById('message-set-viewer').classList.add('hidden');
    }

    // Copy message set to create new draft (from viewer)
    copyVersionToDraft() {
        if (!this.viewingMessageSet) return;

        const draft = {
            id: 0, //Date.now(),
            name: `${this.viewingMessageSet.name} (Copy)`,
            created: new Date().toISOString(),
            basedOn: {
                id: this.viewingMessageSet.id,
                name: this.viewingMessageSet.name
            },
            devices: JSON.parse(JSON.stringify(this.viewingMessageSet.devices))
        };

        this.currentDraft = draft;
        this.drafts.push(draft);
        this.saveDrafts();

        // Close viewer and edit the new draft
        this.closeMessageSetViewer();
        this.renderDraftsList();
        this.editDraft(draft);
    }

    // Create blank draft
    createBlankDraft() {
        const name = prompt('Enter a name for the new draft:');
        if (!name || !name.trim()) return;

        // Create truly blank devices (no rules)
        const devices = this.data.devices.map(device => {
            const sensors = (device.associatedSensors || []).map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                return sensor ? { id: sensor.id, name: sensor.name } : null;
            }).filter(Boolean);

            return {
                deviceNumber: device.deviceNumber,
                deviceName: device.deviceName,
                sensors: sensors,
                rules: [],
                fallbackMessage: { screen1: ['', '', ''], screen2: ['', '', ''], sameAsScreen1: false }
            };
        });

        // Create truly blank web beacons (no rules)
        const webBeacons = this.data.webBeacons.map(beacon => {
            const sensors = (beacon.associatedSensors || []).map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                return sensor ? { id: sensor.id, name: sensor.name } : null;
            }).filter(Boolean);

            return {
                deviceNumber: beacon.id,
                deviceName: beacon.name,
                deviceType: 'webbeacon',
                sensors: sensors,
                rules: []
            };
        });

        const draft = {
            id: 0, //Date.now(),
            name: name.trim(),
            created: new Date().toISOString(),
            basedOn: null,
            devices: devices,
            webBeacons: webBeacons
        };

        this.currentDraft = draft;

        this.drafts.push(draft);
        this.saveDrafts();
        this.renderDraftsList();

        // Immediately enter edit mode for this draft
        this.editDraft(draft);
    }

    // Show the "Draft from Existing" picker modal
    showDraftFromExisting() {
        const modal = document.getElementById('draft-from-existing-modal');
        const list = document.getElementById('existing-entries-list');
        if (!modal || !list) return;

        // Sort by newest first
        const sorted = [...this.messageSets].sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        if (sorted.length === 0) {
            list.innerHTML = '<div class="existing-entries-empty">No project history entries to copy from.</div>';
            modal.classList.remove('hidden');
            return;
        }

        list.innerHTML = '';
        sorted.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'existing-entry-card';

            const date = new Date(entry.timestamp).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            const deviceCount = entry.devices ? entry.devices.length : 0;
            const beaconCount = entry.webBeacons ? entry.webBeacons.length : 0;
            const ruleCount = (entry.devices || []).reduce((sum, d) => sum + (d.rules ? d.rules.length : 0), 0)
                + (entry.webBeacons || []).reduce((sum, b) => sum + (b.rules ? b.rules.length : 0), 0);

            card.innerHTML = `
                <div class="existing-entry-info">
                    <span class="existing-entry-name">${entry.name || 'Untitled'}</span>
                    <span class="existing-entry-meta">${date} &middot; ${deviceCount + beaconCount} devices &middot; ${ruleCount} rules</span>
                    ${entry.notes ? `<span class="existing-entry-notes">${entry.notes}</span>` : ''}
                </div>
                <button class="btn-small-primary existing-entry-select">Select</button>
            `;

            card.querySelector('.existing-entry-select').addEventListener('click', () => {
                this.confirmDraftFromExisting(entry);
            });

            list.appendChild(card);
        });

        modal.classList.remove('hidden');
    }

    cancelDraftFromExisting() {
        const modal = document.getElementById('draft-from-existing-modal');
        if (modal) modal.classList.add('hidden');
    }

    confirmDraftFromExisting(entry) {
        const modal = document.getElementById('draft-from-existing-modal');
        if (modal) modal.classList.add('hidden');

        const name = prompt('Enter a name for this draft:', `${entry.name || 'Untitled'} (Copy)`);
        if (!name || !name.trim()) return;

        const draft = {
            id: 0, //Date.now(),
            name: name.trim(),
            created: new Date().toISOString(),
            basedOn: {
                id: entry.id,
                name: entry.name || 'Untitled'
            },
            devices: JSON.parse(JSON.stringify(entry.devices || [])),
            webBeacons: JSON.parse(JSON.stringify(entry.webBeacons || []))
        };

        this.currentDraft = draft;
        this.drafts.push(draft);
        this.saveDrafts();
        this.renderDraftsList();

        // Immediately enter edit mode
        this.editDraft(draft);
    }

    showDraftMode() {
        // Add draft mode class to header
        const header = document.getElementById('app-header');
        if (header) {
            header.classList.add('draft-mode');
            header.classList.remove('history-mode');
        }

        // Update header draft info
        const basedOnText = this.currentDraft.basedOn
            ? `Based on: ${this.currentDraft.basedOn.name}`
            : 'New configuration';

        const headerDraftName = document.getElementById('header-draft-name');
        const headerDraftBasedOn = document.getElementById('header-draft-based-on');

        if (headerDraftName) {
            headerDraftName.textContent = this.currentDraft.name;
        }
        if (headerDraftBasedOn) {
            headerDraftBasedOn.textContent = basedOnText;
        }

        // Also update the old indicator for backwards compatibility
        const indicator = document.getElementById('draft-mode-indicator');
        if (indicator) {
            indicator.classList.add('hidden'); // Hide old indicator since header shows it now
        }
    }

    hideDraftMode() {
        // Remove draft mode class from header
        const header = document.getElementById('app-header');
        if (header) {
            header.classList.remove('draft-mode');
        }

        // Clear header draft info
        const headerDraftName = document.getElementById('header-draft-name');
        const headerDraftBasedOn = document.getElementById('header-draft-based-on');

        if (headerDraftName) {
            headerDraftName.textContent = '';
        }
        if (headerDraftBasedOn) {
            headerDraftBasedOn.textContent = '';
        }

        // Also hide old indicator
        const indicator = document.getElementById('draft-mode-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }

        // Hide overview, show device edit view
        const overview = document.getElementById('draft-overview');
        const deviceEditView = document.getElementById('device-edit-view');
        const backBtn = document.getElementById('btn-back-overview');

        if (overview) overview.classList.add('hidden');
        if (deviceEditView) deviceEditView.classList.remove('hidden');
        if (backBtn) backBtn.classList.add('hidden');

        this.currentDraft = null;
        this.isDraftMode = false;
    }

    // Show draft overview (birds eye view of all devices)
    showDraftOverview() {
        const overview = document.getElementById('draft-overview');
        const deviceEditView = document.getElementById('device-edit-view');
        const backBtn = document.getElementById('btn-back-overview');

        if (overview) overview.classList.remove('hidden');
        if (deviceEditView) deviceEditView.classList.add('hidden');
        if (backBtn) backBtn.classList.add('hidden');

        // Clear current device selection
        this.currentDevice = null;
        this.updateMainDeviceSelect();
        document.querySelectorAll('.device-item').forEach(item => {
            item.classList.remove('active');
        });

        this.renderDraftOverview();
    }

    // Show device edit view (drill down from overview)
    showDeviceEditView(deviceNumber, deviceType = 'pcms') {
        const overview = document.getElementById('draft-overview');
        const deviceEditView = document.getElementById('device-edit-view');
        const backBtn = document.getElementById('btn-back-overview');

        if (overview) overview.classList.add('hidden');
        if (deviceEditView) deviceEditView.classList.remove('hidden');

        // Show back button only when in draft mode
        if (backBtn) {
            backBtn.classList.toggle('hidden', !this.isDraftMode);
        }

        // Select the device
        this.selectDevice(deviceNumber, deviceType);
    }

    // Render draft overview with all devices
    renderDraftOverview() {
        const container = document.getElementById('draft-overview-devices');
        const totalDevicesEl = document.getElementById('overview-total-devices');
        const totalRulesEl = document.getElementById('overview-total-rules');
        const draftNameEl = document.getElementById('draft-overview-name');
        const basedOnEl = document.getElementById('draft-overview-based-on');

        if (!container) return;

        // Update draft name and based-on text
        if (this.currentDraft) {
            if (draftNameEl) {
                draftNameEl.textContent = this.currentDraft.name;
            }
            if (basedOnEl) {
                basedOnEl.textContent = this.currentDraft.basedOn
                    ? `Based on: ${this.currentDraft.basedOn.name}`
                    : 'New configuration';
            }
        }

        // Calculate stats for PCMS devices
        let totalRules = 0;
        const devicesData = this.data.devices.map(device => {
            const rules = this.loadDeviceRules(device.deviceNumber);
            totalRules += rules.length;
            return {
                ...device,
                rules: rules
            };
        });

        // Calculate stats for web beacons
        const webBeaconsData = this.data.webBeacons.map(beacon => {
            const rules = this.loadDeviceRules(beacon.id);
            totalRules += rules.length;
            return {
                deviceNumber: beacon.id,
                deviceName: beacon.name,
                associatedSensors: beacon.associatedSensors || [],
                rules: rules
            };
        });

        const totalDeviceCount = devicesData.length + webBeaconsData.length;

        // Update stats
        if (totalDevicesEl) {
            totalDevicesEl.textContent = `${totalDeviceCount} Devices`;
        }
        if (totalRulesEl) {
            totalRulesEl.textContent = `${totalRules} Rules`;
        }

        // Render device cards
        container.innerHTML = '';

        // PCMS Devices section
        const pcmsHeader = document.createElement('div');
        pcmsHeader.className = 'overview-section-header';
        pcmsHeader.innerHTML = `PCMS Devices <span class="section-count">${devicesData.length}</span>`;
        container.appendChild(pcmsHeader);

        devicesData.forEach(device => {
            const card = this.createOverviewDeviceCard(device, 'pcms');
            container.appendChild(card);
        });

        // Web Beacons section
        const wbHeader = document.createElement('div');
        wbHeader.className = 'overview-section-header';
        wbHeader.innerHTML = `Web Beacons <span class="section-count">${webBeaconsData.length}</span>`;
        container.appendChild(wbHeader);

        webBeaconsData.forEach(beacon => {
            const card = this.createOverviewDeviceCard(beacon, 'webbeacon');
            container.appendChild(card);
        });
    }

    // Expand all devices in draft overview
    expandAllDraftDevices() {
        const contents = document.querySelectorAll('#draft-overview-devices .overview-device-content');
        const chevrons = document.querySelectorAll('#draft-overview-devices .overview-device-chevron');

        contents.forEach(content => content.classList.remove('collapsed'));
        chevrons.forEach(chevron => chevron.style.transform = 'rotate(180deg)');
    }

    // Collapse all devices in draft overview
    collapseAllDraftDevices() {
        const contents = document.querySelectorAll('#draft-overview-devices .overview-device-content');
        const chevrons = document.querySelectorAll('#draft-overview-devices .overview-device-chevron');

        contents.forEach(content => content.classList.add('collapsed'));
        chevrons.forEach(chevron => chevron.style.transform = 'rotate(0deg)');
    }

    // Rename the current draft
    renameDraft() {
        if (!this.currentDraft) return;

        const newName = prompt('Enter a new name for this draft:', this.currentDraft.name);
        if (!newName || !newName.trim() || newName.trim() === this.currentDraft.name) return;

        this.currentDraft.name = newName.trim();
        this.saveDrafts();

        // Update UI
        const draftNameEl = document.getElementById('draft-overview-name');
        const headerDraftName = document.getElementById('header-draft-name');

        if (draftNameEl) draftNameEl.textContent = this.currentDraft.name;
        if (headerDraftName) headerDraftName.textContent = this.currentDraft.name;

        this.showToast('Draft renamed');
    }

    // Scroll to and expand/collapse a device in the draft overview
    scrollToDraftDevice(deviceNumber) {
        const container = document.getElementById('draft-overview');
        const devicesContainer = document.getElementById('draft-overview-devices');
        if (!container || !devicesContainer) return;

        const deviceCards = container.querySelectorAll('.overview-device-card');
        const targetCard = Array.from(deviceCards).find(card =>
            parseInt(card.dataset.deviceId) === deviceNumber
        );

        if (!targetCard) return;

        const content = targetCard.querySelector('.overview-device-content');
        const chevron = targetCard.querySelector('.overview-device-chevron');
        const isCurrentlyCollapsed = content && content.classList.contains('collapsed');

        // Check if this device is already active (clicked again)
        const deviceItem = document.querySelector(`.device-item[data-device-id="${deviceNumber}"]`);
        const isAlreadyActive = deviceItem && deviceItem.classList.contains('active');

        if (isAlreadyActive && !isCurrentlyCollapsed) {
            // Toggle: collapse if already expanded and active
            if (content) content.classList.add('collapsed');
            if (chevron) chevron.style.transform = 'rotate(0deg)';

            // Remove active state
            document.querySelectorAll('.device-item').forEach(item => {
                item.classList.remove('active');
            });
            return;
        }

        // Expand this device
        if (content) content.classList.remove('collapsed');
        if (chevron) chevron.style.transform = 'rotate(180deg)';

        // Update active state in device list
        document.querySelectorAll('.device-item').forEach(item => {
            item.classList.remove('active');
            if (parseInt(item.dataset.deviceId) === deviceNumber) {
                item.classList.add('active');
            }
        });

        // Scroll card into view (works regardless of which ancestor scrolls)
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Highlight briefly
        targetCard.classList.add('highlighted');
        setTimeout(() => targetCard.classList.remove('highlighted'), 2000);
    }

    // Create a device card for the overview
    createOverviewDeviceCard(device, deviceType = 'pcms') {
        const card = document.createElement('div');
        card.className = `overview-device-card${device.rules.length === 0 ? ' no-rules' : ''}${deviceType === 'webbeacon' ? ' webbeacon-card' : ''}`;
        card.dataset.deviceId = device.deviceNumber;
        card.dataset.deviceType = deviceType;

        const ruleCount = device.rules.length;
        const ruleCountClass = ruleCount === 0 ? 'empty' : '';

        let rulesHtml = '';
        if (ruleCount === 0) {
            rulesHtml = `
                <div class="overview-no-rules">
                    No rules configured
                    <div class="overview-add-rules-hint">
                        <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
                            <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/>
                        </svg>
                        Click to add rules
                    </div>
                </div>
            `;
        } else {
            rulesHtml = `<div class="overview-rules-list">`;
            device.rules.forEach((rule, index) => {
                const metric = this.data.metrics.find(m => m.id == rule.metric);
                const sensor = this.data.sensors.find(s => s.id == rule.sensor);

                const metricName = metric ? metric.name : 'Unknown Metric';
                let sensorName = sensor ? sensor.name : 'Unknown Sensor';

                // Handle aggregate metrics
                if (metric && (metric.value.includes('_any') || metric.value.includes('_all'))) {
                    sensorName = metric.value.includes('_any') ? 'Any Sensor' : 'All Sensors';
                }

                const conditionText = rule.operator === 'less' ? 'less than' : 'greater than';
                let unitText = '';
                if (metric) {
                    if (metric.value && metric.value.includes('speed')) unitText = 'MPH';
                    else if (metric.value && metric.value.includes('travel_time')) unitText = 'minutes';
                    else unitText = 'vehicles/minute';
                }

                let displayText;
                if (rule.outputType === 'flash' || deviceType === 'webbeacon') {
                    displayText = '<span class="pill pill-flash">Flash</span>';
                } else {
                    const screen1Text = rule.screen1.filter(l => l).join(' | ') || '—';
                    displayText = rule.sameAsScreen1
                        ? screen1Text
                        : `${screen1Text} → ${rule.screen2.filter(l => l).join(' | ') || '—'}`;
                }

                rulesHtml += `
                    <div class="unified-rule-item">
                        <span class="unified-rule-number">#${index + 1}</span>
                        <span class="unified-rule-text">If</span>
                        <span class="pill pill-metric">${metricName}</span>
                        <span class="pill pill-sensor">${sensorName}</span>
                        <span class="unified-rule-text">is ${conditionText}</span>
                        <span class="pill ${this.getThresholdClass(rule.threshold)}">${rule.threshold} ${unitText}</span>
                        <span class="unified-rule-text">then</span>
                        <span class="unified-rule-display">${displayText}</span>
                    </div>
                `;
            });
            rulesHtml += `</div>`;
        }

        // Build sensor pills HTML
        const associatedSensors = device.associatedSensors || [];
        let sensorPillsHtml = '';
        if (associatedSensors.length > 0) {
            const sensorNames = associatedSensors
                .map(sensorId => this.data.sensors.find(s => s.id === sensorId))
                .filter(Boolean)
                .sort((a, b) => a.name.localeCompare(b.name));

            sensorPillsHtml = sensorNames
                .map(s => `<span class="overview-sensor-pill${s.isBluetooth ? ' overview-sensor-pill-bt' : ''}">${s.name}</span>`)
                .join('');
        }

        card.innerHTML = `
            <div class="overview-device-header">
                <span class="overview-device-name">${device.deviceName}</span>
                <div class="overview-device-sensors">${sensorPillsHtml}</div>
                <div class="overview-device-meta">
                    <button class="btn-toggle-preview" title="Toggle preview">
                        <svg class="overview-device-chevron" xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor" style="transform: rotate(180deg);">
                            <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="overview-device-content">
                ${rulesHtml}
            </div>
        `;

        // Entire card click goes to Edit (except chevron button)
        const content = card.querySelector('.overview-device-content');
        const chevron = card.querySelector('.overview-device-chevron');
        const toggleBtn = card.querySelector('.btn-toggle-preview');

        card.addEventListener('click', (e) => {
            // If clicking the toggle button, expand/collapse instead
            if (e.target.closest('.btn-toggle-preview')) return;
            this.showDeviceEditView(device.deviceNumber, deviceType);
        });

        // Toggle button expands/collapses preview
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            content.classList.toggle('collapsed');
            chevron.style.transform = content.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
        });

        return card;
    }

    // Save current draft state (persists changes without going live)
    saveDraftState() {
        if (!this.currentDraft) return;

        // Gather current device rules from localStorage and save to draft
        this.currentDraft.devices = this.data.devices.map(device => {
            const rules = this.loadDeviceRules(device.deviceNumber);
            const fallbackMessage = this.loadFallbackMessage(device.deviceNumber);
            const sensors = (device.associatedSensors || []).map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                return sensor ? { id: sensor.id, name: sensor.name } : null;
            }).filter(Boolean);

            return {
                deviceNumber: device.deviceNumber,
                deviceName: device.deviceName,
                associatedSensors: device.associatedSensors,
                sensors: sensors,
                rules: rules,
                fallbackMessage: fallbackMessage
            };
        });

        // Gather current web beacon rules from localStorage and save to draft
        this.currentDraft.webBeacons = this.data.webBeacons.map(beacon => {
            const rules = this.loadDeviceRules(beacon.id);
            const sensors = (beacon.associatedSensors || []).map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                return sensor ? { id: sensor.id, name: sensor.name } : null;
            }).filter(Boolean);

            return {
                deviceNumber: beacon.id,
                deviceName: beacon.name,
                deviceType: 'webbeacon',
                associatedSensors: beacon.associatedSensors,
                sensors: sensors,
                rules: rules
            };
        });

        this.currentDraft.lastModified = new Date().toISOString();

        // Save drafts to localStorage
        this.saveDrafts();

        // Refresh the overview if visible
        const overview = document.getElementById('draft-overview');
        if (overview && !overview.classList.contains('hidden')) {
            this.renderDraftOverview();
        }

        // Show brief confirmation
        this.showToast('Draft saved');
    }

    // Show a brief toast notification
    showToast(message) {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // Set draft to live (shows dialog for required notes)
    showSaveVersionDialog() {
        if (!this.currentDraft) return;

        const modal = document.getElementById('save-version-modal');
        document.getElementById('save-version-name').value = this.currentDraft.name;
        document.getElementById('save-version-notes').value = '';

        // Update dialog text
        document.getElementById('save-version-title').textContent = 'Set to Live';
        const basedOnText = this.currentDraft.basedOn
            ? `Based on: ${this.currentDraft.basedOn.name}`
            : 'New configuration';
        document.getElementById('save-version-context').textContent = basedOnText;

        modal.classList.remove('hidden');
        document.getElementById('save-version-notes').focus();
    }

    // Publish draft - creates a new message set in project history
    confirmSaveVersion() {
        const name = document.getElementById('save-version-name').value.trim();
        const notes = document.getElementById('save-version-notes').value.trim();

        if (!name) {
            alert('Please enter a name for this message set.');
            return;
        }

        if (!notes) {
            alert('Please enter a description of what changed. This helps identify configurations later.');
            return;
        }

        // Gather current device state
        const devices = this.data.devices.map(device => {
            const rules = this.loadDeviceRules(device.deviceNumber);
            const fallbackMessage = this.loadFallbackMessage(device.deviceNumber);
            const sensors = (device.associatedSensors || []).map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                return sensor ? { id: sensor.id, name: sensor.name } : null;
            }).filter(Boolean);

            return {
                deviceNumber: device.deviceNumber,
                deviceName: device.deviceName,
                sensors: sensors,
                rules: rules,
                fallbackMessage: fallbackMessage,
                pcmsCode: this.generatePcmsCodeForRules(rules)
            };
        });

        // Gather web beacon state
        const webBeacons = this.data.webBeacons.map(beacon => {
            const rules = this.loadDeviceRules(beacon.id);
            const sensors = (beacon.associatedSensors || []).map(sensorId => {
                const sensor = this.data.sensors.find(s => s.id === sensorId);
                return sensor ? { id: sensor.id, name: sensor.name } : null;
            }).filter(Boolean);

            return {
                deviceNumber: beacon.id,
                deviceName: beacon.name,
                deviceType: 'webbeacon',
                sensors: sensors,
                rules: rules
            };
        });

        // Create new message set entry in project history (no versions)
        const newId = Math.max(0, ...this.messageSets.map(s => s.id)) + 1;
        this.messageSets.push({
            id: this.currentDraft.id, //newId,
            name: name,
            timestamp: new Date().toISOString(),
            notes: notes,
            devices: devices,
            webBeacons: webBeacons
        });

        this.saveMessageSets();
        //this.renderProjectHistory();

        //// Remove the draft if it was saved from an existing draft
        //if (this.currentDraft && this.currentDraft.id) {
        //    this.drafts = this.drafts.filter(d => d.id !== this.currentDraft.id);
        //    this.saveDrafts();
        //    this.renderDraftsList();
        //}

        //// Close modal and exit draft mode
        //document.getElementById('save-version-modal').classList.add('hidden');
        //this.hideDraftMode();

        //// Return to homepage
        //this.goToHomepage();

        //alert('Message set published to Project History!');
    }

    cancelSaveVersion() {
        document.getElementById('save-version-modal').classList.add('hidden');
    }

    discardDraft() {
        if (confirm('Discard this draft? Any unsaved changes will be lost.')) {
            this.hideDraftMode();
            this.goToHomepage();
        }
    }

    exportMessageSetCSV() {
        if (!this.viewingMessageSet || !this.viewingVersion) return;

        const version = this.viewingMessageSet.versions.find(v => v.version === this.viewingVersion);
        if (!version) return;

        const timestamp = new Date(version.timestamp);
        const formattedDateTime = timestamp.toISOString().replace(/[:.]/g, '-');

        // Build CSV content
        let csv = 'Device Number,Device Name,Rule #,Sensor,Metric,Condition,Threshold,Screen 1,Screen 2\n';

        version.devices.forEach(device => {
            if (device.rules && device.rules.length > 0) {
                device.rules.forEach((rule, index) => {
                    const metric = this.data.metrics.find(m => m.id == rule.metric);
                    const sensor = this.data.sensors.find(s => s.id == rule.sensor);

                    const metricName = metric ? metric.name : 'Unknown';
                    let sensorName = sensor ? sensor.name : 'Unknown';
                    if (metric && metric.value.includes('_any')) sensorName = 'Any Sensor';
                    if (metric && metric.value.includes('_all')) sensorName = 'All Sensors';

                    const condition = rule.operator === 'less' ? 'Less Than' : 'Greater Than';
                    const screen1 = rule.screen1.join('|');
                    const screen2 = rule.sameAsScreen1 ? screen1 : rule.screen2.join('|');

                    csv += `${device.deviceNumber},"${device.deviceName}",${index + 1},"${sensorName}","${metricName}",${condition},${rule.threshold},"${screen1}","${screen2}"\n`;
                });
            } else {
                csv += `${device.deviceNumber},"${device.deviceName}",0,"N/A","No rules configured","N/A",0,"",""\n`;
            }
        });

        console.log('CSV Export:', csv);
        alert(`CSV Export Generated!\n\nFilename: ${this.viewingMessageSet.name}_v${this.viewingVersion}_${formattedDateTime}.csv\n\n(In production, this would download the file. Check console for CSV content.)`);
    }

    exportHistoryCSV() {
        if (!this.viewingHistoryEntry) return;

        const entry = this.viewingHistoryEntry;
        const timestamp = new Date(entry.timestamp);
        const formattedDateTime = timestamp.toISOString().replace(/[:.]/g, '-');

        // Build CSV content
        let csv = 'Device Number,Device Name,Rule #,Sensor,Metric,Condition,Threshold,Screen 1,Screen 2,Timestamp\n';

        entry.devices.forEach(device => {
            if (device.rules && device.rules.length > 0) {
                device.rules.forEach((rule, index) => {
                    const metric = this.data.metrics.find(m => m.id == rule.metric);
                    const sensor = this.data.sensors.find(s => s.id == rule.sensor);

                    const metricName = metric ? metric.name : 'Unknown';
                    let sensorName = sensor ? sensor.name : 'Unknown';
                    if (metric && metric.value.includes('_any')) sensorName = 'Any Sensor';
                    if (metric && metric.value.includes('_all')) sensorName = 'All Sensors';

                    const condition = rule.operator === 'less' ? 'Less Than' : 'Greater Than';
                    const screen1 = rule.screen1.join('|');
                    const screen2 = rule.sameAsScreen1 ? screen1 : rule.screen2.join('|');

                    csv += `${device.deviceNumber},"${device.deviceName}",${index + 1},"${sensorName}","${metricName}",${condition},${rule.threshold},"${screen1}","${screen2}",${entry.timestamp}\n`;
                });
            } else {
                csv += `${device.deviceNumber},"${device.deviceName}",0,"N/A","No rules configured","N/A",0,"","",${entry.timestamp}\n`;
            }
        });

        // Simulate download (for PoC, just show alert)
        console.log('CSV Export:', csv);
        alert(`CSV Export Generated!\n\nFilename: pcms_history_${formattedDateTime}.csv\n\n(In production, this would download the file. Check console for CSV content.)`);
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PCMSApp();
});

document.getElementById('redirectButton').onclick = function (event) {
    event.preventDefault();

    // Redirect to the home page
    window.location.href = `/?pid=${encodeURIComponent(ProjectName)}`;
};
