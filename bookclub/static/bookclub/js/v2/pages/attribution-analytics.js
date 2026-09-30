document.addEventListener('DOMContentLoaded', function() {
    initAttributionChart();
    initRatingDistributionChart();
    initRivalriesChart();
    initExpandableRows();
    initExpandableGroups();
    initCollapsibleTables();
    initMobileToggle();
});

function initAttributionChart() {
    const chartContainer = document.getElementById('attributionChart');
    if (!chartContainer) return;

    const existingChart = Chart.getChart(chartContainer);
    if (existingChart) {
        existingChart.destroy();
    }
    const memberNames = [];
    const bookCounts = [];
    const backgroundColors = [];

    const tableRows = document.querySelectorAll('#memberStatsTable tbody tr');

    const colorPalette = [
        'rgba(107, 44, 44, 0.8)',   // burgundy
        'rgba(45, 74, 62, 0.8)',    // forest green
        'rgba(201, 169, 97, 0.8)',  // gold
        'rgba(107, 44, 44, 0.6)',   // burgundy lighter
        'rgba(45, 74, 62, 0.6)',    // forest green lighter
        'rgba(201, 169, 97, 0.6)',  // gold lighter
        'rgba(107, 44, 44, 0.4)',   // burgundy lightest
        'rgba(45, 74, 62, 0.4)',    // forest green lightest
        'rgba(201, 169, 97, 0.4)',
    ];

    let noDataRow = false;
    if (tableRows.length === 1) {
        const cellText = tableRows[0].textContent.trim();
        if (cellText.includes('No individual book picks yet')) {
            noDataRow = true;
        }
    }

    if (!noDataRow) {
        tableRows.forEach(function(row, index) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                try {
                    const username = cells[0].textContent.trim().split('\n')[0].trim();
                    const countText = cells[1].textContent.trim();
                    const count = parseInt(countText, 10);

                    if (!isNaN(count)) {
                        memberNames.push(username);
                        bookCounts.push(count);
                        backgroundColors.push(colorPalette[index % colorPalette.length]);
                    }
                } catch (error) {
                    console.error('Error processing row:', error);
                }
            }
        });
    }

    if (memberNames.length === 0) {
        const ctx = chartContainer.getContext('2d');
        ctx.clearRect(0, 0, chartContainer.width, chartContainer.height);
        ctx.font = '14px var(--font-body)';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'var(--ink-black)';
        ctx.fillText('No book pick data available', chartContainer.width / 2, chartContainer.height / 2);
        return;
    }

    const ctx = chartContainer.getContext('2d');
    const isDarkMode = document.documentElement.classList.contains('dark-mode');

    const attributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: memberNames,
            datasets: [{
                label: 'Books Picked',
                data: bookCounts,
                backgroundColor: backgroundColors,
                borderColor: isDarkMode ? 'rgba(232, 228, 221, 0.2)' : 'rgba(26, 21, 20, 0.2)',
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
                    },
                    backgroundColor: isDarkMode ? 'rgba(30, 27, 24, 0.95)' : 'rgba(26, 21, 20, 0.9)',
                    titleColor: isDarkMode ? '#e8e4dd' : '#f8f5f0',
                    bodyColor: isDarkMode ? '#e8e4dd' : '#f8f5f0',
                    borderColor: isDarkMode ? 'rgba(232, 228, 221, 0.2)' : 'rgba(248, 245, 240, 0.2)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.7)' : 'rgba(26, 21, 20, 0.7)'
                    },
                    grid: {
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.1)' : 'rgba(26, 21, 20, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.7)' : 'rgba(26, 21, 20, 0.7)',
                        callback: function(value, index, values) {
                            const label = this.getLabelForValue(value);
                            if (label.length > 15) {
                                return label.substring(0, 12) + '...';
                            }
                            return label;
                        }
                    },
                    grid: {
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.1)' : 'rgba(26, 21, 20, 0.1)'
                    }
                }
            }
        }
    });

    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function() {
            attributionChart.resize();
        }, 250);
    });
}

