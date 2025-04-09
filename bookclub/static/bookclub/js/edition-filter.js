// edition-filter.js
// This code handles filtering editions by format type

document.addEventListener('DOMContentLoaded', function () {
    // Initialize filter buttons
    const filterButtons = document.querySelectorAll('.format-filter-btn');
    const editionCards = document.querySelectorAll('.edition-card');
    const formatCountBadges = document.querySelectorAll('.format-count');
    
    // Track currently active filter
    let activeFormatId = null;
    
    // Count initial formats
    updateFormatCounts();
    
    // Add click event to filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const formatId = this.getAttribute('data-format-id');
            
            // Toggle filter: clear if clicking the same filter, otherwise apply new filter
            if (this.classList.contains('active')) {
                // Clear filter if clicking the active button
                this.classList.remove('active');
                activeFormatId = null;
            } else {
                // Remove active state from all buttons
                filterButtons.forEach(btn => btn.classList.remove('active'));
                // Set new active button
                this.classList.add('active');
                activeFormatId = formatId;
            }
            
            // Filter the editions based on current active state
            filterEditions(activeFormatId);
        });
    });
    
    // Function to filter editions
    function filterEditions(formatId) {
        editionCards.forEach(card => {
            if (!formatId || card.getAttribute('data-format-id') === formatId) {
                card.parentElement.style.display = 'block';
            } else {
                card.parentElement.style.display = 'none';
            }
        });
        
        // Update the "no results" message
        updateNoResultsMessage(formatId);
    }
    
    // Function to show/hide "no results" message
    function updateNoResultsMessage(formatId) {
        const noResultsMsg = document.getElementById('no-editions-filtered');
        if (!noResultsMsg) return;
        
        // Check if any editions are visible
        const visibleEditions = Array.from(editionCards).filter(card => 
            card.parentElement.style.display !== 'none'
        );
        
        if (formatId && visibleEditions.length === 0) {
            // No editions match the filter
            noResultsMsg.classList.remove('d-none');
            // Update message to include format name
            const formatName = getFormatName(formatId);
            noResultsMsg.textContent = `No ${formatName} editions available for this book.`;
        } else {
            // Hide the message if editions are visible or no filter is applied
            noResultsMsg.classList.add('d-none');
        }
    }
    
    // Function to get format name from ID
    function getFormatName(formatId) {
        switch(formatId) {
            case '1': return 'physical';
            case '2': return 'audiobook';
            case '4': return 'ebook';
            default: return '';
        }
    }
    
    // Function to update format count badges
    function updateFormatCounts() {
        // Count editions by format
        const formatCounts = {
            '1': 0, // physical
            '2': 0, // audio
            '4': 0  // ebook
        };
        
        // Count each format
        editionCards.forEach(card => {
            const formatId = card.getAttribute('data-format-id');
            if (formatId && formatCounts.hasOwnProperty(formatId)) {
                formatCounts[formatId]++;
            }
        });
        
        // Update the badges
        formatCountBadges.forEach(badge => {
            const formatId = badge.getAttribute('data-format-id');
            if (formatId && formatCounts.hasOwnProperty(formatId)) {
                badge.textContent = formatCounts[formatId];
                
                // Hide badge if count is zero
                if (formatCounts[formatId] === 0) {
                    badge.classList.add('d-none');
                    // Also disable the parent button
                    const parentButton = badge.closest('button');
                    if (parentButton) {
                        parentButton.disabled = true;
                    }
                } else {
                    badge.classList.remove('d-none');
                }
            }
        });
    }
});