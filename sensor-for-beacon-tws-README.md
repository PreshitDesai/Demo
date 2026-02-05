# Sensor - for Beacon TWS - Detail Page Documentation

## Overview

This page provides a detail/edit view for **Sensor - for Beacon TWS** devices within the Trafficlynx system. It allows users to view and modify sensor properties, and manages the **one-to-one relationship** from the sensor's perspective—assigning this sensor to a Beacon TWS device.

---

## Relationship to beacon-tws.html

These two pages manage the **same relationship** but from opposite perspectives:

| Page | Shows List Of | Assigns |
|------|---------------|---------|
| `beacon-tws.html` | Sensors | Sensor → Beacon (assigns a sensor TO this beacon) |
| `sensor-for-beacon-tws.html` | Beacons | Sensor → Beacon (assigns THIS sensor to a beacon) |

**Important:** The assignment is stored on the **beacon object** (`beacon.assignedSensor`), not on the sensor. Both pages read/write to the same data structure.

---

## Page Layout

The page uses a **three-column flexbox layout**:

| Column | Width | Purpose |
|--------|-------|---------|
| Left (`universal`) | 20% | Universal device information fields |
| Center (`detail`) | 60% | Device-specific details |
| Right (`sidebar`) | 20% | Beacon association management |

---

## Data Structures

### Beacon Object (Primary for this page)

```javascript
{
    id: number,               // Unique identifier
    name: string,             // Display name (e.g., "NB Main St Beacon TWS")
    assignedSensor: string|null  // Name of sensor assigned to this beacon
}
```

### Sensor Object (Secondary - for cross-page data sharing)

```javascript
{
    id: number,           // Unique identifier
    name: string,         // Display name
    ip: string,           // IP address
    assignedTo: string|null  // (Not used on this page)
}
```

---

## Key Form Fields

### Universal Device Information (Left Panel)

| Field ID | Type | Description | Validation |
|----------|------|-------------|------------|
| `deviceType` | select (disabled) | Always "Sensor - for Beacon TWS" | Read-only |
| `deviceName` | text | **Primary identifier** - used for beacon assignment matching | Required |
| `contractorLabel` | text | Secondary identifier for contractors | Optional |
| `notes` | text | Free-form notes | Optional |
| `ipAddress` | text | Network IP address | Optional |
| `port` | text | Network port | Optional |
| `latitude` | text | GPS latitude | Optional |
| `longitude` | text | GPS longitude | Optional |
| `roadway` | text | Road/highway name | Optional |
| `direction` | select | Cardinal direction (N/S/E/W) | Optional |
| `displayIcon` | checkbox | Show on map | Default: unchecked |
| `processVoltage` | checkbox | Monitor voltage | Default: unchecked |

### Device-Specific Details (Center Panel)

| Field ID | Type | Description |
|----------|------|-------------|
| `xmlName` | text | XML export/import identifier |

> **Note:** Sensor - for Beacon TWS does **NOT** have:
> - Sensor Distance / Adjacent Sensors section
> - Sensor Chain functionality
> 
> These features are specific to other sensor types.

---

## Beacon Association Logic

### Business Rules

1. **One-to-One Relationship**: This sensor can only be assigned to ONE beacon
2. **Exclusive Assignment**: Each beacon can only have ONE sensor assigned at a time
3. **Auto-Unassign**: When assigning to a new beacon, the sensor is automatically removed from any previous beacon
4. **Reassignment Confirmation**: If selecting a beacon that already has a sensor, user must confirm the reassignment

### Beacon States (Visual Indicators)

| State | CSS Class | Background | Border | Badge |
|-------|-----------|------------|--------|-------|
| Available | `.available` | #e3f2fd (light blue) | #2196f3 | Blue "Available" |
| Assigned Here | `.current` | #e8f5e9 (light green) | #4caf50 | Green "Assigned Here" |
| Assigned to Other | `.assigned` | #fff3e0 (light orange) | #ff9800 | Orange "Assigned" |

---

## Key JavaScript Functions

### Data Management

| Function | Purpose |
|----------|---------|
| `saveToStorage()` | Persists data to localStorage (replace with API calls) |

