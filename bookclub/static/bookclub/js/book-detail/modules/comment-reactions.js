// comment-reactions.js - Handles comment reactions
import { DomHelpers } from '../utils/dom-helpers.js';

export const CommentReactions = {
    /**
     * Initialize comment reactions
     * @returns {object} - CommentReactions instance
     */
    init() {
        this._setupEventListeners();
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
};