function initRatingDistributionChart() {
    const chartContainer = document.getElementById('ratingDistributionChart');
    if (!chartContainer) return;

    const distributionData = chartContainer.dataset.distribution;
    if (!distributionData) return;

    const counts = distributionData.split(',').map(Number);
    const isDarkMode = document.documentElement.classList.contains('dark-mode');

    const ctx = chartContainer.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
            datasets: [{
                label: 'Number of Ratings',
                data: counts,
                backgroundColor: [
                    'rgba(107, 44, 44, 0.8)',
                    'rgba(107, 44, 44, 0.7)',
                    'rgba(201, 169, 97, 0.7)',
                    'rgba(45, 74, 62, 0.7)',
                    'rgba(45, 74, 62, 0.9)'
                ],
                borderColor: isDarkMode ? 'rgba(232, 228, 221, 0.2)' : 'rgba(26, 21, 20, 0.2)',
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
                    backgroundColor: isDarkMode ? 'rgba(30, 27, 24, 0.95)' : 'rgba(26, 21, 20, 0.9)',
                    titleColor: isDarkMode ? '#e8e4dd' : '#f8f5f0',
                    bodyColor: isDarkMode ? '#e8e4dd' : '#f8f5f0',
                    borderColor: isDarkMode ? 'rgba(232, 228, 221, 0.2)' : 'rgba(248, 245, 240, 0.2)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.7)' : 'rgba(26, 21, 20, 0.7)'
                    },
                    grid: {
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.1)' : 'rgba(26, 21, 20, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.7)' : 'rgba(26, 21, 20, 0.7)'
                    },
                    grid: {
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.1)' : 'rgba(26, 21, 20, 0.1)'
                    }
                }
            }
        }
    });
}

function initRivalriesChart() {
    const chartContainer = document.getElementById('rivalriesChart');
    if (!chartContainer) return;

    let rivalriesData = chartContainer.dataset.rivalries;
    if (!rivalriesData || rivalriesData === 'None') return;

    try {
        rivalriesData = JSON.parse(rivalriesData);
    } catch (e) {
        console.error('Failed to parse rivalries data:', e);
        return;
    }

    if (!rivalriesData || rivalriesData.length === 0) return;

    const rivalries = [];
    rivalriesData.forEach(function(rivalry) {
        if (rivalry.nemesis && rivalry.nemesis_loss) {
            rivalries.push({
                label: rivalry.user.username + ' vs ' + rivalry.nemesis.username,
                value: Math.abs(rivalry.nemesis_loss)
            });
        }
        if (rivalry.cash_cow && rivalry.cash_cow_gain) {
            rivalries.push({
                label: rivalry.user.username + ' vs ' + rivalry.cash_cow.username,
                value: Math.abs(rivalry.cash_cow_gain)
            });
        }
    });

    rivalries.sort((a, b) => b.value - a.value);
    const top5 = rivalries.slice(0, 5);

    if (top5.length === 0) return;

    const labels = top5.map(r => r.label);
    const values = top5.map(r => r.value);
    const isDarkMode = document.documentElement.classList.contains('dark-mode');

    const ctx = chartContainer.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Net Dollar Amount',
                data: values,
                backgroundColor: 'rgba(107, 44, 44, 0.7)',
                borderColor: 'rgba(107, 44, 44, 1)',
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 10,
                    bottom: 10
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(2);
                        }
                    },
                    backgroundColor: isDarkMode ? 'rgba(30, 27, 24, 0.95)' : 'rgba(26, 21, 20, 0.9)',
                    titleColor: isDarkMode ? '#e8e4dd' : '#f8f5f0',
                    bodyColor: isDarkMode ? '#e8e4dd' : '#f8f5f0',
                    borderColor: isDarkMode ? 'rgba(232, 228, 221, 0.2)' : 'rgba(248, 245, 240, 0.2)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.7)' : 'rgba(26, 21, 20, 0.7)',
                        font: {
                            size: 10
                        },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        },
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.7)' : 'rgba(26, 21, 20, 0.7)',
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: isDarkMode ? 'rgba(232, 228, 221, 0.1)' : 'rgba(26, 21, 20, 0.1)',
                        drawBorder: false
                    }
                }
            }
        }
    });
}

