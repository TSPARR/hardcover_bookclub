document.addEventListener('DOMContentLoaded', function() {
    // Function to toggle table rows
    function toggleTableRows(tableId, maxInitialRows = 10) {
        const table = document.getElementById(tableId);
        if (!table) return;

        // For top rated books table - use the original implementation
        if (tableId === 'top-rated-books-table') {
            const ratingGroups = table.querySelectorAll('.rating-group-header');
            
            // If fewer groups than max, do nothing
            if (ratingGroups.length <= maxInitialRows) return;

            // Hide excess groups and their content rows
            for (let i = maxInitialRows; i < ratingGroups.length; i++) {
                ratingGroups[i].classList.add('d-none');
                
                // Get the next row which is the content row
                const contentRow = ratingGroups[i].nextElementSibling;
                if (contentRow && contentRow.classList.contains('rating-group-content')) {
                    contentRow.classList.add('d-none');
                }
            }

            // Create expand/collapse toggle - insert after the last visible content row
            const lastVisibleContentRow = ratingGroups[maxInitialRows - 1].nextElementSibling;
            
            const toggleRow = document.createElement('tr');
            toggleRow.className = 'toggle-row';
            toggleRow.innerHTML = `
                <td colspan="3" class="text-center py-3">
                    <button class="btn btn-sm btn-outline-secondary toggle-rows" data-expanded="false">
                        Show More Ratings
                        <i class="bi bi-chevron-down ms-1"></i>
                    </button>
                </td>
            `;
            
            if (lastVisibleContentRow && lastVisibleContentRow.nextElementSibling) {
                table.querySelector('tbody').insertBefore(toggleRow, lastVisibleContentRow.nextElementSibling);
            } else {
                table.querySelector('tbody').appendChild(toggleRow);
            }

            // Add click event to toggle button
            const toggleButton = toggleRow.querySelector('.toggle-rows');
            toggleButton.addEventListener('click', function() {
                const isExpanded = this.dataset.expanded === 'true';
                
                // Toggle visibility of rating groups and their content rows
                for (let i = maxInitialRows; i < ratingGroups.length; i++) {
                    ratingGroups[i].classList.toggle('d-none');
                    
                    // Get the next row which is the content row
                    const contentRow = ratingGroups[i].nextElementSibling;
                    if (contentRow && contentRow.classList.contains('rating-group-content')) {
                        contentRow.classList.toggle('d-none');
                    }
                }

                // Update button text and icon
                if (isExpanded) {
                    this.innerHTML = `Show More Ratings <i class="bi bi-chevron-down ms-1"></i>`;
                    this.dataset.expanded = 'false';
                } else {
                    this.innerHTML = `Show Less <i class="bi bi-chevron-up ms-1"></i>`;
                    this.dataset.expanded = 'true';
                }
            });
        } 
        // For book timeline table - special handling
        else if (tableId === 'book-timeline-table') {
            const tbody = table.querySelector('tbody');
            const mainRows = Array.from(tbody.querySelectorAll('tr.book-timeline-row'));
            
            // If fewer rows than max, do nothing
            if (mainRows.length <= maxInitialRows) return;
            
            // Special handling to collect all expandable books
            const expandableBooks = {};
            tbody.querySelectorAll('.book-expand-btn').forEach(btn => {
                const row = btn.closest('tr');
                const targetId = btn.getAttribute('data-bs-target');
                const bookId = targetId ? targetId.replace('#book-ratings-', '') : null;
                
                if (bookId && row) {
                    expandableBooks[bookId] = {
                        button: btn,
                        mainRow: row,
                        detailRow: document.querySelector(targetId)
                    };
                }
            });
            
            // Hide excess rows
            mainRows.slice(maxInitialRows).forEach(row => {
                row.classList.add('d-none');
            });
            
            // Create expand/collapse toggle
            const toggleRow = document.createElement('tr');
            toggleRow.className = 'toggle-row';
            
            // Get the colspan value
            const columnCount = table.querySelector('thead tr').children.length || 6;
            
            toggleRow.innerHTML = `
                <td colspan="${columnCount}" class="text-center py-3">
                    <button class="btn btn-sm btn-outline-secondary toggle-rows" data-expanded="false">
                        Show More Books
                        <i class="bi bi-chevron-down ms-1"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(toggleRow);
            
            // Add click event to toggle button
            const toggleButton = toggleRow.querySelector('.toggle-rows');
            toggleButton.addEventListener('click', function() {
                const isExpanded = this.dataset.expanded === 'true';
                
                // Toggle visibility of main rows
                mainRows.slice(maxInitialRows).forEach(row => {
                    row.classList.toggle('d-none');
                });
                
                // Update button text and icon
                if (isExpanded) {
                    this.innerHTML = `Show More Books <i class="bi bi-chevron-down ms-1"></i>`;
                    this.dataset.expanded = 'false';
                } else {
                    this.innerHTML = `Show Less <i class="bi bi-chevron-up ms-1"></i>`;
                    this.dataset.expanded = 'true';
                }
                
                // After toggling visibility, reinstall collapsible behavior
                reinstallCollapseHandlers();
            });
        }
    }
    
    // Special function to ensure collapse handlers work after showing more
    function reinstallCollapseHandlers() {
        document.querySelectorAll('.book-expand-btn').forEach(button => {
            // Skip if already has our click handler
            if (button.hasAttribute('data-handler-installed')) {
                return;
            }
            
            const targetSelector = button.getAttribute('data-bs-target');
            if (!targetSelector) return;
            
            const targetElement = document.querySelector(targetSelector);
            if (!targetElement) return;
            
            // Ensure we have a bootstrap collapse instance
            if (bootstrap && bootstrap.Collapse) {
                if (bootstrap.Collapse.getInstance(targetElement)) {
                    bootstrap.Collapse.getInstance(targetElement).dispose();
                }
                
                new bootstrap.Collapse(targetElement, {
                    toggle: false
                });
                
                // Mark that we've handled this button
                button.setAttribute('data-handler-installed', 'true');
            }
        });
    }

    // Apply to specific tables
    toggleTableRows('top-rated-books-table', 5);
    toggleTableRows('book-timeline-table', 10); // Show first 10 book rows
    
    // Initial installation of collapse handlers
    reinstallCollapseHandlers();
});