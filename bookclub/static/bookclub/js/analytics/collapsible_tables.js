document.addEventListener('DOMContentLoaded', function() {
    // Function to toggle grouped table rows (for top_rated_books)
    function toggleGroupedTableRows(tableId, maxInitialGroups = 10) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const ratingGroups = table.querySelectorAll('.rating-group-header');
        
        // If fewer groups than max, do nothing
        if (ratingGroups.length <= maxInitialGroups) return;

        // Hide excess groups and their content rows
        for (let i = maxInitialGroups; i < ratingGroups.length; i++) {
            ratingGroups[i].classList.add('d-none');
            
            // Get the next row which is the content row
            const contentRow = ratingGroups[i].nextElementSibling;
            if (contentRow && contentRow.classList.contains('rating-group-content')) {
                contentRow.classList.add('d-none');
            }
        }

        // Create expand/collapse toggle - insert after the last visible content row
        const lastVisibleContentRow = ratingGroups[maxInitialGroups - 1].nextElementSibling;
        
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
            for (let i = maxInitialGroups; i < ratingGroups.length; i++) {
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

    // Function to toggle flat table rows (for book_timeline)
    function toggleFlatTableRows(tableId, maxInitialRows = 10) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        // If fewer rows than max, do nothing
        if (rows.length <= maxInitialRows) return;

        // Hide excess rows
        rows.slice(maxInitialRows).forEach(row => {
            row.classList.add('d-none');
        });

        // Create expand/collapse toggle
        const toggleRow = document.createElement('tr');
        toggleRow.className = 'toggle-row';
        
        // Get the colspan value based on the number of columns in the table
        const columnCount = table.querySelector('thead tr').children.length || 5;
        
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
            
            // Toggle visibility of rows
            rows.slice(maxInitialRows).forEach(row => {
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
        });
    }

    // Detect table type and apply appropriate function
    function setupTable(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        // Check if table has grouped structure (rating-group-header elements)
        const hasGroups = table.querySelectorAll('.rating-group-header').length > 0;
        
        if (hasGroups) {
            toggleGroupedTableRows(tableId);
        } else {
            toggleFlatTableRows(tableId);
        }
    }

    // Apply to specific tables
    setupTable('top-rated-books-table');
    setupTable('book-timeline-table');
});