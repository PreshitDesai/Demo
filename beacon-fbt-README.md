# Beacon FBT - Detail Page Documentation

## Overview

This page provides a detail/edit view for **Beacon FBT** devices within the Trafficlynx system. It allows users to view and modify beacon properties, manage the **one-to-one relationship** between Beacon FBT devices and their associated sensors, and includes **sensor distance calculation** using GPS coordinates.

---

## Key Differences from Beacon TWS

| Feature | Beacon TWS | Beacon FBT |
|---------|------------|------------|
| View Beacon Logic button | ❌ No | ✅ Yes |
| Sensor Distance display | ❌ No | ✅ Yes (Haversine formula) |
| Sensor lat/lng fields | ❌ No | ✅ Yes (for distance calc) |
| localStorage keys | `projectTWSSensors` | `projectFBTSensors` |

---

## Page Layout

The page uses a **three-column flexbox layout**:

| Column | Width | Purpose |
|--------|-------|---------|
| Left (`universal`) | 20% | Universal device information fields |
| Center (`detail`) | 60% | Device-specific details + **Sensor Distance** |
| Right (`sidebar`) | 20% | **View Beacon Logic** + Sensor association |

---

## Data Structures

### FBT Sensor Object (includes lat/lng)

```javascript
{
    id: number,           // Unique identifier
    name: string,         // Display name (e.g., "FBT Sensor A419")
    ip: string,           // IP address (e.g., "192.168.1.100")
    lat: number|null,     // Latitude for distance calculation
    lng: number|null,     // Longitude for distance calculation
    assignedTo: string|null  // Name of beacon assigned to, or null if available
}
```

### Beacon Object

```javascript
{
    id: number,           // Unique identifier
    deviceName: string,   // Primary name of the beacon
    xmlName: string,      // XML export identifier
    assignedSensor: number|null  // ID of assigned sensor
}
```

---

## FBT-Specific Features

### 1. Sensor Distance Calculation

The center panel displays the distance (in miles) from the beacon to the assigned sensor:

```javascript
// Haversine formula implementation
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}
```

**Display Element:**
```html
<span id="sensorDistanceDisplay">NaN</span> mile(s)
```

### 2. View Beacon Logic Button

Located at the top of the sidebar:
```javascript
function viewBeaconLogic() {
    // TODO: Navigate to beacon logic editor
    alert('View Beacon Logic - simulated');
}
```

---

## Key Form Fields

### Universal Device Information (Left Panel)

| Field ID | Type | Description | FBT Notes |
|----------|------|-------------|-----------|
| `deviceType` | select (disabled) | Always "Beacon FBT" | Read-only |
| `deviceName` | text | Primary identifier | Required, used for sensor matching |
| `contractorLabel` | text | Secondary identifier | Optional |
| `notes` | text | Free-form notes | Optional |
| `ipAddress` | text | Network IP address | Optional |
| `port` | text | Network port | Optional |
| `latitude` | text | GPS latitude | **Used for distance calc** |
| `longitude` | text | GPS longitude | **Used for distance calc** |
| `roadway` | text | Road/highway name | Optional |
| `direction` | select | Cardinal direction (N/S/E/W) | Optional |
| `displayIcon` | checkbox | Show on map | Default: checked |
| `processVoltage` | checkbox | Monitor voltage | Default: checked |

### Device-Specific Details (Center Panel)

| Field ID | Type | Description |
|----------|------|-------------|
| `xmlName` | text | XML export/import identifier |
| `sensorDistanceDisplay` | span (read-only) | Calculated distance to sensor |

---

## Key JavaScript Functions

### FBT-Specific Functions

| Function | Purpose |
|----------|---------|
| `calculateDistance(lat1, lon1, lat2, lon2)` | Haversine formula for GPS distance |
| `updateSensorDistance()` | Recalculates and updates distance display |
| `viewBeaconLogic()` | Opens beacon logic editor (simulated) |

### Data Management

| Function | Purpose |
|----------|---------|
| `saveToStorage()` | Persists to localStorage (replace with API) |

### UI Updates

| Function | Purpose |
|----------|---------|
| `updateAssignedSensorDisplay()` | Updates the "Assigned Sensor" header box |
| `populateSensorList()` | Rebuilds sensor list + updates distance |
| `updateSelectedSensor(id)` | Tracks selected radio button |

### Assignment Logic

| Function | Purpose |
|----------|---------|
| `setAssociatedSensor()` | Main "Set Device" button handler |
| `confirmAssociation(sensorId, override)` | Handles confirmation dialog |
| `updateAssignments(sensorId, newAssignment)` | Updates data structure |

---

## Storage Keys (localStorage)

| Key | Data Type | Description |
|-----|-----------|-------------|
| `projectFBTSensors` | JSON Array | List of all FBT sensors (with lat/lng) |
| `projectBeaconsFBT` | JSON Array | List of all Beacon FBT devices |

> **Production Note:** Replace localStorage with your actual database API calls.

---

## CSS Variables (Theming)

```css
:root {
    --primary-color: #0081ea;
    --secondary-color: #03dac5;
    --background-color: #f4f4f4;
    --font-color: #333;
    --border-color: #757575;
    --error-color: #b5302e;
}
```

---

## Integration Points

When integrating with your backend system, you'll need to:

1. **Replace localStorage calls** with API endpoints:
   - `GET /api/fbt-sensors` - Load sensors list (with lat/lng)
   - `GET /api/fbt-beacons/{id}` - Load beacon details
   - `POST /api/fbt-sensors` - Create new sensor
   - `PUT /api/fbt-beacons/{id}` - Update beacon
   - `PUT /api/fbt-sensors/{id}/assign` - Assign sensor to beacon

2. **Implement viewBeaconLogic()**:
   - Navigate to beacon logic editor page
   - Pass beacon ID as parameter

3. **Dynamic beacon coordinates**:
   - Currently uses hardcoded `currentBeaconLat` and `currentBeaconLng`
   - Should read from `#latitude` and `#longitude` form fields

4. **Map field names** to your database schema

---

## Debug Helper

Call from browser console to reset demo data:

```javascript
resetDemoData()
```

This restores three demo sensors with:
- Different assignment states
- Unique GPS coordinates for distance testing
