// edition-selection.js
// This code will handle the edition selection functionality
// It's optional - your app will work without it, but it adds a nice feature
// where users can preview edition info without selecting it

document.addEventListener('DOMContentLoaded', function () {
    // Get all edition cards
    const editionCards = document.querySelectorAll('.card');

    // Add hover effect to cards
    editionCards.forEach(card => {
        card.addEventListener('mouseenter', function () {
            this.classList.add('shadow');
        });

        card.addEventListener('mouseleave', function () {
            this.classList.remove('shadow');
        });
    });

    // If we're on the manual progress page, handle progress type changes
    const progressTypeSelect = document.getElementById('progress_type');
    if (progressTypeSelect) {
        // Update the form field guidance based on selected progress type
        progressTypeSelect.addEventListener('change', function () {
            const progressType = this.value;
            const progressValue = document.getElementById('progress_value');

            document.querySelectorAll('.progress-help').forEach(el => {
                el.style.display = 'none';
            });

            if (progressType === 'percent') {
                document.getElementById('percent-help').style.display = 'block';
                // Adjust input to show percent if it was something else
                if (!progressValue.value.includes('%') && progressValue.value !== '') {
                    try {
                        // Try to convert to percentage
                        const numValue = parseFloat(progressValue.value);
                        if (!isNaN(numValue)) {
                            progressValue.value = Math.min(100, Math.max(0, numValue));
                        }
                    } catch (e) {
                        // If conversion fails, just clear it
                        progressValue.value = '';
                    }
                }
            } else if (progressType === 'page') {
                document.getElementById('page-help').style.display = 'block';
                // Adjust input to show page number if it was percentage
                if (progressValue.value.includes('%')) {
                    progressValue.value = progressValue.value.replace('%', '');
                }
            } else if (progressType === 'audio') {
                document.getElementById('audio-help').style.display = 'block';
                // If it was numeric before, try to convert to audio format
                if (!progressValue.value.includes('h') && !progressValue.value.includes('m')) {
                    try {
                        const numValue = parseFloat(progressValue.value);
                        if (!isNaN(numValue)) {
                            // Convert raw number to hours/minutes format
                            const hours = Math.floor(numValue / 60);
                            const minutes = Math.floor(numValue % 60);

                            if (hours > 0) {
                                progressValue.value = `${hours}h ${minutes}m`;
                            } else {
                                progressValue.value = `${minutes}m`;
                            }
                        }
                    } catch (e) {
                        progressValue.value = '';
                    }
                }
            }
        });

        // Handle finished reading checkbox
        const finishedCheckbox = document.getElementById('finished_reading');
        if (finishedCheckbox) {
            finishedCheckbox.addEventListener('change', function () {
                if (this.checked) {
                    // If marking as finished, we can automatically set progress to 100%
                    const progressType = document.getElementById('progress_type').value;
                    const progressValue = document.getElementById('progress_value');

                    // Check if already finished
                    const isAlreadyFinished = progressValue.value === '100' ||
                        progressValue.value === '100%';

                    if (!isAlreadyFinished) {
                        if (confirm('Would you like to update progress to 100% complete?')) {
                            if (progressType === 'percent') {
                                progressValue.value = '100';
                            } else if (progressType === 'page') {
                                // If we know the total pages, use that
                                const editionPages = document.querySelector('.alert-info strong + p, .alert-warning strong + p');
                                if (editionPages) {
                                    const pagesText = editionPages.textContent;
                                    const pagesMatch = pagesText.match(/Pages: (\d+)/);
                                    if (pagesMatch && pagesMatch[1]) {
                                        progressValue.value = pagesMatch[1];
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
    }
});