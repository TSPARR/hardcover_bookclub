document.addEventListener('DOMContentLoaded', function() {
    // Check if the attribution chart container exists
    var chartContainer = document.getElementById('attributionChart');
    if (!chartContainer) return;
    
    // Extract data from the table
    var memberNames = [];
    var bookCounts = [];
    var backgroundColors = [];
    
    // Get all rows from the member stats table
    var tableRows = document.querySelectorAll('#memberStatsTable tbody tr');
    
    // Generate a color palette
    var colorPalette = [
        'rgba(13, 110, 253, 0.7)',  // Bootstrap primary
        'rgba(25, 135, 84, 0.7)',   // Bootstrap success
        'rgba(13, 202, 240, 0.7)',  // Bootstrap info
        'rgba(255, 193, 7, 0.7)',   // Bootstrap warning
        'rgba(220, 53, 69, 0.7)',   // Bootstrap danger
        'rgba(108, 117, 125, 0.7)',  // Bootstrap secondary
        'rgba(111, 66, 193, 0.7)',  // Bootstrap purple
        'rgba(253, 126, 20, 0.7)',  // Bootstrap orange
        'rgba(32, 201, 151, 0.7)',  // Bootstrap teal
    ];
    
    // Extract data from table rows
    tableRows.forEach(function(row, index) {
        var cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
            var username = cells[0].textContent.trim().split('\n')[0].trim();
            var count = parseInt(cells[1].textContent.trim(), 10);
            
            memberNames.push(username);
            bookCounts.push(count);
            backgroundColors.push(colorPalette[index % colorPalette.length]);
        }
    });
    
    // Create the chart
    var ctx = chartContainer.getContext('2d');
    var attributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: memberNames,
            datasets: [{
                label: 'Books Picked',
                data: bookCounts,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.raw + ' book' + (context.raw !== 1 ? 's' : '');
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
    
    // Check if we need to enable dark mode for the chart
    var isDarkMode = document.body.classList.contains('dark-mode');
    if (isDarkMode) {
        // Apply dark mode styles to the chart
        Chart.defaults.color = '#e1e1e1';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
        attributionChart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.1)';
        attributionChart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.1)';
        attributionChart.update();
    }
});