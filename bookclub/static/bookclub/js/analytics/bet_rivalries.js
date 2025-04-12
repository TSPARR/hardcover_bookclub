document.addEventListener('DOMContentLoaded', function() {
    // Set up collapsible behavior for the betting rivalries table
    function setupRivalriesTable(tableId = 'betting-rivalries-table', maxRows = 5) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        // If we don't have many rows, no need to collapse
        if (rows.length <= maxRows) return;
        
        // Hide excess rows
        rows.slice(maxRows).forEach(row => {
            row.classList.add('d-none');
        });
        
        // Create a toggle row
        const toggleRow = document.createElement('tr');
        toggleRow.className = 'toggle-row';
        toggleRow.innerHTML = `
            <td colspan="5" class="text-center py-2">
                <button class="btn btn-sm btn-outline-secondary toggle-rows" data-expanded="false">
                    Show More Rivalries
                    <i class="bi bi-chevron-down ms-1"></i>
                </button>
            </td>
        `;
        
        // Add the toggle row to the table
        tbody.appendChild(toggleRow);
        
        // Add click handler for toggle button
        const toggleButton = toggleRow.querySelector('.toggle-rows');
        toggleButton.addEventListener('click', function() {
            const isExpanded = this.dataset.expanded === 'true';
            
            // Toggle visibility of rows
            rows.slice(maxRows).forEach(row => {
                row.classList.toggle('d-none');
            });
            
            // Update button text and icon
            if (isExpanded) {
                this.innerHTML = `Show More Rivalries <i class="bi bi-chevron-down ms-1"></i>`;
                this.dataset.expanded = 'false';
            } else {
                this.innerHTML = `Show Less <i class="bi bi-chevron-up ms-1"></i>`;
                this.dataset.expanded = 'true';
            }
        });
    }
    
    // Initialize the rivalries table
    setupRivalriesTable('betting-rivalries-table', 5);
});