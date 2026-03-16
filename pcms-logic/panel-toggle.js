// Panel Toggle Functionality - Devices Panel Toggle
document.addEventListener('DOMContentLoaded', () => {
    const devicesPanel = document.getElementById('devices-panel');
    const devicesButton = document.getElementById('toggle-devices');

    // Toggle Devices panel
    if (devicesButton && devicesPanel) {
        devicesButton.addEventListener('click', () => {
            devicesPanel.classList.toggle('collapsed');
            const isCollapsed = devicesPanel.classList.contains('collapsed');
            localStorage.setItem('devicesCollapsed', isCollapsed);
            updateButtonState(devicesButton, !isCollapsed);
        });
    }

    // Update button appearance based on panel state
    function updateButtonState(button, isOpen) {
        if (isOpen) {
            button.style.background = 'var(--primary-color)';
            button.style.borderColor = 'var(--primary-color)';
            button.querySelector('svg').style.fill = 'white';
        } else {
            button.style.background = 'white';
            button.style.borderColor = '#ccc';
            button.querySelector('svg').style.fill = 'var(--font-color)';
        }
    }

    // Restore panel state from localStorage
    const devicesWasCollapsed = localStorage.getItem('devicesCollapsed');

    // Devices starts expanded by default
    if (devicesWasCollapsed === 'true') {
        devicesPanel.classList.add('collapsed');
    } else {
        devicesPanel.classList.remove('collapsed');
    }

    // Set initial button state
    if (devicesButton && devicesPanel) {
        updateButtonState(devicesButton, !devicesPanel.classList.contains('collapsed'));
    }
});