### UI Updates

| Function | Purpose |
|----------|---------|
| `updateAssignedBeaconDisplay()` | Updates the "Assigned Beacon TWS" header box |
| `populateBeaconList()` | Rebuilds the beacon list with current states |
| `updateSelectedBeacon(id)` | Tracks which beacon radio button is selected |

### Assignment Logic

| Function | Purpose |
|----------|---------|
| `setAssociatedBeacon()` | Main handler for "Set Device" button - validates and processes assignment |
| `confirmAssociationBeacon(beaconId, override)` | Handles confirmation dialog response |
| `updateBeaconAssignments(beaconId, newAssignment)` | Updates data structure with new assignment |

### Modal Management

| Function | Purpose |
|----------|---------|
| `openAddBeaconModal()` | Opens and resets the "Add Beacon TWS" modal |
| `saveNewBeacon()` | Creates new beacon from modal form |
| `openModal(modalId)` | Generic modal open |
| `closeModal(modalId)` | Generic modal close |

### Form Actions

| Function | Purpose |
|----------|---------|
| `saveAndCreateNew()` | Saves sensor and prepares blank form |
| `saveAndBack()` | Saves sensor and navigates to list |
| `goBack()` | Navigates to list (simulated) |

---

## Storage Keys (localStorage)

| Key | Data Type | Description |
|-----|-----------|-------------|
| `projectTWSSensors` | JSON Array | List of all sensors (shared with beacon-tws.html) |
| `projectBeaconsTWS` | JSON Array | List of all Beacon TWS devices |

> **Production Note:** Replace localStorage with your actual database API calls.

---

## Differences from beacon-tws.html

| Feature | beacon-tws.html | sensor-for-beacon-tws.html |
|---------|-----------------|---------------------------|
| Delete Button | Yes | No |
| Sidebar Shows | Sensors | Beacons |
| Assignment Direction | Sensor → This Beacon | This Sensor → Beacon |
| Add New Creates | New Sensor | New Beacon |
| Data Field Modified | `sensor.assignedTo` | `beacon.assignedSensor` |

---

## CSS Variables (Theming)

```css
:root {
    --primary-color: #0081ea;       /* Buttons, focus states */
    --secondary-color: #03dac5;     /* Accent (unused in mockup) */
    --background-color: #f4f4f4;    /* Page background */
    --font-color: #333;             /* Primary text */
    --border-color: #757575;        /* Input borders */
    --error-color: #b5302e;         /* Error states */
}
```

---

## Integration Points

When integrating with your backend system, you'll need to:

1. **Replace localStorage calls** with API endpoints:
   - `GET /api/beacons` - Load beacons list
   - `GET /api/sensors/{id}` - Load sensor details
   - `POST /api/beacons` - Create new beacon
   - `PUT /api/sensors/{id}` - Update sensor
   - `PUT /api/beacons/{id}/assign-sensor` - Assign sensor to beacon

2. **Map field names** to your database schema (see form fields table above)

3. **Implement navigation**:
   - `goBack()` should navigate to your device list page
   - After save, redirect appropriately

4. **Handle currentSensorId**:
   - Currently hardcoded as `1`
   - Should come from URL parameter or route

5. **Synchronize with beacon-tws.html**:
   - Both pages modify the same relationship data
   - Ensure your API maintains consistency

---

## Debug Helper

Call from browser console to reset demo data:

```javascript
resetDemoData()
```

This restores the three demo beacons with different assignment states:
- One available (no sensor assigned)
- One assigned to a different sensor
- One assigned to the current sensor ("Test TWS Sensor")

---

## Notes on Feature Exclusions

This sensor type is specifically for Beacon TWS devices and intentionally **does NOT include**:

1. **Mode Toggle** - Only associates with Beacon TWS devices (no PCMS option)
2. **PCMS Sensor Chain** - Not applicable for Beacon TWS sensors
3. **Sensor Distance / Adjacent Sensors** - These are for other sensor types
4. **Delete Button** - Removed from top navigation (present in beacon-tws.html)

These exclusions are documented in HTML comments for clarity.
