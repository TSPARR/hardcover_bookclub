// comment-reactions.js - Handles comment reactions
import { DomHelpers } from '../utils/dom-helpers.js';

export const CommentReactions = {
    /**
     * Initialize comment reactions
     * @returns {object} - CommentReactions instance
     */
    init() {
        this._setupEventListeners();
        this._initializeTooltips();
        return this;
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
        } else {
            // Fallback to simple hover card if Bootstrap tooltips aren't available
            this._setupCustomHoverCards();
        }
    },
    
    /**
     * Set up custom hover cards for browsers without Bootstrap
     */
    _setupCustomHoverCards() {
        // Create a tooltip element once and reuse it
        let hoverCard = document.createElement('div');
        hoverCard.className = 'reaction-hover-card';
        hoverCard.style.display = 'none';
        document.body.appendChild(hoverCard);
        
        // Add event listeners to reaction buttons
        document.querySelectorAll('.reaction-btn[data-reaction-users]').forEach(button => {
            // Show hover card on mouseenter
            button.addEventListener('mouseenter', (e) => {
                const users = e.target.dataset.reactionUsers;
                if (users) {
                    // Position the hover card
                    const rect = e.target.getBoundingClientRect();
                    hoverCard.innerHTML = `<strong>Reacted by:</strong><br>${users}`;
                    hoverCard.style.top = `${rect.top - hoverCard.offsetHeight - 5}px`;
                    hoverCard.style.left = `${rect.left + (rect.width / 2) - (hoverCard.offsetWidth / 2)}px`;
                    hoverCard.style.display = 'block';
                }
            });
            
            // Hide hover card on mouseleave
            button.addEventListener('mouseleave', () => {
                hoverCard.style.display = 'none';
            });
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
                }
                
                // Add text node first
                button.appendChild(document.createTextNode(reaction + ' '));
                
                // Create span for count
                const countSpan = document.createElement('span');
                countSpan.className = 'reaction-count';
                countSpan.textContent = info.count;
                
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