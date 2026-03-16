// Sample Data Loader - Run this in browser console to populate test data

function loadSampleData() {
    // Sample rules for device 42 (IH35 SB Split)
    const sampleRulesDevice42 = {
        deviceNumber: 42,
        rules: [
            {
                id: 1,
                metric: '1',
                sensor: '1',
                operator: 'less',
                threshold: '30',
                screen1: ['STOPPED', 'TRAFFIC', 'AHEAD'],
                screen2: ['STOPPED', 'TRAFFIC', 'AHEAD'],
                sameAsScreen1: true
            },
            {
                id: 2,
                metric: '1',
                sensor: '2',
                operator: 'less',
                threshold: '40',
                screen1: ['SLOW', 'TRAFFIC', 'AHEAD'],
                screen2: ['SLOW', 'TRAFFIC', 'AHEAD'],
                sameAsScreen1: true
            },
            {
                id: 3,
                metric: '1',
                sensor: '3',
                operator: 'less',
                threshold: '50',
                screen1: ['CAUTION', 'AHEAD', ''],
                screen2: ['REDUCE', 'SPEED', ''],
                sameAsScreen1: false
            }
        ],
        lastModified: new Date().toISOString()
    };

    // Sample rules for device 43 (IH35 NB)
    const sampleRulesDevice43 = {
        deviceNumber: 43,
        rules: [
            {
                id: 1,
                metric: '1',
                sensor: '5',
                operator: 'less',
                threshold: '35',
                screen1: ['SLOW', 'TRAFFIC', 'AHEAD'],
                screen2: ['SLOW', 'TRAFFIC', 'AHEAD'],
                sameAsScreen1: true
            },
            {
                id: 2,
                metric: '2',
                sensor: '6',
                operator: 'greater',
                threshold: '15',
                screen1: ['EXPECT', 'DELAYS', ''],
                screen2: ['EXPECT', 'DELAYS', ''],
                sameAsScreen1: true
            }
        ],
        lastModified: new Date().toISOString()
    };

    localStorage.setItem('pcms_device_42', JSON.stringify(sampleRulesDevice42));
    localStorage.setItem('pcms_device_43', JSON.stringify(sampleRulesDevice43));

    // Sample Project History (message sets with full device/sensor data)
    const sampleProjectHistory = [
        {
            id: 1,
            name: 'Morning Rush Configuration',
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
            notes: 'Initial configuration for morning rush hour traffic management',
            devices: [
                {
                    deviceNumber: 42,
                    deviceName: 'IH35 SB Split PCMS',
                    sensors: [
                        { id: '1', name: 'SB IH35 Split S1' },
                        { id: '2', name: 'SB IH35 Split S2' },
                        { id: '3', name: 'SB IH35 Split S3' },
                        { id: '4', name: 'SB IH35 Split S4' }
                    ],
                    rules: sampleRulesDevice42.rules
                },
                {
                    deviceNumber: 43,
                    deviceName: 'IH35 NB PCMS',
                    sensors: [
                        { id: '5', name: 'NB IH35 S1' },
                        { id: '6', name: 'NB IH35 S2' }
                    ],
                    rules: sampleRulesDevice43.rules
                },
                {
                    deviceNumber: 44,
                    deviceName: 'US183 WB PCMS',
                    sensors: [
                        { id: '7', name: 'WB US183 S1' },
                        { id: '8', name: 'WB US183 S2' }
                    ],
                    rules: []
                }
            ]
        },
        {
            id: 2,
            name: 'Evening Rush Update',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
            notes: 'Adjusted thresholds for evening rush patterns based on last week data',
            devices: [
                {
                    deviceNumber: 42,
                    deviceName: 'IH35 SB Split PCMS',
                    sensors: [
                        { id: '1', name: 'SB IH35 Split S1' },
                        { id: '2', name: 'SB IH35 Split S2' },
                        { id: '3', name: 'SB IH35 Split S3' },
                        { id: '4', name: 'SB IH35 Split S4' }
                    ],
                    rules: [
                        {
                            id: 1,
                            metric: '1',
                            sensor: '1',
                            operator: 'less',
                            threshold: '25',
                            screen1: ['STOPPED', 'TRAFFIC', 'AHEAD'],
                            screen2: ['STOPPED', 'TRAFFIC', 'AHEAD'],
                            sameAsScreen1: true
                        },
                        {
                            id: 2,
                            metric: '1',
                            sensor: '2',
                            operator: 'less',
                            threshold: '35',
                            screen1: ['SLOW', 'TRAFFIC', 'AHEAD'],
                            screen2: ['SLOW', 'TRAFFIC', 'AHEAD'],
                            sameAsScreen1: true
                        },
                        {
                            id: 3,
                            metric: '1',
                            sensor: '3',
                            operator: 'less',
                            threshold: '45',
                            screen1: ['CAUTION', 'AHEAD', ''],
                            screen2: ['REDUCE', 'SPEED', ''],
                            sameAsScreen1: false
                        }
                    ]
                },
                {
                    deviceNumber: 43,
                    deviceName: 'IH35 NB PCMS',
                    sensors: [
                        { id: '5', name: 'NB IH35 S1' },
                        { id: '6', name: 'NB IH35 S2' }
                    ],
                    rules: sampleRulesDevice43.rules
                }
            ]
        }
    ];

    localStorage.setItem('pcms_message_sets', JSON.stringify(sampleProjectHistory));

    console.log('Sample data loaded!');
    console.log('Reload the page to see the sample rules and project history');
}

// Auto-load sample data if this is the first visit
if (!localStorage.getItem('pcms_device_42')) {
    console.log('First time setup - loading sample data...');
    loadSampleData();
}

console.log('To manually load sample data, run: loadSampleData()');