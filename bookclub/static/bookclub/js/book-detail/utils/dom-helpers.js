// dom-helpers.js - DOM utility functions

export const DomHelpers = {
    /**
     * Get CSRF token from the page
     * @returns {string} - CSRF token value
     */
    getCsrfToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    },
    
    /**
     * Create an element with optional attributes and children
     * @param {string} tag - Element tag name
     * @param {object} attributes - Element attributes
     * @param {Array|Node|string} children - Child elements or text content
     * @returns {HTMLElement} - Created element
     */
    createElement(tag, attributes = {}, children = null) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key === 'style') {
                Object.entries(value).forEach(([styleKey, styleValue]) => {
                    element.style[styleKey] = styleValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Add children
        if (children) {
            if (Array.isArray(children)) {
                children.forEach(child => {
                    if (child instanceof Node) {
                        element.appendChild(child);
                    } else {
                        element.appendChild(document.createTextNode(String(child)));
                    }
                });
            } else if (children instanceof Node) {
                element.appendChild(children);
            } else {
                element.textContent = String(children);
            }
        }
        
        return element;
    },
    
    /**
     * Create a temporary message that disappears after a timeout
     * @param {HTMLElement} container - Container element
     * @param {string} message - Message text
     * @param {string} type - Message type (success, error, info)
     * @param {number} timeout - Timeout in milliseconds
     */
    showTemporaryMessage(container, message, type = 'success', timeout = 3000) {
        const classes = {
            success: 'text-success',
            error: 'text-danger',
            info: 'text-info'
        };
        
        const messageElement = this.createElement('div', {
            className: `mt-1 ${classes[type] || classes.info}`
        }, `<small>${message}</small>`);
        
        container.appendChild(messageElement);
        
        setTimeout(() => {
            messageElement.remove();
        }, timeout);
    },
    
    /**
     * Update a progress bar element
     * @param {HTMLElement} progressBar - Progress bar element
     * @param {number} percentage - Progress percentage
     */
    updateProgressBar(progressBar, percentage) {
        if (!progressBar) {
            console.error('No progress bar element provided');
            return;
        }
        
        // Ensure we have a number and normalize it between 0-100
        const normalizedPercentage = Math.min(Math.max(0, parseFloat(percentage) || 0), 100);
        
        console.log('DomHelpers: Updating progress bar to', normalizedPercentage); // Debug log
        
        // Update all properties directly
        progressBar.style.width = `${normalizedPercentage}%`;
        progressBar.textContent = `${normalizedPercentage.toFixed(1)}%`;
        progressBar.setAttribute('aria-valuenow', normalizedPercentage);
        
        // Ensure aria attributes are set correctly
        if (!progressBar.hasAttribute('aria-valuemin')) {
            progressBar.setAttribute('aria-valuemin', 0);
        }
        
        if (!progressBar.hasAttribute('aria-valuemax')) {
            progressBar.setAttribute('aria-valuemax', 100);
        }
    }
};