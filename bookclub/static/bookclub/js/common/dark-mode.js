// Dark Mode Functionality
export function setupDarkMode() {
    // Get reference to the dark mode stylesheet
    const darkModeStylesheet = document.querySelector('link[href*="dark-mode.css"]');
    
    if (!darkModeStylesheet) {
        console.error('Dark mode stylesheet not found');
        return;
    }
    
    // Find the dark mode toggle button
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    
    if (!darkModeToggle) {
        console.error('Dark mode toggle button not found');
        return;
    }
    
    // Add click event to toggle mode
    darkModeToggle.addEventListener('click', function() {
        const isDarkMode = document.documentElement.classList.contains('dark-mode');
        
        if (isDarkMode) {
            // Disable dark mode
            document.documentElement.classList.remove('dark-mode');
            document.documentElement.classList.add('light-mode');
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            
            darkModeStylesheet.setAttribute('media', 'not all');
            
            darkModeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
            darkModeToggle.classList.remove('btn-light');
            darkModeToggle.classList.add('btn-dark');
            
            localStorage.setItem('darkMode', 'false');
        } else {
            // Enable dark mode
            document.documentElement.classList.add('dark-mode');
            document.documentElement.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            document.body.classList.remove('light-mode');
            
            darkModeStylesheet.setAttribute('media', 'all');
            
            darkModeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
            darkModeToggle.classList.remove('btn-dark');
            darkModeToggle.classList.add('btn-light');
            
            localStorage.setItem('darkMode', 'true');
        }
    });

    // Listen for system preference changes
    if (window.matchMedia) {
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        
        prefersDarkScheme.addEventListener('change', (e) => {
            // Only auto-switch if user hasn't manually set a preference
            if (localStorage.getItem('darkMode') === null) {
                if (e.matches) {
                    document.documentElement.classList.add('dark-mode');
                    document.documentElement.classList.remove('light-mode');
                    document.body.classList.add('dark-mode');
                    document.body.classList.remove('light-mode');
                    darkModeStylesheet.setAttribute('media', 'all');
                } else {
                    document.documentElement.classList.remove('dark-mode');
                    document.documentElement.classList.add('light-mode');
                    document.body.classList.remove('dark-mode');
                    document.body.classList.add('light-mode');
                    darkModeStylesheet.setAttribute('media', 'not all');
                }
            }
        });
    }
}

// Inline script to prevent mode flash
export function preventModeFlash() {
    const storedMode = localStorage.getItem('darkMode');
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const shouldUseDarkMode = storedMode === 'true' || 
        (storedMode === null && prefersDarkMode);

    if (shouldUseDarkMode) {
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
    } else {
        document.documentElement.classList.add('light-mode');
        document.documentElement.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
    }
}