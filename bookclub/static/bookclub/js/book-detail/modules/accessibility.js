// accessibility.js - Handles accessibility improvements
export const AccessibilityHelper = {
    /**
     * Initialize accessibility improvements
     * @returns {object} - AccessibilityHelper instance
     */
    init() {
        this._setupGroupProgressCollapse();
        return this;
    },
    
    /**
     * Set up a modal for proper accessibility
     * @param {string} modalId - Modal element ID
     * @param {string} triggerBtnId - Trigger button ID
     */
    setupModal(modalId, triggerBtnId) {
        const modal = document.getElementById(modalId);
        const triggerBtn = document.getElementById(triggerBtnId);
        
        if (!modal || !triggerBtn) return;
        
        // Ensure proper focus management when modal opens
        modal.addEventListener('shown.bs.modal', function() {
            // Set focus to the first focusable element
            const focusableElements = modal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        });
        
        // Return focus to the trigger button when modal closes
        modal.addEventListener('hidden.bs.modal', function() {
            if (triggerBtn) {
                triggerBtn.focus();
            }
        });
        
        // Fix the aria-hidden issue by removing it and using inert attribute instead
        const modalBackdrop = document.querySelector('.modal-backdrop');
        if (modalBackdrop) {
            modalBackdrop.removeAttribute('aria-hidden');
        }
        
        // For Bootstrap 5, we can use the following approach to fix the issue
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
            const originalHide = bsModal.hide;
            bsModal.hide = function() {
                // Remove aria-hidden attribute before hiding
                modal.removeAttribute('aria-hidden');
                originalHide.call(this);
            };
        }
    },
    
    /**
     * Set up group progress collapse functionality
     */
    _setupGroupProgressCollapse() {
        const collapseElement = document.getElementById('groupMembersProgressCollapse');
        const chevronIcon = document.querySelector('.collapse-icon');
        
        if (collapseElement && chevronIcon) {
            collapseElement.addEventListener('show.bs.collapse', function() {
                chevronIcon.classList.add('collapsed');
            });
            
            collapseElement.addEventListener('hide.bs.collapse', function() {
                chevronIcon.classList.remove('collapsed');
            });
        }
    }
};