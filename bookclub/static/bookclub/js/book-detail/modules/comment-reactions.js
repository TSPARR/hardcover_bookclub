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
        // Use event delegation for all reaction buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('reaction-btn') || 
                e.target.closest('.reaction-btn') ||
                e.target.classList.contains('reaction-option')) {
                
                const button = e.target.classList.contains('reaction-btn') ? 
                              e.target : 
                              (e.target.closest('.reaction-btn') || e.target);
                
                const commentId = button.dataset.commentId;
                const reaction = button.dataset.reaction;
                
                if (commentId && reaction) {
                    this._toggleReaction(commentId, reaction);
                }
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
            const button = DomHelpers.createElement('button', {
                className: `btn btn-sm btn-outline-secondary reaction-btn me-1 ${data.action === 'added' && data.reaction === reaction ? 'active' : ''}`,
                dataset: {
                    commentId: commentId,
                    reaction: reaction
                }
            }, `${reaction} <span class="reaction-count">${count}</span>`);
            
            reactionsContainer.appendChild(button);
        }
    }
};