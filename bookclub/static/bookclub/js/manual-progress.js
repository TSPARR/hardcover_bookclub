// manual-progress.js - Handles the manual progress page functionality
import { ProgressValidator } from './book-detail/modules/progress-validator.js';
import { DomHelpers } from './book-detail/utils/dom-helpers.js';

// Main module for manual progress page
const ManualProgress = {
    /**
     * Initialize the page functionality
     */
    init() {
        this._setupHelpText();
        this._setupProgressValidation();
        this._setupHardcoverSync();
    },
    
    /**
     * Set up help text toggle based on progress type
     */
    _setupHelpText() {
        // Show/hide the appropriate help text based on selected progress type
        function updateHelpText() {
            document.querySelectorAll('.progress-help').forEach(el => {
                el.style.display = 'none';
            });
            
            const progressType = document.getElementById('progress_type').value;
            if (progressType === 'percent') {
                document.getElementById('percent-help').style.display = 'block';
            } else if (progressType === 'page') {
                document.getElementById('page-help').style.display = 'block';
            } else if (progressType === 'audio') {
                document.getElementById('audio-help').style.display = 'block';
            }
        }
        
        // Initialize
        updateHelpText();
        
        // Update when changed
        const progressTypeInput = document.getElementById('progress_type');
        if (progressTypeInput) {
            progressTypeInput.addEventListener('change', () => {
                updateHelpText();
                
                // Re-validate when type changes
                const progressValue = document.getElementById('progress_value');
                if (progressValue && progressValue.value.trim() !== '') {
                    const event = new Event('input', { bubbles: true });
                    progressValue.dispatchEvent(event);
                }
            });
        }
    },
    
    /**
     * Set up validation for progress input
     */
    _setupProgressValidation() {
        const progressTypeInput = document.getElementById('progress_type');
        const progressValueInput = document.getElementById('progress_value');
        const progressForm = document.querySelector('form[action*="set_manual_progress"]');
        
        if (!progressTypeInput || !progressValueInput || !progressForm) return;
        
        // Get book metadata for validation
        const bookData = {
            book: {
                pages: parseInt(document.querySelector('meta[name="book-pages"]')?.content),
                audio_seconds: parseInt(document.querySelector('meta[name="book-audio-seconds"]')?.content)
            },
            edition: {
                pages: parseInt(document.querySelector('meta[name="edition-pages"]')?.content),
                audio_seconds: parseInt(document.querySelector('meta[name="edition-audio-seconds"]')?.content)
            }
        };
        
        // Real-time validation on input
        progressValueInput.addEventListener('input', () => {
            const type = progressTypeInput.value;
            const value = progressValueInput.value;
            
            if (value.trim() === '') return; // Skip validation for empty values
            
            const validation = ProgressValidator.validate(type, value, bookData);
            
            if (!validation.isValid) {
                progressValueInput.classList.add('is-invalid');
                progressValueInput.classList.remove('is-valid');
                
                // Create or update validation feedback
                let feedback = progressValueInput.nextElementSibling;
                while (feedback && !feedback.classList.contains('invalid-feedback')) {
                    feedback = feedback.nextElementSibling;
                }
                
                if (!feedback) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    progressValueInput.parentNode.insertBefore(feedback, progressValueInput.nextSibling);
                }
                
                feedback.textContent = validation.message;
            } else {
                progressValueInput.classList.remove('is-invalid');
                progressValueInput.classList.add('is-valid');
                
                // Remove validation feedback if it exists
                const feedback = document.querySelector('.invalid-feedback');
                if (feedback) {
                    feedback.remove();
                }
            }
        });
        
        // Form submission validation
        progressForm.addEventListener('submit', (e) => {
            const type = progressTypeInput.value;
            const value = progressValueInput.value;
            
            const validation = ProgressValidator.validate(type, value, bookData);
            
            if (!validation.isValid) {
                e.preventDefault();
                
                // Show error message
                progressValueInput.classList.add('is-invalid');
                
                // Create or update validation feedback
                let feedback = progressValueInput.nextElementSibling;
                while (feedback && !feedback.classList.contains('invalid-feedback')) {
                    feedback = feedback.nextElementSibling;
                }
                
                if (!feedback) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    progressValueInput.parentNode.insertBefore(feedback, progressValueInput.nextSibling);
                }
                
                feedback.textContent = validation.message;
                
                // Scroll to the error
                progressValueInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // Format the value before submission
                progressValueInput.value = ProgressValidator.formatProgressValue(type, validation.value);
                
                // If it's audio progress and we have seconds, include them in the form submission
                if (type === 'audio' && validation.seconds) {
                    let audioSecondsInput = document.getElementById('audio_seconds');
                    
                    if (!audioSecondsInput) {
                        audioSecondsInput = document.createElement('input');
                        audioSecondsInput.type = 'hidden';
                        audioSecondsInput.id = 'audio_seconds';
                        audioSecondsInput.name = 'audio_seconds';
                        progressForm.appendChild(audioSecondsInput);
                    }
                    
                    audioSecondsInput.value = validation.seconds;
                }
            }
        });
    },
    
    /**
     * Set up Hardcover sync button
     */
    _setupHardcoverSync() {
        // Add Hardcover sync functionality if button exists
        const syncButton = document.getElementById('syncHardcoverProgress');
        if (syncButton) {
            syncButton.addEventListener('click', function(e) {
                e.preventDefault();
                const bookId = this.getAttribute('data-book-id');
                const hardcoverId = this.getAttribute('data-hardcover-id');
                
                // Show loading state
                this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Syncing...';
                this.disabled = true;
                
                // Fetch progress from Hardcover
                fetch(`/api/hardcover-progress/${hardcoverId}/`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            alert('Error: ' + data.error);
                            return;
                        }
                        
                        if (data.progress && data.progress.length > 0) {
                            // Send the data to update local progress
                            return fetch(`/books/${bookId}/update-progress/`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-CSRFToken': DomHelpers.getCsrfToken()
                                },
                                body: JSON.stringify({
                                    auto_sync: true,
                                    hardcover_data: data.progress[0]
                                })
                            });
                        } else {
                            throw new Error('No reading progress found in Hardcover');
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Reload the page to show updated progress
                            window.location.reload();
                        } else {
                            throw new Error(data.error || 'Failed to update local progress');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Error: ' + error.message);
                        
                        // Reset button
                        this.innerHTML = '<i class="bi bi-cloud-download"></i> Import Progress from Hardcover';
                        this.disabled = false;
                    });
            });
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    ManualProgress.init();
});