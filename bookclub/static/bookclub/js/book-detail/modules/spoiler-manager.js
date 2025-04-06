// spoiler-manager.js - Handles spoiler detection and management
import { DomHelpers } from '../utils/dom-helpers.js';

export const SpoilerManager = {
    username: null,
    showSpoilersToggle: null,
    
    /**
     * Initialize the spoiler manager
     * @param {string} username - Current username
     * @returns {object} - SpoilerManager instance
     */
    init(username) {
        this.username = username;
        this.showSpoilersToggle = document.getElementById('showSpoilersToggle');
        
        this._setupEventListeners();
        
        // Initial check for spoilers
        this._checkSpoilersOnLoad();
        
        return this;
    },
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        if (this.showSpoilersToggle) {
            this.showSpoilersToggle.addEventListener('change', () => {
                this._toggleAllSpoilers(this.showSpoilersToggle.checked);
            });
        }
        
        // Use event delegation for dynamically added spoiler buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('show-spoiler-btn')) {
                const spoilerWarning = e.target.closest('.spoiler-warning');
                const spoilerContent = spoilerWarning.nextElementSibling;
                
                if (spoilerWarning && spoilerContent) {
                    spoilerWarning.style.display = 'none';
                    spoilerContent.style.display = 'block';
                }
            }
        });
    },
    
    /**
     * Toggle all spoilers
     * @param {boolean} show - Whether to show all spoilers
     */
    _toggleAllSpoilers(show) {
        // Check both main comments and replies
        const spoilerComments = document.querySelectorAll('.comment-card.spoiler-comment, .reply-card.spoiler-comment');
        
        spoilerComments.forEach(comment => {
            const spoilerWarning = comment.querySelector('.spoiler-warning');
            const spoilerContent = comment.querySelector('.spoiler-content');
            
            if (spoilerWarning && spoilerContent) {
                if (show) {
                    spoilerWarning.style.display = 'none';
                    spoilerContent.style.display = 'block';
                } else {
                    spoilerWarning.style.display = 'block';
                    spoilerContent.style.display = 'none';
                }
            }
        });
    },
    
    /**
     * Check for spoilers on page load
     */
    _checkSpoilersOnLoad() {
        // Get user's progress percentage from the progress bar
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar && this.username) {
            const userProgressValue = parseFloat(progressBar.getAttribute('aria-valuenow') || 0);
            this.checkSpoilers({ normalized_progress: userProgressValue });
        }
    },
    
    /**
     * Check for spoilers based on user progress
     * @param {object} userProgress - User's current progress
     */
    checkSpoilers(userProgress) {
        if (!this.username) return;
        
        const userProgressValue = parseFloat(userProgress.normalized_progress);
        
        // Process all comments (both main and replies)
        this._processCommentCards(userProgressValue);
        this._processReplyCards(userProgressValue);
    },
    
    /**
     * Process main comment cards for spoilers
     * @param {number} userProgressValue - User's progress value
     */
    _processCommentCards(userProgressValue) {
        document.querySelectorAll('.comment-card').forEach(comment => {
            const commentProgress = parseFloat(comment.dataset.progress || 0);
            const commentUser = comment.querySelector('.comment-user')?.textContent.trim();
            
            // Skip if it's the user's own comment
            if (commentUser === this.username) return;
            
            if (commentProgress > userProgressValue) {
                // This comment is ahead of user's progress - it's a spoiler
                this._markAsSpoiler(comment);
            } else {
                // This comment is not ahead of user's progress
                this._unmarkSpoiler(comment);
            }
        });
    },
    
    /**
     * Process reply cards for spoilers
     * @param {number} userProgressValue - User's progress value
     */
    _processReplyCards(userProgressValue) {
        document.querySelectorAll('.reply-card').forEach(reply => {
            // Try to get progress from the parent comment
            const parentComment = reply.closest('.comment-card');
            if (!parentComment) return; // Skip if no parent found
            
            const commentProgress = parseFloat(parentComment.dataset.progress || 0);
            
            // Get reply author
            const replyUser = reply.querySelector('.comment-user')?.textContent.trim();
            
            // Skip if it's the user's own reply
            if (replyUser === this.username) return;
            
            // Apply spoiler based on parent comment's progress
            if (commentProgress > userProgressValue) {
                this._markAsSpoiler(reply);
            } else {
                this._unmarkSpoiler(reply);
            }
        });
    },
    
    /**
     * Mark a comment as a spoiler
     * @param {HTMLElement} comment - Comment element
     */
    _markAsSpoiler(comment) {
        // Already marked
        if (comment.classList.contains('spoiler-comment')) return;
        
        comment.classList.add('spoiler-comment');
        
        // Make sure the comment has spoiler warning and hidden content
        if (!comment.querySelector('.spoiler-warning')) {
            const cardBody = comment.querySelector('.card-body');
            if (!cardBody) return; // Skip if card body doesn't exist
            
            try {
                // Create spoiler warning
                const spoilerWarning = DomHelpers.createElement('div', {
                    className: 'spoiler-warning alert alert-warning alert-permanent'
                }, '<i class="bi bi-exclamation-triangle-fill"></i> This comment is from further in the book than you\'ve read. <button class="btn btn-sm btn-outline-secondary ms-2 show-spoiler-btn">Show Anyway</button>');
                
                // Create spoiler content container
                const spoilerContent = DomHelpers.createElement('div', {
                    className: 'spoiler-content',
                    style: { display: 'none' }
                });
                
                // Deep clone all of the card body content
                // This approach preserves all elements (comments, reactions, etc.) with their data attributes
                const bodyContentClone = cardBody.cloneNode(true);
                
                // First, extract the spoiler warning from the clone if it already exists
                const clonedWarning = bodyContentClone.querySelector('.spoiler-warning');
                if (clonedWarning) {
                    clonedWarning.remove();
                }
                
                // Extract the card text and reactions from the clone
                const commentText = bodyContentClone.querySelector('.card-text');
                const commentReactions = bodyContentClone.querySelector('.comment-reactions');
                
                // Add them to the spoiler content
                if (commentText) {
                    spoilerContent.appendChild(commentText);
                }
                
                if (commentReactions) {
                    spoilerContent.appendChild(commentReactions);
                }
                
                // Remove the original content from the card body
                const originalText = cardBody.querySelector('.card-text');
                const originalReactions = cardBody.querySelector('.comment-reactions');
                
                if (comment.classList.contains('comment-card')) {
                    // For main comments, remove the original content
                    if (originalText) originalText.remove();
                    if (originalReactions) originalReactions.remove();
                } else {
                    // For replies, hide the original content
                    if (originalText) originalText.style.display = 'none';
                    if (originalReactions) originalReactions.style.display = 'none';
                }
                
                // Add the elements to the card
                cardBody.appendChild(spoilerWarning);
                cardBody.appendChild(spoilerContent);
                
                // Clear any users panels that might have been cloned
                const usersPanels = spoilerContent.querySelectorAll('.reaction-users-panel');
                usersPanels.forEach(panel => panel.remove());
                
            } catch (error) {
                console.error('Error marking spoiler:', error);
            }
        }
    },
    
    /**
     * Unmark a comment as a spoiler
     * @param {HTMLElement} comment - Comment element
     */
    _unmarkSpoiler(comment) {
        // Not marked
        if (!comment.classList.contains('spoiler-comment')) return;
        
        comment.classList.remove('spoiler-comment');
        
        // If it had spoiler warning, remove it and show content
        const spoilerWarning = comment.querySelector('.spoiler-warning');
        const spoilerContent = comment.querySelector('.spoiler-content');
        
        if (spoilerWarning && spoilerContent) {
            try {
                const cardBody = comment.querySelector('.card-body');
                
                // Extract content from the spoiler
                const contentText = spoilerContent.querySelector('.card-text');
                const contentReactions = spoilerContent.querySelector('.comment-reactions');
                
                if (comment.classList.contains('comment-card')) {
                    // For main comments, restore the content to the card body
                    if (contentText && cardBody) {
                        cardBody.appendChild(contentText);
                    }
                    
                    if (contentReactions && cardBody) {
                        cardBody.appendChild(contentReactions);
                    }
                } else {
                    // For replies, show the original hidden content
                    const originalText = cardBody.querySelector('.card-text');
                    const originalReactions = cardBody.querySelector('.comment-reactions:not(.spoiler-content .comment-reactions)');
                    
                    if (originalText) originalText.style.display = '';
                    if (originalReactions) originalReactions.style.display = '';
                }
                
                // Remove spoiler elements
                if (spoilerWarning) spoilerWarning.remove();
                if (spoilerContent) spoilerContent.remove();
                
                // Remove any users panels that might be open
                const usersPanels = comment.querySelectorAll('.reaction-users-panel');
                usersPanels.forEach(panel => panel.remove());
                
            } catch (error) {
                console.error('Error unmarking spoiler:', error);
            }
        }
    }
};