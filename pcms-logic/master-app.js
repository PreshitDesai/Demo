/**
 * Master Application Controller
 * Manages the top-level tab navigation between different Logic Builder modules
 * (PCMS, Bluetooth, and future modules)
 */

class MasterApp {
    constructor() {
        this.activeTab = 'pcms';
        this.tabs = ['pcms', 'bluetooth'];
        this.tabInstances = {};

        this.init();
    }

    init() {
        this.setupTabListeners();
        this.restoreActiveTab();
    }

    /**
     * Set up click listeners for master tab navigation
     */
    setupTabListeners() {
        const tabButtons = document.querySelectorAll('.master-tab');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabId = button.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });
    }

    /**
     * Switch to a specific tab
     * @param {string} tabId - The ID of the tab to switch to
     */
    switchTab(tabId) {
        if (!this.tabs.includes(tabId)) {
            console.warn(`Unknown tab: ${tabId}`);
            return;
        }

        // Update active state on tab buttons
        const tabButtons = document.querySelectorAll('.master-tab');
        tabButtons.forEach(button => {
            if (button.getAttribute('data-tab') === tabId) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Show/hide tab panels
        const tabPanels = document.querySelectorAll('.tab-panel');
        tabPanels.forEach(panel => {
            if (panel.id === `${tabId}-tab-content`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });

        this.activeTab = tabId;
        this.saveActiveTab();

        // Trigger tab-specific initialization if needed
        this.onTabActivated(tabId);
    }

    /**
     * Called when a tab is activated - can be used to initialize tab-specific functionality
     * @param {string} tabId - The ID of the activated tab
     */
    onTabActivated(tabId) {
        // Dispatch a custom event that tab modules can listen for
        const event = new CustomEvent('masterTabActivated', {
            detail: { tabId: tabId }
        });
        document.dispatchEvent(event);

        // Tab-specific initialization
        switch (tabId) {
            case 'pcms':
                // PCMS app initializes itself via app.js
                break;
            case 'bluetooth':
                if (window.btRouteManager) {
                    const formContainer = document.getElementById('bt-create-form-container');
                    const listContainer = document.getElementById('bt-route-list');
                    window.btRouteManager.renderCreateForm(formContainer);
                    window.btRouteManager.renderRouteList(listContainer);
                }
                break;
        }
    }

    /**
     * Save the active tab to localStorage for persistence
     */
    saveActiveTab() {
        try {
            localStorage.setItem('master_active_tab', this.activeTab);
        } catch (e) {
            console.warn('Could not save active tab to localStorage:', e);
        }
    }

    /**
     * Restore the previously active tab from localStorage
     */
    restoreActiveTab() {
        try {
            const savedTab = localStorage.getItem('master_active_tab');
            if (savedTab && this.tabs.includes(savedTab)) {
                this.switchTab(savedTab);
            }
        } catch (e) {
            console.warn('Could not restore active tab from localStorage:', e);
        }
    }

    /**
     * Register a tab module instance
     * @param {string} tabId - The tab ID
     * @param {object} instance - The module instance
     */
    registerTabModule(tabId, instance) {
        this.tabInstances[tabId] = instance;
    }

    /**
     * Get a registered tab module instance
     * @param {string} tabId - The tab ID
     * @returns {object|null} The module instance or null
     */
    getTabModule(tabId) {
        return this.tabInstances[tabId] || null;
    }

    /**
     * Get the currently active tab ID
     * @returns {string} The active tab ID
     */
    getActiveTab() {
        return this.activeTab;
    }
}

// Initialize the master application when DOM is ready
let masterApp;
document.addEventListener('DOMContentLoaded', () => {
    masterApp = new MasterApp();
});
