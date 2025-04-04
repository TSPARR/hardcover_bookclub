document.addEventListener('DOMContentLoaded', function() {
    // Function to initialize the rating distribution chart
    function initRatingDistributionChart() {        
        // Check if the chart canvas exists
        const ratingCanvas = document.getElementById('ratingDistributionChart');
        
        // Get distribution data from the data attribute
        let distributionData = ratingCanvas.getAttribute('data-distribution');
        
        // Parse the data safely
        let parsedData;
        try {
            // Handle empty or missing data
            if (!distributionData || distributionData === '') {
                parsedData = [0, 0, 0, 0, 0];
            } 
            // Handle comma-separated string format
            else if (distributionData.includes(',')) {
                parsedData = distributionData.split(',').map(item => {
                    const val = parseInt(item.trim(), 10);
                    return isNaN(val) ? 0 : val;
                });
            } 
            // Handle JSON format
            else {
                parsedData = JSON.parse(distributionData);
            }
            
            // Ensure we have exactly 5 values
            if (!Array.isArray(parsedData) || parsedData.length !== 5) {
                // Pad or truncate to ensure 5 values
                if (Array.isArray(parsedData)) {
                    while (parsedData.length < 5) parsedData.push(0);
                    if (parsedData.length > 5) parsedData = parsedData.slice(0, 5);
                } else {
                    parsedData = [0, 0, 0, 0, 0];
                }
            }
        } catch (error) {
            console.error('[Rating Chart] Error parsing data:', error);
            parsedData = [0, 0, 0, 0, 0];
        }
        
        // Calculate total for percentages
        const totalRatings = parsedData.reduce((sum, val) => sum + val, 0);
        
        // Check if there's any data to display
        if (totalRatings === 0) {
            // Draw "No data" message on canvas
            const ctx = ratingCanvas.getContext('2d');
            ctx.clearRect(0, 0, ratingCanvas.width, ratingCanvas.height);
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#666';
            ctx.fillText('No ratings data available', ratingCanvas.width / 2, ratingCanvas.height / 2);
            return;
        }
        
        // Destroy existing chart if it exists
        let existingChart = Chart.getChart(ratingCanvas);
        if (existingChart) {
            existingChart.destroy();
        }
        
        // Create the chart
        const ctx = ratingCanvas.getContext('2d');
        const ratingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
                datasets: [{
                    label: 'Number of Ratings',
                    data: parsedData,
                    backgroundColor: [
                        'rgba(220, 53, 69, 0.7)',   // 1 star - red
                        'rgba(255, 193, 7, 0.7)',   // 2 stars - yellow
                        'rgba(108, 117, 125, 0.7)', // 3 stars - grey
                        'rgba(13, 202, 240, 0.7)',  // 4 stars - light blue
                        'rgba(25, 135, 84, 0.7)'    // 5 stars - green
                    ],
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const percentage = totalRatings > 0 ? 
                                    Math.round((value / totalRatings) * 100) : 0;
                                return `${value} rating${value !== 1 ? 's' : ''} (${percentage}%)`;
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
                
        // Apply dark mode if needed
        const isDarkMode = document.body.classList.contains('dark-mode');
        if (isDarkMode) {
            applyDarkModeToChart(ratingChart);
        }
    }
    
    // Apply dark mode styling to the chart
    function applyDarkModeToChart(chart) {
        chart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.1)';
        chart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.1)';
        chart.options.scales.x.ticks.color = '#e1e1e1';
        chart.options.scales.y.ticks.color = '#e1e1e1';
        chart.update();
    }
    
    // Initialize the chart when DOM is ready
    initRatingDistributionChart();
    
    // Watch for theme changes to update chart appearance
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const isDarkMode = document.body.classList.contains('dark-mode');
                const chart = Chart.getChart(document.getElementById('ratingDistributionChart'));
                if (chart && isDarkMode) {
                    applyDarkModeToChart(chart);
                }
            }
        });
    });
    
    // Start observing theme changes on body element
    observer.observe(document.body, { attributes: true });
    
    // Handle window resize to prevent chart growing issues
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            const chart = Chart.getChart(document.getElementById('ratingDistributionChart'));
            if (chart) {
                chart.resize();
            }
        }, 250); // Debounce resize handling
    });
});