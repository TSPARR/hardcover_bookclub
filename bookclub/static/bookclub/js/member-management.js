/**
 * Member management functionality for book clubs
 */

// Document ready event handler
document.addEventListener('DOMContentLoaded', function() {
    initUserSelect();
});

// Initialize searchable user select dropdown
function initUserSelect() {
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) return;

    // Initialize Choices.js on the select element
    const choices = new Choices(userSelect, {
        searchEnabled: true,
        searchPlaceholderValue: 'Search for a user...',
        itemSelectText: 'Click to select',
        noResultsText: 'No users found',
        noChoicesText: 'No users available',
        shouldSort: true,
        searchResultLimit: 10,
        position: 'bottom',
        removeItemButton: false,
        classNames: {
            containerOuter: 'choices member-select-choices',
        }
    });
}

// Expose functions globally
window.initUserSelect = initUserSelect;
