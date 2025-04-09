document.addEventListener('DOMContentLoaded', function() {
    // Create a rivalries graph chart if the element exists
    const rivalriesChartContainer = document.getElementById('rivalriesChart');
    if (!rivalriesChartContainer) return;
    
    // Get rivalries data from the data attribute
    let rivalriesData;
    try {
        rivalriesData = JSON.parse(rivalriesChartContainer.getAttribute('data-rivalries') || '[]');
    } catch (error) {
        console.error('[Rivalries Chart] Error parsing data:', error);
        rivalriesData = [];
    }
    
    // If no data, show a message
    if (!rivalriesData || rivalriesData.length === 0) {
        const ctx = rivalriesChartContainer.getContext('2d');
        ctx.clearRect(0, 0, rivalriesChartContainer.width, rivalriesChartContainer.height);
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('Not enough bet data to show rivalries', rivalriesChartContainer.width / 2, rivalriesChartContainer.height / 2);
        return;
    }
    
    // Destroy existing chart if it exists
    let existingChart = Chart.getChart(rivalriesChartContainer);
    if (existingChart) {
        existingChart.destroy();
    }
    
    // Process data for chart - take top 5 most significant rivalries
    const labels = [];
    const nemesisData = [];
    const cashCowData = [];
    
    // Color palettes
    const redPalette = [
        'rgba(220, 53, 69, 0.7)',    // Bootstrap danger
        'rgba(253, 126, 20, 0.7)',   // Bootstrap orange
        'rgba(255, 193, 7, 0.7)',    // Bootstrap warning
    ];
    
    const greenPalette = [
        'rgba(25, 135, 84, 0.7)',    // Bootstrap success
        'rgba(13, 202, 240, 0.7)',   // Bootstrap info
        'rgba(13, 110, 253, 0.7)',   // Bootstrap primary
    ];
    
    // Sort by total rivalry impact (abs of loss + gain) to find most significant rivalries
    rivalriesData.sort((a, b) => {
        const aTotalImpact = (a.nemesis_loss || 0) + (a.cash_cow_gain || 0);
        const bTotalImpact = (b.nemesis_loss || 0) + (b.cash_cow_gain || 0);
        return bTotalImpact - aTotalImpact;
    });
    
    // Take top 5 or fewer if we don't have that many
    const topRivalries = rivalriesData.slice(0, 5).filter(r => 
        (r.nemesis_loss > 0 || r.cash_cow_gain > 0)
    );
    
    // If we have no significant rivalries, show message
    if (topRivalries.length === 0) {
        const ctx = rivalriesChartContainer.getContext('2d');
        ctx.clearRect(0, 0, rivalriesChartContainer.width, rivalriesChartContainer.height);
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#666';
        ctx.fillText('Not enough significant rivalries to show chart', rivalriesChartContainer.width / 2, rivalriesChartContainer.height / 2);
        return;
    }
    
    // Extract data for chart
    topRivalries.forEach(rivalry => {
        labels.push(rivalry.user.username);
        nemesisData.push(rivalry.nemesis_loss || 0);
        cashCowData.push(rivalry.cash_cow_gain || 0);
    });
    
    // Create the chart
    const ctx = rivalriesChartContainer.getContext('2d');
    const rivalriesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Lost To Nemesis ($)',
                    data: nemesisData,
                    backgroundColor: redPalette[0],
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1
                },
                {
                    label: 'Gained From Cash Cow ($)',
                    data: cashCowData,
                    backgroundColor: greenPalette[0],
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = Math.abs(context.raw);
                            const datasetLabel = context.dataset.label || '';
                            
                            // Get the member's nemesis or cash cow name
                            let opponentName = '';
                            const memberData = topRivalries[context.dataIndex];
                            
                            if (context.datasetIndex === 0 && memberData.nemesis) {
                                opponentName = ` (${memberData.nemesis.username})`;
                            } else if (context.datasetIndex === 1 && memberData.cash_cow) {
                                opponentName = ` (${memberData.cash_cow.username})`;
                            }
                            
                            return `${datasetLabel}${opponentName}: $${value.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: false,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Dollar Amount ($)'
                    }
                },
                y: {
                    stacked: false,
                    title: {
                        display: true,
                        text: 'Member'
                    }
                }
            }
        }
    });
    
    // Apply dark mode if needed
    const isDarkMode = document.body.classList.contains('dark-mode');
    if (isDarkMode) {
        applyDarkModeToChart(rivalriesChart);
    }
    
    // Apply dark mode styling to the chart
    function applyDarkModeToChart(chart) {
        chart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.1)';
        chart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.1)';
        chart.options.scales.x.ticks.color = '#e1e1e1';
        chart.options.scales.y.ticks.color = '#e1e1e1';
        chart.update();
    }
    
    // Handle window resize to prevent chart growing issues
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            rivalriesChart.resize();
        }, 250); // Debounce resize handling
    });
});