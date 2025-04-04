document.addEventListener('DOMContentLoaded', function() {
    
    var chartContainer = document.getElementById('attributionChart');
    
    // Destroy any existing chart on this canvas
    var existingChart = Chart.getChart(chartContainer);
    if (existingChart) {
        existingChart.destroy();
    }
    
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
    
    // Special case: Check if we have a "no data" row
    var noDataRow = false;
    if (tableRows.length === 1) {
        var cellText = tableRows[0].textContent.trim();
        if (cellText.includes('No individual book picks yet')) {
            noDataRow = true;
        }
    }
    
    if (!noDataRow) {
        // Extract data from table rows
        tableRows.forEach(function(row, index) {
            var cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                try {
                    var username = cells[0].textContent.trim().split('\n')[0].trim();
                    var countText = cells[1].textContent.trim();
                    var count = parseInt(countText, 10);
                    
                    if (!isNaN(count)) {
                        memberNames.push(username);
                        bookCounts.push(count);
                        backgroundColors.push(colorPalette[index % colorPalette.length]);
                    } else {
                        console.warn('[Attribution Chart] Failed to parse count: ' + countText);
                    }
                } catch (error) {
                    console.error('[Attribution Chart] Error processing row ' + index + ':', error);
                }
            }
        });
    }
        
    // Handle case with no valid data
    if (memberNames.length === 0) {
        var ctx = chartContainer.getContext('2d');
        ctx.clearRect(0, 0, chartContainer.width, chartContainer.height);
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('No book pick data available', chartContainer.width / 2, chartContainer.height / 2);
        return;
    }
    
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
                },
                x: {
                    ticks: {
                        // Limit label length to prevent overflow
                        callback: function(value, index, values) {
                            var label = this.getLabelForValue(value);
                            if (label.length > 15) {
                                return label.substring(0, 12) + '...';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
        
    // Check if we need to enable dark mode for the chart
    var isDarkMode = document.body.classList.contains('dark-mode');
    if (isDarkMode) {
        // Apply dark mode styles to the chart
        attributionChart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.1)';
        attributionChart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.1)';
        attributionChart.options.scales.x.ticks.color = '#e1e1e1';
        attributionChart.options.scales.y.ticks.color = '#e1e1e1';
        attributionChart.update();
    }
    
    // Handle window resize to prevent chart growing issues
    var resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            attributionChart.resize();
        }, 250); // Debounce resize handling
    });
});