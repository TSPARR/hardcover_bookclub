document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    });

    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
    
    // Add active class to current nav item based on URL
    const currentPath = window.location.pathname;
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // ===== Starting Points Modal =====
    const setStartingPointModal = document.getElementById('setStartingPointModal');
    if (setStartingPointModal) {
        setStartingPointModal.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget;
            const memberId = button.getAttribute('data-member-id');
            const memberName = button.getAttribute('data-member-name');
            
            // Update the modal content
            document.getElementById('memberIdInput').value = memberId;
            document.getElementById('memberNameDisplay').textContent = memberName;
        });
    }
    
    // ===== Comment Progress Type Selection =====
    const commentProgressType = document.getElementById('comment_progress_type');
    if (commentProgressType) {
        commentProgressType.addEventListener('change', function() {
            const helpText = document.getElementById('commentProgressHelp');
            const selectedType = this.value;

            if (selectedType === 'page') {
                helpText.textContent = 'Enter the page number you\'re commenting about.';
            } else if (selectedType === 'audio') {
                helpText.textContent = 'Enter the timestamp (e.g., "2h 30m").';
            } else {
                helpText.textContent = 'Enter a percentage (e.g., "75").';
            }
        });
    }

    // Dark Mode Implementation
    setupDarkMode();
});

function setupDarkMode() {
    console.log('Setting up dark mode functionality');
    
    // Get reference to the dark mode stylesheet
    const darkModeStylesheet = document.querySelector('link[href*="dark-mode.css"]');
    
    if (!darkModeStylesheet) {
        console.error('Dark mode stylesheet not found');
        return;
    }
    
    // Find the dark mode toggle button
    let darkModeToggle = document.getElementById('dark-mode-toggle');
    
    if (!darkModeToggle) {
        console.error('Dark mode toggle button not found');
        return;
    }
    
    // Check user preference from localStorage
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    // Apply dark mode immediately if it's the saved preference
    if (isDarkMode) {
        enableDarkMode();
    } else {
        disableDarkMode();
    }
    
    // Toggle button click handler
    darkModeToggle.addEventListener('click', function() {
        if (document.documentElement.classList.contains('dark-mode')) {
            disableDarkMode();
        } else {
            enableDarkMode();
        }
    });

    // Functions to handle mode switching
    function enableDarkMode() {
        // Update document classes
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
        
        // Update the media attribute to always load the dark stylesheet
        darkModeStylesheet.setAttribute('media', 'all');
        
        // Update button icon
        darkModeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
        darkModeToggle.classList.remove('btn-dark');
        darkModeToggle.classList.add('btn-light');
        
        // Save preference
        localStorage.setItem('darkMode', 'true');
        
        console.log('Dark mode enabled');
    }

    function disableDarkMode() {
        // Update document classes
        document.documentElement.classList.remove('dark-mode');
        document.documentElement.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        
        // Update the media attribute to never load the dark stylesheet
        darkModeStylesheet.setAttribute('media', 'not all');
        
        // Update button icon
        darkModeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
        darkModeToggle.classList.remove('btn-light');
        darkModeToggle.classList.add('btn-dark');
        
        // Save preference
        localStorage.setItem('darkMode', 'false');
        
        console.log('Dark mode disabled');
    }

    // Listen for system preference changes
    if (window.matchMedia) {
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Apply system preference if no saved preference
        if (localStorage.getItem('darkMode') === null) {
            if (prefersDarkScheme.matches) {
                enableDarkMode();
            }
        }
        
        // Listen for changes
        prefersDarkScheme.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (localStorage.getItem('darkMode') === null) {
                if (e.matches) {
                    enableDarkMode();
                } else {
                    disableDarkMode();
                }
            }
        });
    }
}

// ===== Copy Invitation Link function =====
function copyInviteLink(link) {
    navigator.clipboard.writeText(link).then(function() {
        alert('Invitation link copied to clipboard!');
    }, function() {
        alert('Failed to copy invitation link.');
    });
}

// Make the function available globally
window.copyInviteLink = copyInviteLink;