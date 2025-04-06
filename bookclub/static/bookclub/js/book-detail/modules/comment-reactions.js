// comment-reactions.js - Handles comment reactions
import { DomHelpers } from '../utils/dom-helpers.js';

export const CommentReactions = {
    /**
     * Initialize comment reactions
     * @returns {object} - CommentReactions instance
     */
    init() {
        this._setupEventListeners();
        this._initializeReactionButtons();
        return this;
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
                                }
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error('Error fetching reaction users:', error);
                });
        });
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
        // Event delegation for all reaction-related interactions
        document.addEventListener('click', (e) => {
            // Handle clicking existing reaction buttons
            if (e.target.classList.contains('reaction-btn') || e.target.closest('.reaction-btn')) {
                const button = e.target.classList.contains('reaction-btn') ? 
                              e.target : e.target.closest('.reaction-btn');
                
                // Check if we're showing users or toggling the reaction
                const isCountClick = e.target.classList.contains('reaction-count') || 
                                   e.target.closest('.reaction-count');
                                   
                if (isCountClick) {
                    // Toggle showing reaction users
                    this._toggleReactionUsers(button);
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
                        document.querySelectorAll('.reaction-panel, .reaction-users-panel').forEach(p => {
                            if (p !== panel && p.style.display === 'flex') {
                                p.style.display = 'none';
                            }
                        });
                    }
                }
            }
            
            // Handle clicking outside to close panels
            if (!e.target.classList.contains('add-reaction-btn') && 
                !e.target.closest('.add-reaction-btn') &&
                !e.target.classList.contains('reaction-option') && 
                !e.target.closest('.reaction-panel') && 
                !e.target.classList.contains('reaction-count') &&
                !e.target.closest('.reaction-users-panel')) {
                
                document.querySelectorAll('.reaction-panel, .reaction-users-panel').forEach(panel => {
                    panel.style.display = 'none';
                });
            }
            
            // Handle close button in users panel
            if (e.target.classList.contains('close-users-panel')) {
                const panel = e.target.closest('.reaction-users-panel');
                if (panel) {
                    panel.style.display = 'none';
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
            
            if (!commentId || !reaction) return;
            
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
        // Find or create the users panel
        let usersPanel = button.nextElementSibling;
        if (!usersPanel || !usersPanel.classList.contains('reaction-users-panel')) {
            // Get users from data attribute
            const users = button.dataset.reactionUsers;
            const reaction = button.dataset.reaction;
            
            if (!users) return;
            
            // Create panel if it doesn't exist
            usersPanel = document.createElement('div');
            usersPanel.className = 'reaction-users-panel';
            usersPanel.style.display = 'none';
            
            // Create header with reaction info
            const header = document.createElement('div');
            header.className = 'reaction-users-header';
            header.innerHTML = `
                <span>${reaction} reactions</span>
                <button class="close-users-panel" aria-label="Close">&times;</button>
            `;
            
            // Create user list
            const userList = document.createElement('div');
            userList.className = 'reaction-users-list';
            
            // Add users
            const userArray = users.split(', ');
            userArray.forEach(username => {
                const userItem = document.createElement('div');
                userItem.className = 'reaction-user-item';
                userItem.textContent = username;
                userList.appendChild(userItem);
            });
            
            // Assemble panel
            usersPanel.appendChild(header);
            usersPanel.appendChild(userList);
            
            // Insert after the button
            button.parentNode.insertBefore(usersPanel, button.nextSibling);
        }
        
        // Toggle visibility
        const isVisible = usersPanel.style.display === 'flex';
        
        // Hide all other panels first
        document.querySelectorAll('.reaction-panel, .reaction-users-panel').forEach(panel => {
            if (panel !== usersPanel) {
                panel.style.display = 'none';
            }
        });
        
        // Toggle this panel
        usersPanel.style.display = isVisible ? 'none' : 'flex';
    },
    
    /**
     * Toggle a reaction on a comment
     * @param {string} commentId - Comment ID
     * @param {string} reaction - Reaction type (null for read-only)
     * @param {boolean} readOnly - If true, only fetch data without toggling
     * @returns {Promise} - Promise resolving to reaction data
     */
    _toggleReaction(commentId, reaction, readOnly = false) {
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
        .then(response => response.json())
        .then(data => {
            if (data.success && !readOnly) {
                // Update UI only if not in read-only mode
                this._updateReactionsUI(commentId, data);
            }
            return data;
        })
        .catch(error => {
            console.error('Error toggling reaction:', error);
            throw error;
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