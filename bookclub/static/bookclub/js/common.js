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

// Dark mode toggle functionality
function setupDarkMode() {
    console.log('Setting up dark mode functionality');
    
    // Create theme stylesheet link (but don't add it to DOM yet)
    const darkModeStylesheet = document.createElement('link');
    darkModeStylesheet.rel = 'stylesheet';
    darkModeStylesheet.href = '/static/bookclub/css/dark-mode/dark-mode.css'; // Updated path to match new structure
    darkModeStylesheet.id = 'dark-mode-stylesheet';

    // Create toggle button
    const darkModeToggle = document.createElement('button');
    darkModeToggle.classList.add('btn', 'btn-sm', 'ms-2');
    darkModeToggle.setAttribute('id', 'dark-mode-toggle');
    darkModeToggle.setAttribute('title', 'Toggle dark mode');
    darkModeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
    
    // Insert toggle in navbar - specifically target the ms-auto navbar-nav
    const navbarNav = document.querySelector('.navbar-nav.ms-auto');
    if (navbarNav) {
        const toggleContainer = document.createElement('li');
        toggleContainer.classList.add('nav-item');
        toggleContainer.appendChild(darkModeToggle);
        navbarNav.appendChild(toggleContainer);
        console.log('Dark mode toggle added to navbar');
    } else {
        // Fallback if the specific navbar can't be found
        console.log('Primary navbar not found, trying alternative placement');
        const navbar = document.querySelector('.navbar-collapse');
        if (navbar) {
            // Create a standalone button that will appear in the navbar
            darkModeToggle.classList.add('ms-3');
            navbar.appendChild(darkModeToggle);
            console.log('Dark mode toggle added as standalone button');
        } else {
            console.log('Could not find navbar to add dark mode toggle');
        }
    }

    // Check user preference from localStorage
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    // Apply saved preference if it exists
    if (isDarkMode) {
        enableDarkMode();
    }
    
    // Toggle button click handler
    darkModeToggle.addEventListener('click', function() {
        if (document.getElementById('dark-mode-stylesheet')) {
            disableDarkMode();
        } else {
            enableDarkMode();
        }
    });

    // Functions to handle mode switching
    function enableDarkMode() {
        // Add the stylesheet to enable dark mode
        document.head.appendChild(darkModeStylesheet);
        
        // Update button icon
        darkModeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
        darkModeToggle.classList.remove('btn-dark');
        darkModeToggle.classList.add('btn-light');
        
        // Save preference
        localStorage.setItem('darkMode', 'true');
        
        // Add class to body for any additional styling
        document.body.classList.add('dark-mode');
    }

    function disableDarkMode() {
        // Remove the dark mode stylesheet
        const stylesheet = document.getElementById('dark-mode-stylesheet');
        if (stylesheet) {
            stylesheet.remove();
        }
        
        // Update button icon
        darkModeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
        darkModeToggle.classList.remove('btn-light');
        darkModeToggle.classList.add('btn-dark');
        
        // Save preference
        localStorage.setItem('darkMode', 'false');
        
        // Remove body class
        document.body.classList.remove('dark-mode');
    }

    // Listen for system preference changes
    if (window.matchMedia) {
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Apply system preference if no saved preference
        if (localStorage.getItem('darkMode') === null && prefersDarkScheme.matches) {
            enableDarkMode();
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