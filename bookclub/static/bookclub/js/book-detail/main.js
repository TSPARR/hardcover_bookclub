// main.js - Main entry point for book detail page
import { ProgressTracker } from './modules/progress-tracker.js';
import { HardcoverSync } from './modules/hardcover-sync.js';
import { SpoilerManager } from './modules/spoiler-manager.js';
import { CommentReactions } from './modules/comment-reactions.js';
import { AccessibilityHelper } from './modules/accessibility.js';
import { RatingManager } from './modules/rating-manager.js'; // Add this import

// Initialize all modules when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get common elements and values
    const bookId = document.getElementById('book-id')?.value;
    const hardcoverId = document.getElementById('hardcover-id')?.value;
    const currentUsername = document.getElementById('current-username')?.value;
    
    // Only initialize if we're on a book detail page
    if (bookId) {
        // Initialize all modules
        const progressTracker = ProgressTracker.init(bookId);
        const hardcoverSync = HardcoverSync.init(bookId, hardcoverId, progressTracker);
        const spoilerManager = SpoilerManager.init(currentUsername);
        const commentReactions = CommentReactions.init();
        const accessibilityHelper = AccessibilityHelper.init();
        const ratingManager = RatingManager.init(bookId); // Add RatingManager initialization
        
        // Make the modules communicate with each other
        
        // When progress updates, check spoilers
        progressTracker.onProgressUpdated = (newProgress) => {
            spoilerManager.checkSpoilers(newProgress);
        };
        
        // When hardcover sync happens, update progress UI
        hardcoverSync.onProgressSynced = (progressData) => {
            progressTracker.updateProgressFromSync(progressData);
        };
        
        // Initialize accessibility improvements for modals
        accessibilityHelper.setupModal('progressUpdateModal', 'updateProgressBtn');
        accessibilityHelper.setupModal('hardcoverSyncModal', 'syncHardcoverProgress');
        
        // Set up validation for progress fields
        progressTracker._setupProgressValidation();
        
        // Expose modules to window for cross-module access (for functions that need direct access)
        window.ProgressTracker = progressTracker;
        window.HardcoverSync = hardcoverSync;
        window.SpoilerManager = spoilerManager;
        window.RatingManager = ratingManager; // Add RatingManager to window
    }
});