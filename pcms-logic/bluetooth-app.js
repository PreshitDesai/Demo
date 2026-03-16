// Bluetooth Route Manager
// Manages bluetooth routes as data sources for BT Speed / BT Travel Time metrics.
// Each route becomes a virtual sensor available in PCMS logic rules.
//
// In production, creating a route would:
//   1. Create a device via the backend API
//   2. Schedule a cronjob to poll the BT server for speed/travel_time data

class BluetoothRouteManager {
    constructor() {
        this.routes = [];
        this.load();
    }

    // ========================================
    // PERSISTENCE
    // ========================================

    load() {
        try {
            const saved = localStorage.getItem('bt_routes');
            if (saved) {
                this.routes = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Could not load BT routes from localStorage:', e);
        }
    }

    save() {
        try {
            localStorage.setItem('bt_routes', JSON.stringify(this.routes));
        } catch (e) {
            console.warn('Could not save BT routes to localStorage:', e);
        }
    }

    dispatchChange() {
        document.dispatchEvent(new CustomEvent('btRoutesChanged'));
    }

    // ========================================
    // CRUD
    // ========================================

    createRoute(name, bluetoothRouteId) {
        const route = {
            id: 'bt_route_' + Date.now(),
            name: name,
            bluetoothRouteId: bluetoothRouteId,
            created: new Date().toISOString()
        };
        this.routes.push(route);
        this.save();
        this.dispatchChange();
        return route;
    }

    updateRoute(id, fields) {
        const route = this.routes.find(r => r.id === id);
        if (!route) return null;
        Object.assign(route, fields);
        this.save();
        this.dispatchChange();
        return route;
    }

    deleteRoute(id) {
        this.routes = this.routes.filter(r => r.id !== id);
        this.save();
        this.dispatchChange();
    }

    getRoutes() {
        return this.routes;
    }

    // ========================================
    // VIRTUAL SENSORS
    // ========================================

    /**
     * Returns route entries shaped like sensor objects so they can be
     * merged into PCMSApp's this.data.sensors array.
     */
    getVirtualSensors() {
        return this.routes.map(r => ({
            id: r.id,
            name: r.name,
            isBluetooth: true
        }));
    }

    // ========================================
    // RENDERING
    // ========================================

    renderRouteList(container) {
        if (!container) return;

        if (this.routes.length === 0) {
            container.innerHTML = `
                <div class="bt-routes-empty">
                    <p>No bluetooth routes configured yet.</p>
                    <p class="hint">Create a route above to get started.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.routes.map(route => `
            <div class="bt-route-card" data-route-id="${route.id}">
                <div class="bt-route-card-info">
                    <span class="bt-route-card-name">${route.name}</span>
                    <span class="bt-route-card-id">Route ID: ${route.bluetoothRouteId}</span>
                </div>
                <div class="bt-route-card-actions">
                    <button class="btn-edit-route btn-small-secondary" data-route-id="${route.id}">Edit</button>
                    <button class="btn-delete-route btn-small-secondary" data-route-id="${route.id}">Delete</button>
                </div>
            </div>
        `).join('');

        // Edit buttons
        container.querySelectorAll('.btn-edit-route').forEach(btn => {
            btn.addEventListener('click', () => {
                const routeId = btn.dataset.routeId;
                this.showEditPrompt(routeId, container);
            });
        });

        // Delete buttons
        container.querySelectorAll('.btn-delete-route').forEach(btn => {
            btn.addEventListener('click', () => {
                const routeId = btn.dataset.routeId;
                const route = this.routes.find(r => r.id === routeId);
                if (route && confirm(`Delete route "${route.name}"?`)) {
                    this.deleteRoute(routeId);
                    this.renderRouteList(container);
                }
            });
        });
    }

    renderCreateForm(container) {
        if (!container) return;

        container.innerHTML = `
            <div class="bt-create-form">
                <div class="bt-create-form-inputs">
                    <div class="bt-form-field">
                        <label>Route Name</label>
                        <input type="text" id="bt-new-name" placeholder="e.g. IH35 NB Route" class="form-input">
                    </div>
                    <div class="bt-form-field">
                        <label>BT Route ID</label>
                        <input type="text" id="bt-new-route-id" placeholder="e.g. R-1001" class="form-input">
                    </div>
                </div>
                <button id="bt-create-btn" class="btn-primary">Create Route</button>
            </div>
        `;

        container.querySelector('#bt-create-btn').addEventListener('click', () => {
            const nameInput = container.querySelector('#bt-new-name');
            const routeIdInput = container.querySelector('#bt-new-route-id');
            const name = nameInput.value.trim();
            const btRouteId = routeIdInput.value.trim();

            if (!name) { alert('Please enter a route name.'); return; }
            if (!btRouteId) { alert('Please enter a BT Route ID.'); return; }

            this.createRoute(name, btRouteId);
            nameInput.value = '';
            routeIdInput.value = '';

            // Re-render the route list in the sibling container
            const listContainer = document.getElementById('bt-route-list');
            if (listContainer) this.renderRouteList(listContainer);
        });
    }

    showEditPrompt(routeId, listContainer) {
        const route = this.routes.find(r => r.id === routeId);
        if (!route) return;

        const newName = prompt('Route name:', route.name);
        if (newName === null) return; // cancelled
        const newBtId = prompt('BT Route ID:', route.bluetoothRouteId);
        if (newBtId === null) return; // cancelled

        if (newName.trim()) {
            this.updateRoute(routeId, {
                name: newName.trim(),
                bluetoothRouteId: newBtId.trim() || route.bluetoothRouteId
            });
            this.renderRouteList(listContainer);
        }
    }
}

// Global instance
window.btRouteManager = new BluetoothRouteManager();
