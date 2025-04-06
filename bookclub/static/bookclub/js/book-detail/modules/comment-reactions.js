// comment-reactions.js - Handles comment reactions
import { DomHelpers } from '../utils/dom-helpers.js';

export const CommentReactions = {
    // Store the user popup
    mobileReactionPopup: null,
    
    /**
     * Initialize comment reactions
     * @returns {object} - CommentReactions instance
     */
    init() {
        this._setupEventListeners();
        this._initializeTooltips();
        this._createMobilePopup();
        return this;
    },
    
    /**
     * Create a mobile-friendly popup for showing reaction users
     */
    _createMobilePopup() {
        // Create the popup once and reuse it
        this.mobileReactionPopup = document.createElement('div');
        this.mobileReactionPopup.className = 'reaction-mobile-popup';
        this.mobileReactionPopup.style.display = 'none';
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'reaction-popup-close';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.addEventListener('click', () => {
            this.mobileReactionPopup.style.display = 'none';
        });
        
        // Create content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'reaction-popup-content';
        
        // Add elements to the popup
        this.mobileReactionPopup.appendChild(closeButton);
        this.mobileReactionPopup.appendChild(contentDiv);
        document.body.appendChild(this.mobileReactionPopup);
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (this.mobileReactionPopup.style.display === 'block' && 
                !e.target.classList.contains('reaction-btn') && 
                !this.mobileReactionPopup.contains(e.target)) {
                this.mobileReactionPopup.style.display = 'none';
            }
        });
    },
    
    /**
     * Set up event listeners for reactions
     */
    _setupEventListeners() {
        // Event delegation for reaction buttons
        document.addEventListener('click', (e) => {
            // Handle clicking existing reaction buttons
            if (e.target.classList.contains('reaction-btn') || e.target.closest('.reaction-btn')) {
                const button = e.target.classList.contains('reaction-btn') ? 
                              e.target : e.target.closest('.reaction-btn');
                
                // Check if we're showing users or toggling the reaction
                if (e.target.classList.contains('reaction-count') || e.target.closest('.reaction-count')) {
                    // Show users who reacted
                    this._showMobileReactionUsers(button);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                const commentId = button.dataset.commentId;
                const reaction = button.dataset.reaction;
                
                if (commentId && reaction) {
                    this._toggleReaction(commentId, reaction);
                }
            }
            
            // Handle clicking reaction options from the panel
            if (e.target.classList.contains('reaction-option')) {
                const button = e.target;
                const commentId = button.dataset.commentId;
                const reaction = button.dataset.reaction;
                
                if (commentId && reaction) {
                    this._toggleReaction(commentId, reaction);
                    
                    // Hide the reaction panel after selection
                    const panel = button.closest('.reaction-panel');
                    if (panel) {
                        panel.style.display = 'none';
                    }
                }
            }
            
            // Handle the "Add Reaction" button click
            if (e.target.classList.contains('add-reaction-btn') || e.target.closest('.add-reaction-btn')) {
                const button = e.target.classList.contains('add-reaction-btn') ? 
                              e.target : e.target.closest('.add-reaction-btn');
                
                const panel = button.nextElementSibling;
                if (panel && panel.classList.contains('reaction-panel')) {
                    // Toggle the panel visibility
                    const isVisible = panel.style.display === 'flex';
                    panel.style.display = isVisible ? 'none' : 'flex';
                    
                    // Close other open panels
                    if (!isVisible) {
                        document.querySelectorAll('.reaction-panel').forEach(p => {
                            if (p !== panel && p.style.display === 'flex') {
                                p.style.display = 'none';
                            }
                        });
                    }
                }
            }
            
            // Close reaction panels when clicking elsewhere
            if (!e.target.classList.contains('add-reaction-btn') && 
                !e.target.closest('.add-reaction-btn') &&
                !e.target.classList.contains('reaction-option') && 
                !e.target.closest('.reaction-panel')) {
                document.querySelectorAll('.reaction-panel').forEach(panel => {
                    panel.style.display = 'none';
                });
            }
        });
    },
    
    /**
     * Show mobile popup with users who reacted
     * @param {HTMLElement} button - The reaction button element
     */
    _showMobileReactionUsers(button) {
        if (!this.mobileReactionPopup) return;
        
        const users = button.getAttribute('data-reaction-users');
        const reaction = button.getAttribute('data-reaction');
        
        if (!users) return;
        
        // Update popup content
        const contentDiv = this.mobileReactionPopup.querySelector('.reaction-popup-content');
        contentDiv.innerHTML = `
            <h5 class="reaction-popup-title">${reaction} Reactions</h5>
            <p class="reaction-popup-users">${users}</p>
        `;
        
        // Position and show the popup
        const rect = button.getBoundingClientRect();
        const isDesktop = window.innerWidth > 768;
        
        if (isDesktop) {
            // On desktop, position near the button
            this.mobileReactionPopup.style.top = `${rect.top - this.mobileReactionPopup.offsetHeight - 10}px`;
            this.mobileReactionPopup.style.left = `${rect.left + (rect.width / 2) - (this.mobileReactionPopup.offsetWidth / 2)}px`;
            this.mobileReactionPopup.classList.remove('reaction-mobile-popup-fullscreen');
        } else {
            // On mobile, position at the bottom of the screen
            this.mobileReactionPopup.style.top = 'auto';
            this.mobileReactionPopup.style.left = '0';
            this.mobileReactionPopup.style.bottom = '0';
            this.mobileReactionPopup.classList.add('reaction-mobile-popup-fullscreen');
        }
        
        this.mobileReactionPopup.style.display = 'block';
    },
    
    /**
     * Initialize tooltips for reaction buttons
     * This method uses Bootstrap tooltips if available
     */
    _initializeTooltips() {
        // Check if Bootstrap's tooltip object exists
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
            // Initialize tooltips on all reaction buttons
            document.querySelectorAll('.reaction-btn[data-reaction-users]').forEach(button => {
                new bootstrap.Tooltip(button);
            });
        }
    },
    
    /**
     * Set up mobile tooltips for a specific container
     * @param {HTMLElement} container - Container element to search within
     */
    _setupMobileTooltips(container) {
        // Target all reaction buttons in the container
        const buttons = container ? 
            container.querySelectorAll('.reaction-btn') : 
            document.querySelectorAll('.reaction-btn');
        
        // Make sure all buttons have click handlers for showing users
        buttons.forEach(button => {
            if (button.getAttribute('data-reaction-users')) {
                // We don't need to do anything, event delegation handles this
            }
        });
    },
    
    /**
     * Toggle a reaction on a comment
     * @param {string} commentId - Comment ID
     * @param {string} reaction - Reaction type
     */
    _toggleReaction(commentId, reaction) {
        fetch(`/comments/${commentId}/reaction/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': DomHelpers.getCsrfToken()
            },
            body: JSON.stringify({
                reaction: reaction
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update UI
                this._updateReactionsUI(commentId, data);
            }
        })
        .catch(error => {
            console.error('Error toggling reaction:', error);
        });
    },
    
    /**
     * Update reactions UI
     * @param {string} commentId - Comment ID
     * @param {object} data - Response data from API
     */
    _updateReactionsUI(commentId, data) {
        const reactionsContainer = document.querySelector(`[data-comment-id="${commentId}"] .existing-reactions`);
        if (!reactionsContainer) return;
        
        // Clear existing reactions
        reactionsContainer.innerHTML = '';
        
        // Add updated reactions
        // First try the new format with user info
        if (data.reactions) {
            for (const [reaction, info] of Object.entries(data.reactions)) {
                // Create button element
                const button = document.createElement('button');
                button.className = `btn btn-sm btn-outline-secondary reaction-btn me-1 ${info.current_user_reacted ? 'active' : ''}`;
                button.dataset.commentId = commentId;
                button.dataset.reaction = reaction;
                
                // Set user data for tooltips
                if (info.users && info.users.length) {
                    const usernames = info.users.join(', ');
                    button.dataset.reactionUsers = usernames;
                    button.setAttribute('data-bs-toggle', 'tooltip');
                    button.setAttribute('data-bs-custom-class', 'reaction-tooltip');
                    button.setAttribute('data-bs-placement', 'top');
                    button.setAttribute('data-bs-title', `Reacted by: ${usernames}`);
                    
                    // Add a small instruction for mobile
                    button.setAttribute('aria-label', `${reaction} reaction - tap count to see who reacted`);
                }
                
                // Add text node first
                button.appendChild(document.createTextNode(reaction + ' '));
                
                // Create span for count
                const countSpan = document.createElement('span');
                countSpan.className = 'reaction-count';
                countSpan.textContent = info.count;
                countSpan.setAttribute('role', 'button');
                countSpan.setAttribute('aria-label', 'Show who reacted');
                
                // Add span to button
                button.appendChild(countSpan);
                
                // Add button to container
                reactionsContainer.appendChild(button);
            }
        } 
        // Fallback to old format if needed
        else if (data.counts) {
            for (const [reaction, count] of Object.entries(data.counts)) {
                // Create button element
                const button = document.createElement('button');
                button.className = `btn btn-sm btn-outline-secondary reaction-btn me-1 ${data.action === 'added' && data.reaction === reaction ? 'active' : ''}`;
                button.dataset.commentId = commentId;
                button.dataset.reaction = reaction;
                
                // Add text node first
                button.appendChild(document.createTextNode(reaction + ' '));
                
                // Create span for count
                const countSpan = document.createElement('span');
                countSpan.className = 'reaction-count';
                countSpan.textContent = count;
                
                // Add span to button
                button.appendChild(countSpan);
                
                // Add button to container
                reactionsContainer.appendChild(button);
            }
        }
        
        // Reinitialize tooltips for the new buttons
        this._initializeTooltips();
    }
};