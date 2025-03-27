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
        this._setupIndividualSpoilerButtons();
        
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
    },
    
    /**
     * Set up individual spoiler buttons
     */
    _setupIndividualSpoilerButtons() {
        document.querySelectorAll('.show-spoiler-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const spoilerWarning = e.target.closest('.spoiler-warning');
                const spoilerContent = spoilerWarning.nextElementSibling;
                
                spoilerWarning.style.display = 'none';
                spoilerContent.style.display = 'block';
            });
        });
    },
    
    /**
     * Toggle all spoilers
     * @param {boolean} show - Whether to show all spoilers
     */
    _toggleAllSpoilers(show) {
        const spoilerComments = document.querySelectorAll('.spoiler-comment');
        
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
     * Check for spoilers based on user progress
     * @param {object} userProgress - User's current progress
     */
    checkSpoilers(userProgress) {
        if (!this.username) return;
        
        const userProgressValue = parseFloat(userProgress.normalized_progress);
        
        document.querySelectorAll('.comment-card').forEach(comment => {
            const commentProgress = parseFloat(comment.dataset.progress);
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
            const commentText = cardBody.querySelector('.card-text');
            
            if (!commentText) return;
            
            // Create spoiler warning
            const spoilerWarning = DomHelpers.createElement('div', {
                className: 'spoiler-warning alert alert-warning'
            }, '<i class="bi bi-exclamation-triangle-fill"></i> This comment is from further in the book than you\'ve read. <button class="btn btn-sm btn-outline-secondary ms-2 show-spoiler-btn">Show Anyway</button>');
            
            // Create spoiler content container
            const spoilerContent = DomHelpers.createElement('div', {
                className: 'spoiler-content',
                style: { display: 'none' }
            });
            
            // Move the comment text into the spoiler content
            spoilerContent.appendChild(commentText.cloneNode(true));
            commentText.remove();
            
            // Add the elements to the card
            cardBody.appendChild(spoilerWarning);
            cardBody.appendChild(spoilerContent);
            
            // Add event listener to show button
            spoilerWarning.querySelector('.show-spoiler-btn').addEventListener('click', function() {
                spoilerWarning.style.display = 'none';
                spoilerContent.style.display = 'block';
            });
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
            const cardBody = comment.querySelector('.card-body');
            const commentText = spoilerContent.querySelector('.card-text');
            
            if (commentText && cardBody) {
                // Move the comment text back into the card body
                cardBody.appendChild(commentText);
                
                // Remove spoiler elements
                spoilerWarning.remove();
                spoilerContent.remove();
            }
        }
    }
};