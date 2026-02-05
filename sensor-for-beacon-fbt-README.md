# Sensor - for Beacon FBT - Detail Page Documentation

## Overview

This page provides a detail/edit view for **Sensor - for Beacon FBT** devices within the Trafficlynx system. It allows users to view and modify sensor properties and includes **two operating modes**:

1. **Beacon FBT Assignment** - Associate this sensor with a beacon
2. **Sensor Chain** - Build chains of sensors with distance relationships

---

## Key Differences from Sensor - for Beacon TWS

| Feature | Sensor TWS | Sensor FBT |
|---------|------------|------------|
| Mode Toggle | ❌ No | ✅ Yes (Beacon/Chain) |
| Sensor Chain | ❌ No | ✅ Yes |
| View Beacon Logic | ❌ No | ✅ Yes |
| Sensor Distance display | ❌ No | ✅ Yes |
| Adjacent Sensors display | ❌ No | ✅ Yes |
| localStorage keys | `projectTWSSensors` | `projectFBTSensors` |

---

## Page Layout

The page uses a **three-column flexbox layout**:

| Column | Width | Purpose |
|--------|-------|---------|
| Left (`universal`) | 20% | Universal device information fields |
| Center (`detail`) | 60% | **Sensor Distance** + **Adjacent Sensors** + XML Name |
| Right (`sidebar`) | 20% | **Mode Toggle** + Beacon/Chain UI |

---

## Data Structures

### Beacon Object

```javascript
{
    id: number,               // Unique identifier
    name: string,             // Display name (e.g., "NB Main St Beacon FBT")
    assignedSensor: string|null  // Name of sensor assigned to this beacon
}
```

### Chain Sensor Object (for Sensor Chain mode)

```javascript
{
    id: number,       // Unique identifier
    name: string      // Display name (e.g., "Chain Sensor 1")
}
```

---

## FBT-Specific Features

### 1. Mode Toggle

The sidebar includes a dropdown to switch between two modes:

```html
<select id="modeToggle" onchange="toggleMode()">
    <option value="beacon" selected>Beacon FBT Assignment</option>
    <option value="chain">Sensor Chain</option>
</select>
```

**JavaScript:**
```javascript
function toggleMode() {
    const mode = document.getElementById('modeToggle').value;
    document.getElementById('beaconUi').classList.toggle('active', mode === 'beacon');
    document.getElementById('chainUi').classList.toggle('active', mode === 'chain');
}
```

### 2. Sensor Distance & Adjacent Sensors Display

The center panel shows read-only information:

| Display | ID | Format | Example |
|---------|-----|--------|---------|
| Sensor Distance | `sensorDistanceDisplay` | `upstream | downstream` | `1 | 1` |
| Adjacent Sensors | `adjacentSensorsDisplay` | `upstream | downstream` | `0 | Sensor 2 EB` |

### 3. Sensor Chain Builder

When in "Sensor Chain" mode, users can:

- **Add Chain** - Creates a new chain container
- **Add Sensor** - Adds a sensor to an existing chain
- **Remove** - Removes a sensor from a chain

Each chain contains:
- Chain heading (Chain 1, Chain 2, etc.)
- Sensor dropdowns (from `chainSensors` array)
- Distance input fields (in miles)

---

## Key Form Fields

### Universal Device Information (Left Panel)

| Field ID | Type | Description |
|----------|------|-------------|
| `deviceType` | select (disabled) | Always "Sensor - for Beacon FBT" |
| `deviceName` | text | **Primary identifier** - used for beacon matching |
| `contractorLabel` | text | Secondary identifier |
| `notes` | text | Free-form notes |
| `ipAddress` | text | Network IP address |
| `port` | text | Network port |
| `latitude` | text | GPS latitude |
| `longitude` | text | GPS longitude |
| `roadway` | text | Road/highway name |
| `direction` | select | Cardinal direction (N/S/E/W) |
| `displayIcon` | checkbox | Show on map |
| `processVoltage` | checkbox | Monitor voltage |

### Device-Specific Details (Center Panel)

| Element ID | Type | Description |
|------------|------|-------------|
| `sensorDistanceDisplay` | span | Upstream/downstream distances |
| `adjacentSensorsDisplay` | span | Upstream/downstream sensor names |
| `xmlName` | text input | XML export identifier |

---

## Key JavaScript Functions

### FBT-Specific Functions

| Function | Purpose |
|----------|---------|
| `toggleMode()` | Switches between Beacon and Chain UIs |
| `addChain()` | Creates new chain container |
| `addSensorToChain(btn)` | Adds sensor to existing chain |
| `removeSensor(link)` | Removes sensor from chain |
| `buildSensorOptions()` | Generates dropdown options from chainSensors |
| `viewBeaconLogic()` | Opens beacon logic editor (simulated) |

### Beacon Association Functions

| Function | Purpose |
|----------|---------|
| `updateAssignedBeaconDisplay()` | Updates header display box |
| `populateBeaconList()` | Rebuilds beacon list |
| `setAssociatedBeacon()` | Main "Set Device" handler |
| `updateBeaconAssignments()` | Updates data structure |

---

## Storage Keys (localStorage)

| Key | Data Type | Description |
|-----|-----------|-------------|
| `projectFBTSensors` | JSON Array | List of FBT sensors (shared with beacon-fbt.html) |
| `projectBeaconsFBT` | JSON Array | List of Beacon FBT devices |

> **Production Note:** Replace localStorage with your actual database API calls.

---

## Sensor Chain Data Model

When implementing the chain functionality in production, consider this data structure:

```javascript
{
    chainId: number,
    chainName: string,
    sensors: [
        {
            sensorId: number,
            distanceUpstream: number,    // miles
            distanceDownstream: number   // miles
        }
    ]
}
```

---

## CSS Classes for Mode Toggle

| Class | Purpose |
|-------|---------|
| `.beacon-ui` | Container for Beacon Assignment mode |
| `.chain-ui` | Container for Sensor Chain mode |
| `.active` | Added to visible mode container |
| `.chain-container` | Individual chain box |
| `.input-section` | Sensor row within chain |

---

## Integration Points

When integrating with your backend system, you'll need to:

1. **Replace localStorage calls** with API endpoints:
   - `GET /api/fbt-beacons` - Load beacons list
   - `GET /api/fbt-sensors/{id}` - Load sensor details
   - `POST /api/fbt-beacons` - Create new beacon
   - `PUT /api/fbt-sensors/{id}` - Update sensor
   - `GET /api/chain-sensors` - Load available chain sensors
   - `POST /api/sensor-chains` - Save chain configuration

2. **Implement viewBeaconLogic()**:
   - Navigate to beacon logic editor
   - Pass appropriate IDs

3. **Populate Sensor Distance/Adjacent Sensors**:
   - These are currently static mockup values
   - Should be calculated from actual sensor chain data

4. **Save chain data**:
   - Current implementation is UI-only
   - Needs API integration to persist chains

5. **Handle mode in form submission**:
   - `saveAndCreateNew()` already captures mode value
   - Validation changes based on mode

---

## Debug Helper

Call from browser console to reset demo data:

```javascript
resetDemoData()
```

This restores three demo beacons with different assignment states.

---

## Validation Rules

| Mode | Field | Rule |
|------|-------|------|
| Both | `deviceName` | Required |
| Beacon | `associatedBeacon` | Required (selectedBeaconId) |
| Chain | Chain data | Not validated in mockup |

```javascript
function saveAndCreateNew() {
    // Mode-aware validation
    if (formData.mode === 'beacon' && !formData.associatedBeacon) {
        alert('Please select an associated Beacon FBT');
        return;
    }
}
```
