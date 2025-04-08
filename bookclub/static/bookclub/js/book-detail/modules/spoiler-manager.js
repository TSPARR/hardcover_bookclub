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

        // Listen for tab changes to check spoilers in newly displayed tabs
        document.addEventListener('shown.bs.tab', (e) => {
            // If the bets tab was just shown, check for spoilers there
            if (e.target.id === 'bets-tab') {
                this._checkSpoilersOnLoad();
            }
        });
    },
    
    /**
     * Toggle all spoilers
     * @param {boolean} show - Whether to show all spoilers
     */
    _toggleAllSpoilers(show) {
        // Check comments, replies, and dollar bets
        const spoilerElements = document.querySelectorAll(
            '.comment-card.spoiler-comment, .reply-card.spoiler-comment, .dollar-bet-item.spoiler-bet'
        );
        
        spoilerElements.forEach(element => {
            const spoilerWarning = element.querySelector('.spoiler-warning');
            const spoilerContent = element.querySelector('.spoiler-content');
            
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
        
        // Process all content types for spoilers
        this._processCommentCards(userProgressValue);
        this._processReplyCards(userProgressValue);
        this._processDollarBets(userProgressValue);
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
     * Process dollar bets for spoilers
     * @param {number} userProgressValue - User's progress value
     */
    _processDollarBets(userProgressValue) {
        document.querySelectorAll('.dollar-bet-item').forEach(bet => {
            // Check if bet has a spoiler level attribute
            let betSpoilerLevel = bet.dataset.spoilerLevel || 'halfway';
            
            // Get proposer username
            const proposer = bet.querySelector('.bet-proposer')?.textContent.trim();
            
            // Skip if it's the user's own bet
            if (proposer === this.username) return;
            
            let isSpoiler = false;

            // Apply spoiler based on bet's spoiler level
            if (betSpoilerLevel === 'finished' && userProgressValue < 100) {
                // Only show "finished" bets to users who have completed the book
                isSpoiler = true;
            } else if (betSpoilerLevel === 'halfway' && userProgressValue < 50) {
                // Only show "halfway" bets to users who are at least halfway through
                isSpoiler = true;
            }
            
            // Additionally, always hide resolved bets if they're ahead of user's progress
            const isResolved = bet.classList.contains('resolved-bet');
            if (isResolved && userProgressValue < 95) {
                isSpoiler = true;
            }
            
            if (isSpoiler) {
                this._markBetAsSpoiler(bet);
            } else {
                this._unmarkBetSpoiler(bet);
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
    },

    /**
     * Mark a dollar bet as a spoiler
     * @param {HTMLElement} bet - Dollar bet element
     */
    _markBetAsSpoiler(bet) {
        // Already marked
        if (bet.classList.contains('spoiler-bet')) return;
        
        bet.classList.add('spoiler-bet');
        
        // Make sure the bet has spoiler warning and hidden content
        if (!bet.querySelector('.spoiler-warning')) {
            try {
                // Save original content
                const originalContent = bet.innerHTML;
                
                // Create spoiler warning with proper DOM elements
                const spoilerWarning = document.createElement('div');
                spoilerWarning.className = 'spoiler-warning alert alert-warning alert-permanent';
                
                const icon = document.createElement('i');
                icon.className = 'bi bi-exclamation-triangle-fill';
                spoilerWarning.appendChild(icon);
                
                spoilerWarning.appendChild(document.createTextNode(' This bet may contain spoilers for sections you haven\'t read yet. '));
                
                const showButton = document.createElement('button');
                showButton.className = 'btn btn-sm btn-outline-secondary ms-2 show-spoiler-btn';
                showButton.textContent = 'Show Anyway';
                spoilerWarning.appendChild(showButton);
                
                // Create spoiler content container
                const spoilerContent = document.createElement('div');
                spoilerContent.className = 'spoiler-content';
                spoilerContent.style.display = 'none';
                spoilerContent.innerHTML = originalContent;
                
                // Clear original content and add warning and hidden content
                bet.innerHTML = '';
                bet.appendChild(spoilerWarning);
                bet.appendChild(spoilerContent);
                
            } catch (error) {
                console.error('Error marking bet as spoiler:', error);
            }
        }
    },
    
    /**
     * Unmark a dollar bet as a spoiler
     * @param {HTMLElement} bet - Dollar bet element
     */
    _unmarkBetSpoiler(bet) {
        // Not marked
        if (!bet.classList.contains('spoiler-bet')) return;
        
        bet.classList.remove('spoiler-bet');
        
        // If it had spoiler warning, remove it and restore content
        const spoilerWarning = bet.querySelector('.spoiler-warning');
        const spoilerContent = bet.querySelector('.spoiler-content');
        
        if (spoilerWarning && spoilerContent) {
            try {
                // Get the original content
                const originalContent = spoilerContent.innerHTML;
                
                // Restore original content
                bet.innerHTML = originalContent;
                
            } catch (error) {
                console.error('Error unmarking bet spoiler:', error);
            }
        }
    }
};