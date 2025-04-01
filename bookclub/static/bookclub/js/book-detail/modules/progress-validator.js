// progress-validator.js - Validation utilities for reading progress
export const ProgressValidator = {
    /**
     * Validate progress based on type and value
     * @param {string} type - Progress type (page, audio, percent)
     * @param {string} value - Progress value to validate
     * @param {object} bookData - Book/edition metadata for range validation
     * @returns {object} - Object with isValid and message properties
     */
    validate(type, value, bookData = {}) {
        if (!value || value.trim() === '') {
            return { isValid: false, message: 'Progress value is required' };
        }
        
        switch (type) {
            case 'percent':
                return this.validatePercentage(value);
            case 'page':
                return this.validatePageNumber(value, bookData);
            case 'audio':
                return this.validateAudioTimestamp(value, bookData);
            default:
                return { isValid: false, message: 'Unknown progress type' };
        }
    },
    
    /**
     * Validate percentage value (0-100, whole number)
     * @param {string} value - Percentage value
     * @returns {object} - Validation result
     */
    validatePercentage(value) {
        // Remove % sign if present
        value = value.replace('%', '').trim();
        
        if (!/^\d+$/.test(value)) {
            return { 
                isValid: false, 
                message: 'Percentage must be a whole number'
            };
        }
        
        const percent = parseInt(value);
        if (percent < 0 || percent > 100) {
            return { 
                isValid: false, 
                message: 'Percentage must be between 0 and 100'
            };
        }
        
        return { isValid: true, value: percent };
    },
    
    /**
     * Validate page number (whole number, not more than max pages)
     * @param {string} value - Page number value
     * @param {object} bookData - Book data with max pages
     * @returns {object} - Validation result
     */
    validatePageNumber(value, bookData = {}) {
        if (!/^\d+$/.test(value.trim())) {
            return { 
                isValid: false, 
                message: 'Page number must be a whole number'
            };
        }
        
        const page = parseInt(value);
        if (page < 1) {
            return { 
                isValid: false, 
                message: 'Page number must be at least 1'
            };
        }
        
        // Check against max pages if available
        const maxPages = this._getMaxPages(bookData);
        if (maxPages && page > maxPages) {
            return { 
                isValid: false, 
                message: `Page number cannot exceed ${maxPages}`
            };
        }
        
        return { isValid: true, value: page };
    },
    
    /**
     * Validate audio timestamp (HH:MM:SS format or HhMm format)
     * @param {string} value - Timestamp value
     * @param {object} bookData - Book data with audio duration
     * @returns {object} - Validation result
     */
    validateAudioTimestamp(value, bookData = {}) {
        // First try to parse the HH:MM:SS format
        const colonFormat = /^(\d+):([0-5]?\d):([0-5]?\d)$/;
        const colonMatch = value.match(colonFormat);
        
        if (colonMatch) {
            const hours = parseInt(colonMatch[1]);
            const minutes = parseInt(colonMatch[2]);
            const seconds = parseInt(colonMatch[3]);
            
            // Check against max duration if available
            const maxSeconds = this._getMaxAudioSeconds(bookData);
            const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
            
            if (maxSeconds && totalSeconds > maxSeconds) {
                const maxHours = Math.floor(maxSeconds / 3600);
                const maxMinutes = Math.floor((maxSeconds % 3600) / 60);
                const maxSecondsRem = maxSeconds % 60;
                
                return { 
                    isValid: false, 
                    message: `Timestamp cannot exceed ${maxHours}:${maxMinutes.toString().padStart(2, '0')}:${maxSecondsRem.toString().padStart(2, '0')}`
                };
            }
            
            return { 
                isValid: true, 
                value: value,
                seconds: totalSeconds
            };
        }
        
        // Try to parse the format "2h 30m"
        const timeFormat = /^(?:(\d+)h\s*)?(?:(\d+)m)?$/;
        const timeMatch = value.match(timeFormat);
        
        if (timeMatch && (timeMatch[1] || timeMatch[2])) {
            const hours = parseInt(timeMatch[1] || 0);
            const minutes = parseInt(timeMatch[2] || 0);
            
            if (minutes >= 60) {
                return { 
                    isValid: false, 
                    message: 'Minutes must be less than 60'
                };
            }
            
            // Check against max duration if available
            const maxSeconds = this._getMaxAudioSeconds(bookData);
            const totalSeconds = (hours * 3600) + (minutes * 60);
            
            if (maxSeconds && totalSeconds > maxSeconds) {
                const maxHours = Math.floor(maxSeconds / 3600);
                const maxMinutes = Math.floor((maxSeconds % 3600) / 60);
                
                return { 
                    isValid: false, 
                    message: `Timestamp cannot exceed ${maxHours}h ${maxMinutes}m`
                };
            }
            
            return { 
                isValid: true, 
                value: `${hours}h ${minutes}m`,
                seconds: totalSeconds
            };
        }
        
        return { 
            isValid: false, 
            message: 'Audio timestamp must be in format "HH:MM:SS" or "Xh Ym"'
        };
    },
    
    /**
     * Get max pages from book data
     * @param {object} bookData - Book/edition data
     * @returns {number|null} - Max pages or null if not available
     */
    _getMaxPages(bookData = {}) {
        // First check user's selected edition
        if (bookData.edition && bookData.edition.pages) {
            return bookData.edition.pages;
        }
        
        // Then check Kavita promoted edition
        const kavitaPages = parseInt(document.querySelector('meta[name="kavita-edition-pages"]')?.content);
        if (kavitaPages) {
            return kavitaPages;
        }
        
        // Fall back to book
        if (bookData.book && bookData.book.pages) {
            return bookData.book.pages;
        } else if (bookData.pages) {
            return bookData.pages;
        }
        return null;
    },
    
    /**
     * Get max audio seconds from book data
     * @param {object} bookData - Book/edition data
     * @returns {number|null} - Max audio seconds or null if not available
     */
    _getMaxAudioSeconds(bookData = {}) {
        // First check user's selected edition
        if (bookData.edition && bookData.edition.audio_seconds) {
            return bookData.edition.audio_seconds;
        }
        
        // Then check Plex promoted edition
        const plexAudioSeconds = parseInt(document.querySelector('meta[name="plex-edition-audio-seconds"]')?.content);
        if (plexAudioSeconds) {
            return plexAudioSeconds;
        }
        
        // Fall back to book
        if (bookData.book && bookData.book.audio_seconds) {
            return bookData.book.audio_seconds;
        } else if (bookData.audio_seconds) {
            return bookData.audio_seconds;
        }
        return null;
    },
    
    /**
     * Format a progress value based on type for display or storage
     * @param {string} type - Progress type
     * @param {string|number} value - Value to format
     * @returns {string} - Formatted value
     */
    formatProgressValue(type, value) {
        if (type === 'percent') {
            // Remove % sign if present and ensure it's a whole number
            const percent = parseInt(value.toString().replace('%', ''));
            return percent.toString();
        } else if (type === 'page') {
            // Ensure it's a whole number
            return parseInt(value).toString();
        } else if (type === 'audio') {
            // Keep as is for now (already validated)
            return value;
        }
        return value.toString();
    }
};