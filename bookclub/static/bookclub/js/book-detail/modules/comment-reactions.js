// comment-reactions.js - Handles comment reactions
import { DomHelpers } from '../utils/dom-helpers.js';

export const CommentReactions = {
    /**
     * Initialize comment reactions
     * @returns {object} - CommentReactions instance
     */
    init() {
        // First check if the book is active
        this.isBookActive = this._checkBookActive();
        
        // CRITICAL: Force all panels to be hidden BEFORE any other initialization
        this._forceHideAllPanels();
        
        // Set up event listeners
        this._setupEventListeners();
        this._initializeReactionButtons();
        this._setupResizeHandler();
        
        // Apply read-only styles for inactive books
        if (!this.isBookActive) {
            this._applyReadOnlyStyles();
        }
        
        // Double check panels are still hidden after everything else
        setTimeout(() => {
            this._forceHideAllPanels();
        }, 100);
        
        return this;
    },
    
    /**
     * Aggressively force-hide all panels to ensure they're not visible by default
     * This solves issues with panels being visible on mobile
     */
    _forceHideAllPanels() {
        // Use !important to override any CSS rules that might show panels
        document.querySelectorAll('.reaction-panel').forEach(panel => {
            panel.style.cssText = 'display: none !important';
            // Force browser reflow to ensure styles are applied
            void panel.offsetHeight;
        });
        
        document.querySelectorAll('.reaction-users-panel').forEach(panel => {
            panel.style.cssText = 'display: none !important';
            void panel.offsetHeight;
        });
        
        document.querySelectorAll('.mobile-backdrop').forEach(backdrop => {
            panel.style.cssText = 'display: none !important';
            void backdrop.offsetHeight;
        });
    },
    
    /**
     * Check if the book is active based on the data attribute
     * @returns {boolean} - True if the book is active
     */
    _checkBookActive() {
        const discussionSection = document.querySelector('.discussion-section');
        if (discussionSection) {
            return discussionSection.dataset.isActiveBook === 'True';
        }
        return true; // Default to true if we can't determine
    },
    
    /**
     * Apply visual styles to indicate read-only mode
     */
    _applyReadOnlyStyles() {
        // Make sure reaction counts remain clickable
        const reactionButtons = document.querySelectorAll('.reaction-btn');
        
        reactionButtons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
            
            // Make sure the count span remains clickable
            const countSpan = btn.querySelector('.reaction-count');
            if (countSpan) {
                // Reset any disabled properties to ensure it's clickable
                countSpan.style.pointerEvents = 'auto';
                countSpan.style.cursor = 'pointer';
                countSpan.style.position = 'relative';
                countSpan.style.zIndex = '2';
                
                // Add a data attribute for debugging
                countSpan.dataset.readonlyEnabled = 'true';
                
                // IMPORTANT: Add a direct click handler to each count span
                countSpan.addEventListener('click', (e) => {
                    e.stopPropagation(); // Stop event from bubbling to disabled parent
                    
                    const button = countSpan.closest('.reaction-btn');
                    if (button) {
                        this._toggleReactionUsers(button);
                    }
                });
            }
        });
    },
    
    /**
     * Set up resize event handler to adjust panel positions on viewport changes
     */
    _setupResizeHandler() {
        // Throttle the resize event to avoid performance issues
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Hide all panels on resize to prevent positioning issues
                this._forceHideAllPanels();
            }, 250);
        });
    },
    
    /**
     * Initialize existing reaction buttons with user data
     * This fetches user data for all reaction buttons on page load
     */
    _initializeReactionButtons() {
        // Find all reaction buttons
        const reactionButtons = document.querySelectorAll('.reaction-btn');
        
        // Group reaction buttons by comment ID to minimize API calls
        const commentMap = new Map();
        
        reactionButtons.forEach(button => {
            const commentId = button.dataset.commentId;
            if (!commentId) return;
            
            if (!commentMap.has(commentId)) {
                commentMap.set(commentId, []);
            }
            
            commentMap.get(commentId).push(button);
        });
        
        // For each comment, fetch reaction data
        commentMap.forEach((buttons, commentId) => {
            this._fetchReactionUsers(commentId)
                .then(data => {
                    if (data && data.success && data.reactions) {
                        // Update each button with user data
                        buttons.forEach(button => {
                            const reaction = button.dataset.reaction;
                            if (reaction && data.reactions[reaction]) {
                                const info = data.reactions[reaction];
                                
                                // Set user data for tooltips
                                if (info.users && info.users.length) {
                                    const usernames = info.users.join(', ');
                                    button.dataset.reactionUsers = usernames;
                                    button.setAttribute('aria-label', `${reaction} reaction - click count to see who reacted`);
                                    
                                    // If in read-only mode, add direct handler for good measure
                                    if (!this.isBookActive) {
                                        const countSpan = button.querySelector('.reaction-count');
                                        if (countSpan && !countSpan.dataset.handlerAdded) {
                                            countSpan.dataset.handlerAdded = 'true';
                                            countSpan.addEventListener('click', (e) => {
                                                e.stopPropagation();
                                                this._toggleReactionUsers(button);
                                            });
                                        }
                                    }
                                }
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error(`Error fetching reaction users for comment ${commentId}:`, error);
                });
        });
        
        // Double check panels are hidden after fetching reaction data
        setTimeout(() => {
            this._forceHideAllPanels();
        }, 300);
    },
    
    /**
     * Fetch reaction users for a specific comment
     * @param {string} commentId - Comment ID
     * @returns {Promise} - Promise resolving to reaction data
     */
    _fetchReactionUsers(commentId) {
        return fetch(`/comments/${commentId}/reaction-users/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            // If endpoint not found, create a fallback response
            if (response.status === 404) {
                // This happens if the endpoint doesn't exist yet
                // We'll use a workaround to get the data
                return this._toggleReaction(commentId, null, true);
            }
            return response.json();
        });
    },
    
    /**
     * Set up event listeners for reactions
     */
    _setupEventListeners() {
        // CRITICAL: Add a page load event listener to ensure panels are hidden
        window.addEventListener('load', () => {
            this._forceHideAllPanels();
        });
        
        // Event delegation for all reaction-related interactions
        document.addEventListener('click', (e) => {
            // Special handling for reaction count clicks
            const isCountElement = e.target.classList.contains('reaction-count');
            const isCountParent = e.target.closest('.reaction-count');
            
            if (isCountElement || isCountParent) {
                const countElement = isCountElement ? e.target : isCountParent;
                const button = countElement.closest('.reaction-btn');
                
                if (button) {
                    // Always allow viewing reaction users, even in read-only mode
                    e.preventDefault();
                    e.stopPropagation();
                    this._toggleReactionUsers(button);
                    return;
                }
            }
            
            // Check if we're in read-only mode
            const isInactive = !this.isBookActive;
            
            // Handle clicking existing reaction buttons
            if (e.target.classList.contains('reaction-btn') || e.target.closest('.reaction-btn')) {
                const button = e.target.classList.contains('reaction-btn') ? 
                            e.target : e.target.closest('.reaction-btn');
                
                // Skip reaction toggling if the book is inactive
                if (isInactive) return;
                
                const commentId = button.dataset.commentId;
                const reaction = button.dataset.reaction;
                
                if (commentId && reaction) {
                    this._toggleReaction(commentId, reaction);
                }
            }
            
            // Handle clicking reaction options from the panel
            if (e.target.classList.contains('reaction-option') && !isInactive) {
                const button = e.target;
                const commentId = button.dataset.commentId;
                const reaction = button.dataset.reaction;
                
                if (commentId && reaction) {
                    this._toggleReaction(commentId, reaction);
                    
                    // Hide the reaction panel after selection
                    const panel = button.closest('.reaction-panel');
                    if (panel) {
                        panel.style.cssText = 'display: none !important';
                    }
                    
                    // Also hide any backdrops
                    document.querySelectorAll('.mobile-backdrop').forEach(backdrop => {
                        backdrop.style.cssText = 'display: none !important';
                    });
                }
            }
            
            // Handle the "Add Reaction" button click (only if book is active)
            if ((e.target.classList.contains('add-reaction-btn') || e.target.closest('.add-reaction-btn')) && !isInactive) {
                e.preventDefault(); // Prevent default action
                e.stopPropagation(); // Stop event bubbling
                
                const button = e.target.classList.contains('add-reaction-btn') ? 
                            e.target : e.target.closest('.add-reaction-btn');
                
                const panel = button.nextElementSibling;
                if (panel && panel.classList.contains('reaction-panel')) {
                    // First close all other open panels
                    document.querySelectorAll('.reaction-panel, .reaction-users-panel').forEach(p => {
                        if (p !== panel) {
                            p.style.cssText = 'display: none !important';
                        }
                    });
                    
                    // Toggle the panel visibility
                    const computedStyle = window.getComputedStyle(panel);
                    const isVisible = computedStyle.display !== 'none';
                    
                    // Show or hide this panel
                    panel.style.display = isVisible ? 'none' : 'flex';
                    
                    // Handle the mobile backdrop
                    if (window.innerWidth < 768) {
                        const allBackdrops = document.querySelectorAll('.mobile-backdrop');
                        
                        // Remove existing backdrops
                        allBackdrops.forEach(b => b.remove());
                        
                        if (!isVisible) {
                            // Create new backdrop
                            const backdrop = document.createElement('div');
                            backdrop.className = 'mobile-backdrop';
                            backdrop.dataset.forPanel = panel.id = `reaction-panel-${Date.now()}`;
                            document.body.appendChild(backdrop);
                            
                            // Show backdrop
                            setTimeout(() => {
                                backdrop.style.display = 'block';
                            }, 0);
                            
                            // Add click handler to backdrop
                            backdrop.addEventListener('click', () => {
                                panel.style.cssText = 'display: none !important';
                                backdrop.style.cssText = 'display: none !important';
                            });
                        }
                    }
                }
            }
            
            // Handle clicking outside to close panels
            if (!e.target.classList.contains('add-reaction-btn') && 
                !e.target.closest('.add-reaction-btn') &&
                !e.target.classList.contains('reaction-option') && 
                !e.target.closest('.reaction-panel') && 
                !e.target.classList.contains('reaction-count') &&
                !e.target.closest('.reaction-count') &&
                !e.target.classList.contains('reaction-users-panel') &&
                !e.target.closest('.reaction-users-panel') &&
                !e.target.classList.contains('reaction-user-item') &&
                !e.target.closest('.reaction-user-item')) {
                
                document.querySelectorAll('.reaction-panel, .reaction-users-panel').forEach(panel => {
                    panel.style.cssText = 'display: none !important';
                });
                
                document.querySelectorAll('.mobile-backdrop').forEach(backdrop => {
                    backdrop.style.cssText = 'display: none !important';
                });
            }
            
            // Handle close button in users panel
            if (e.target.classList.contains('close-users-panel')) {
                const panel = e.target.closest('.reaction-users-panel');
                if (panel) {
                    panel.style.cssText = 'display: none !important';
                    
                    // Also hide the backdrop if it exists
                    if (panel.id) {
                        const backdrop = document.querySelector(`.mobile-backdrop[data-for-panel="${panel.id}"]`);
                        if (backdrop) {
                            backdrop.style.cssText = 'display: none !important';
                        } else {
                            // Hide all backdrops as a fallback
                            document.querySelectorAll('.mobile-backdrop').forEach(backdrop => {
                                backdrop.style.cssText = 'display: none !important';
                            });
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Toggle showing reaction users
     * @param {HTMLElement} button - The reaction button element
     */
    _toggleReactionUsers(button) {
        // If the button doesn't have user data yet, try to fetch it first
        if (!button.dataset.reactionUsers) {
            const commentId = button.dataset.commentId;
            const reaction = button.dataset.reaction;
            
            if (!commentId || !reaction) {
                return;
            }
            
            // Make a read-only API call to get users for this reaction
            this._fetchReactionUsers(commentId)
                .then(data => {
                    if (data && data.success && data.reactions && data.reactions[reaction]) {
                        const info = data.reactions[reaction];
                        if (info.users && info.users.length) {
                            const usernames = info.users.join(', ');
                            button.dataset.reactionUsers = usernames;
                            
                            // Now that we have the data, show the panel
                            this._createAndShowUsersPanel(button);
                        }
                    }
                })
                .catch(error => {
                    console.error('Error fetching reaction users:', error);
                });
            
            return;
        }
        
        this._createAndShowUsersPanel(button);
    },
    
    /**
     * Create and show the users panel for a reaction button
     * @param {HTMLElement} button - The reaction button element
     */
    _createAndShowUsersPanel(button) {
        // Remove any existing panels first to avoid duplicates
        document.querySelectorAll('.reaction-users-panel').forEach(panel => {
            panel.remove();
        });
        
        document.querySelectorAll('.mobile-backdrop').forEach(backdrop => {
            backdrop.remove();
        });
        
        // Create a fresh panel
        // Get users from data attribute
        const users = button.dataset.reactionUsers;
        const reaction = button.dataset.reaction;
        
        if (!users) {
            return;
        }
        
        // Create panel
        const usersPanel = document.createElement('div');
        usersPanel.className = 'reaction-users-panel';
        usersPanel.style.cssText = 'display: none !important';
        
        // Create header with reaction info
        const header = document.createElement('div');
        header.className = 'reaction-users-header';
        header.innerHTML = `
            <span>${reaction} reactions</span>
            <button class="close-users-panel" aria-label="Close">&times;</button>
        `;
        
        // Create user list as a horizontal wrapping list with pill badges
        const userList = document.createElement('div');
        userList.className = 'reaction-users-list';
        
        // Add users as pill badges
        const userArray = users.split(', ');
        userArray.forEach(username => {
            const userItem = document.createElement('span');
            userItem.className = 'reaction-user-item';
            userItem.textContent = username;
            userList.appendChild(userItem);
        });
        
        // Assemble panel
        usersPanel.appendChild(header);
        usersPanel.appendChild(userList);
        
        // Check if we're on mobile
        const isMobile = window.innerWidth < 768;
        
        if (isMobile) {
            // For mobile, we append to body for the bottom sheet
            document.body.appendChild(usersPanel);
            
            // Create backdrop for mobile
            const backdrop = document.createElement('div');
            backdrop.className = 'mobile-backdrop';
            backdrop.dataset.forPanel = usersPanel.id = `reaction-users-panel-${Date.now()}`;
            
            // Close panel when backdrop is clicked
            backdrop.addEventListener('click', () => {
                usersPanel.style.cssText = 'display: none !important';
                backdrop.style.cssText = 'display: none !important';
            });
            
            document.body.appendChild(backdrop);
            
            // Show panel and backdrop
            backdrop.style.display = 'block';
            usersPanel.style.display = 'flex';
        } else {
            // For desktop, we insert inside the existing-reactions div
            const reactionsContainer = button.closest('.existing-reactions');
            if (reactionsContainer) {
                reactionsContainer.appendChild(usersPanel);
            } else {
                // Fallback to inserting after the button
                const parentElement = button.parentNode;
                if (parentElement) {
                    parentElement.insertBefore(usersPanel, button.nextSibling);
                } else {
                    // Last resort - append to the comment card
                    const commentCard = button.closest('.comment-card');
                    if (commentCard) {
                        commentCard.appendChild(usersPanel);
                    } else {
                        // Final fallback - just append to body
                        document.body.appendChild(usersPanel);
                    }
                }
            }
            
            // Show panel
            usersPanel.style.display = 'flex';
        }
        
        // Set up the close button
        const closeButton = usersPanel.querySelector('.close-users-panel');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                usersPanel.style.cssText = 'display: none !important';
                const backdrop = document.querySelector(`.mobile-backdrop[data-for-panel="${usersPanel.id}"]`);
                if (backdrop) {
                    backdrop.style.cssText = 'display: none !important';
                }
            });
        }
        
        // Add animation class to enhance appearance
        usersPanel.classList.add('fadeIn');
    },
    
    /**
     * Toggle a reaction on a comment
     * @param {string} commentId - Comment ID
     * @param {string} reaction - Reaction type (null for read-only)
     * @param {boolean} readOnly - If true, only fetch data without toggling
     * @returns {Promise} - Promise resolving to reaction data
     */
    _toggleReaction(commentId, reaction, readOnly = false) {
        // Skip if book is inactive and not in read-only mode
        if (!this.isBookActive && !readOnly) {
            return Promise.reject(new Error('Book is inactive'));
        }
        
        const endpoint = `/comments/${commentId}/reaction/`;
        const method = readOnly ? 'GET' : 'POST';
        const body = reaction && !readOnly ? JSON.stringify({ reaction }) : undefined;
        
        return fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': DomHelpers.getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: body
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            // Handle HTTP errors like 403 (inactive book)
            if (response.status === 403) {
                const error = new Error('Book is inactive or you do not have permission');
                error.status = response.status;
                throw error;
            }
            throw new Error(`Request failed with status ${response.status}`);
        })
        .then(data => {
            if (data.success && !readOnly) {
                // Update UI only if not in read-only mode
                this._updateReactionsUI(commentId, data);
            }
            return data;
        })
        .catch(error => {
            console.error(`Error toggling reaction:`, error);
            
            // If we get a 403, show a user-friendly message
            if (error.status === 403) {
                // Add a temporary message to the page
                this._showTemporaryMessage('Comments are in read-only mode for inactive books');
            }
            throw error;
        });
    },
    
    /**
     * Show a temporary message to the user
     * @param {string} message - The message to display
     */
    _showTemporaryMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'alert alert-info alert-dismissible fade show temporary-message';
        messageElement.role = 'alert';
        messageElement.innerHTML = `
            <i class="bi bi-info-circle-fill me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Add styles
        messageElement.style.position = 'fixed';
        messageElement.style.bottom = '20px';
        messageElement.style.right = '20px';
        messageElement.style.maxWidth = '300px';
        messageElement.style.zIndex = '9999';
        
        document.body.appendChild(messageElement);
        
        // Remove after 5 seconds
        setTimeout(() => {
            messageElement.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(messageElement);
            }, 300);
        }, 5000);
    },
    
    /**
     * Update reactions UI
     * @param {string} commentId - Comment ID
     * @param {object} data - Response data from API
     */
    _updateReactionsUI(commentId, data) {
        const reactionsContainer = document.querySelector(`[data-comment-id="${commentId}"] .existing-reactions`);
        if (!reactionsContainer) {
            return;
        }
        
        // Remove any open users panels
        const openPanels = reactionsContainer.querySelectorAll('.reaction-users-panel');
        openPanels.forEach(panel => panel.remove());
        
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
                
                // Set user data for the panel
                if (info.users && info.users.length) {
                    const usernames = info.users.join(', ');
                    button.dataset.reactionUsers = usernames;
                    button.setAttribute('aria-label', `${reaction} reaction - click count to see who reacted`);
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
    }
};