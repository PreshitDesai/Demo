# Beacon TWS - Detail Page Documentation

## Overview

This page provides a detail/edit view for **Beacon TWS** devices within the Trafficlynx system. It allows users to view and modify beacon properties, and most importantly, manage the **one-to-one relationship** between Beacon TWS devices and their associated sensors.

---

## Page Layout

The page uses a **three-column flexbox layout**:

| Column | Width | Purpose |
|--------|-------|---------|
| Left (`universal`) | 20% | Universal device information fields |
| Center (`detail`) | 60% | Device-specific details |
| Right (`sidebar`) | 20% | Sensor association management |

---

## Data Structures

### Sensor Object

```javascript
{
    id: number,           // Unique identifier (currently using timestamps for mockup)
    name: string,         // Display name (e.g., "TWS Sensor A419")
    ip: string,           // IP address (e.g., "192.168.1.100")
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

## Key Form Fields

### Universal Device Information (Left Panel)

| Field ID | Type | Description | Validation |
|----------|------|-------------|------------|
| `deviceType` | select (disabled) | Always "Beacon TWS" | Read-only |
| `deviceName` | text | **Primary identifier** - used for sensor matching | Required |
| `contractorLabel` | text | Secondary identifier for contractors | Optional |
| `notes` | text | Free-form notes | Optional |
| `ipAddress` | text | Network IP address | Optional |
| `port` | text | Network port | Optional |
| `latitude` | text | GPS latitude | Optional |
| `longitude` | text | GPS longitude | Optional |
| `roadway` | text | Road/highway name | Optional |
| `direction` | select | Cardinal direction (N/S/E/W) | Optional |
| `displayIcon` | checkbox | Show on map | Default: checked |
| `processVoltage` | checkbox | Monitor voltage | Default: checked |

### Device-Specific Details (Center Panel)

| Field ID | Type | Description |
|----------|------|-------------|
| `xmlName` | text | XML export/import identifier |

> **Note:** Beacon TWS devices do **NOT** have Sensor Distance or Beacon Logic sections (those are specific to other device types).

---

## Sensor Association Logic

### Business Rules

1. **One-to-One Relationship**: Each Beacon TWS can have only ONE sensor assigned
2. **Exclusive Assignment**: Each sensor can only be assigned to ONE beacon at a time
3. **Auto-Unassign**: When assigning a new sensor, the previously assigned sensor is automatically unassigned
4. **Reassignment Confirmation**: If selecting a sensor already assigned to another beacon, user must confirm the reassignment

### Sensor States (Visual Indicators)

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
| `updateAssignedSensorDisplay()` | Updates the "Assigned Sensor" header box |
| `populateSensorList()` | Rebuilds the sensor list with current states |
| `updateSelectedSensor(id)` | Tracks which sensor radio button is selected |

### Assignment Logic

| Function | Purpose |
|----------|---------|
| `setAssociatedSensor()` | Main handler for "Set Device" button - validates and processes assignment |
| `confirmAssociation(sensorId, override)` | Handles confirmation dialog response |
| `updateAssignments(sensorId, newAssignment)` | Updates data structure with new assignment |

### Modal Management

| Function | Purpose |
|----------|---------|
| `openAddSensorModal()` | Opens and resets the "Add Sensor" modal |
| `saveNewSensor()` | Creates new sensor from modal form |
| `openModal(modalId)` | Generic modal open |
| `closeModal(modalId)` | Generic modal close |

### Form Actions

| Function | Purpose |
|----------|---------|
| `saveAndCreateNew()` | Saves beacon and prepares blank form |
| `saveAndBack()` | Saves beacon and navigates to list |
| `deleteDevice()` | Deletes current beacon (simulated) |
| `goBack()` | Navigates to list (simulated) |

---

## Storage Keys (localStorage)

| Key | Data Type | Description |
|-----|-----------|-------------|
| `projectTWSSensors` | JSON Array | List of all sensors |
| `projectBeaconsTWS` | JSON Array | List of all Beacon TWS devices |

> **Production Note:** Replace localStorage with your actual database API calls.

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
   - `GET /api/sensors` - Load sensors list
   - `GET /api/beacons/{id}` - Load beacon details
   - `POST /api/sensors` - Create new sensor
   - `PUT /api/beacons/{id}` - Update beacon
   - `PUT /api/sensors/{id}/assign` - Assign sensor to beacon

2. **Map field names** to your database schema (see form fields table above)

3. **Implement navigation**:
   - `goBack()` should navigate to your device list page
   - After save, redirect appropriately

4. **Handle currentBeaconId**:
   - Currently hardcoded as `1`
   - Should come from URL parameter or route

---

## Debug Helper

Call from browser console to reset demo data:

```javascript
resetDemoData()
```

This restores the three demo sensors with different assignment states:
- One available
- One assigned to another beacon
- One assigned to current beacon