function initExpandableRows() {
    const expandButtons = document.querySelectorAll('.btn-expand');

    expandButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const targetRow = document.getElementById(targetId);

            if (!targetRow) return;

            const isExpanded = this.getAttribute('aria-expanded') === 'true';

            if (isExpanded) {
                
                targetRow.style.display = 'none';
                this.setAttribute('aria-expanded', 'false');
                this.classList.remove('expanded');
            } else {
                
                targetRow.style.display = 'table-row';
                this.setAttribute('aria-expanded', 'true');
                this.classList.add('expanded');
            }
        });
    });
}

function initExpandableGroups() {
    const expandButtons = document.querySelectorAll('.btn-expand-group');

    expandButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const targetRow = document.getElementById(targetId);

            if (!targetRow) return;

            const isExpanded = this.getAttribute('aria-expanded') === 'true';

            if (isExpanded) {
                
                targetRow.style.display = 'none';
                this.setAttribute('aria-expanded', 'false');
                this.classList.remove('expanded');
            } else {
                
                targetRow.style.display = 'table-row';
                this.setAttribute('aria-expanded', 'true');
                this.classList.add('expanded');
            }
        });
    });
}

function initCollapsibleTables() {
    const tables = document.querySelectorAll('.collapsible-table');

    tables.forEach(function(table) {
        const showLimit = parseInt(table.dataset.showLimit) || 10;
        const rows = table.querySelectorAll('.collapsible-row');
        const container = table.closest('.card-body');
        const toggleContainer = container ? container.querySelector('.table-toggle-container') : null;

        if (rows.length <= showLimit) {
            return;
        }

        if (toggleContainer) {
            toggleContainer.style.display = 'block';
            const toggleButton = toggleContainer.querySelector('.btn-toggle-table');

            rows.forEach(function(row, index) {
                const rowIndex = parseInt(row.dataset.rowIndex);
                if (rowIndex > showLimit) {
                    if (row.classList.contains('rating-group-content')) {
                        return;
                    }
                    row.style.display = 'none';
                }
            });

            toggleButton.addEventListener('click', function() {
                const isExpanded = this.classList.contains('expanded');
                const icon = this.querySelector('i');
                const text = this.querySelector('.toggle-text');

                rows.forEach(function(row, index) {
                    const rowIndex = parseInt(row.dataset.rowIndex);
                    if (rowIndex > showLimit) {
                        if (row.classList.contains('rating-group-content')) {
                            return;
                        }
                        row.style.display = isExpanded ? 'none' : 'table-row';
                    }
                });

                if (isExpanded) {
                    this.classList.remove('expanded');
                    text.textContent = 'Show More';
                } else {
                    this.classList.add('expanded');
                    text.textContent = 'Show Less';
                }
            });
        }
    });
}

function initMobileToggle() {
    const mobileCards = document.querySelectorAll('.collapsible-mobile-card');
    const mobileToggleContainer = document.querySelector('.mobile-toggle-container');

    if (mobileCards.length <= 10 || !mobileToggleContainer) {
        return;
    }

    mobileToggleContainer.style.display = 'block';
    const toggleButton = mobileToggleContainer.querySelector('.btn-toggle-mobile');

    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            const isExpanded = this.classList.contains('expanded');
            const icon = this.querySelector('i');
            const text = this.querySelector('.toggle-text');

            mobileCards.forEach(function(card, index) {
                const cardIndex = parseInt(card.dataset.mobileIndex);
                if (cardIndex > 10) {
                    card.style.display = isExpanded ? 'none' : 'block';
                }
            });

            if (isExpanded) {
                this.classList.remove('expanded');
                text.textContent = 'Show More';
            } else {
                this.classList.add('expanded');
                text.textContent = 'Show Less';
            }
        });
    }
}
