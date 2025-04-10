// Pull to Refresh Functionality
export function setupPullToRefresh() {
  // Skip setup if not on a touch device
  if (!('ontouchstart' in window)) {
      return;
  }
  
  // Check if indicator already exists to prevent duplicate creation
  if (document.getElementById('pull-refresh-indicator')) {
      return;
  }
      
  // Create and add the pull-to-refresh indicator
  const refreshIndicator = document.createElement('div');
  refreshIndicator.id = 'pull-refresh-indicator';
  refreshIndicator.className = 'pull-refresh-indicator';
  refreshIndicator.innerHTML = '<i class="bi bi-book book-flip-icon"></i>';
  document.body.appendChild(refreshIndicator);
  
  // Variables to track touch
  let startY = 0;
  let currentY = 0;
  let refreshing = false;
  let maxPullDistance = 150;
  let thresholdDistance = 100;
  
  // Touch start event
  const touchStartHandler = function(e) {
      // Only enable pull-to-refresh when at top of page with small tolerance for iOS
      if (window.scrollY <= 5) {
          startY = e.touches[0].pageY;
      } else {
          startY = 0;
      }
  };
  
  // Touch move event
  const touchMoveHandler = function(e) {
      // Only process if start was at top of page
      if (startY === 0 || refreshing) return;
      
      currentY = e.touches[0].pageY;
      let pullDistance = currentY - startY;
      
      // Only show indicator if pulling down
      if (pullDistance > 0) {
          
          // Calculate progress percentage (0 to 1)
          let progress = Math.min(pullDistance / maxPullDistance, 1);
          
          // Try to prevent default page scrolling behavior when pulling down
          // Note: This doesn't always work on all browsers/devices
          if (pullDistance > 30 && window.scrollY <= 0) {
              e.preventDefault();
          }
          
          // Update indicator
          refreshIndicator.style.transition = 'none'; // Turn off animation for direct control
          refreshIndicator.style.transform = `translateX(-50%) translateY(${(pullDistance * 0.5) - 70}px)`;
          refreshIndicator.style.opacity = progress;
          
          // Add rotation based on progress - animate the book icon
          const rotation = progress * 180;
          const bookIcon = refreshIndicator.querySelector('.book-flip-icon');
          if (bookIcon) {
              bookIcon.style.transform = `rotateY(${rotation}deg)`;
          }
          
          // Change text based on threshold
          if (pullDistance > thresholdDistance) {
              refreshIndicator.classList.add('release-ready');
          } else {
              refreshIndicator.classList.remove('release-ready');
          }
      }
  };
  
  // Touch end event
  const touchEndHandler = function() {
      // Only process if we were tracking a touch
      if (startY === 0 || refreshing) {
          startY = 0;
          return;
      }
      
      const pullDistance = currentY - startY;
      
      // Reset indicator position and opacity with animation
      refreshIndicator.style.transition = 'transform 0.3s, opacity 0.3s';
      
      // If pulled enough, trigger refresh
      if (pullDistance > thresholdDistance) {
          refreshing = true;
          
          // Show loading state
          refreshIndicator.classList.add('refreshing');
          refreshIndicator.style.transform = 'translateX(-50%) translateY(20px)';
          refreshIndicator.style.opacity = '1';
          
          // Clear service worker caches if available
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              // Clear caches to ensure fresh content
              caches.keys().then(function(cacheNames) {
                  const clearPromises = cacheNames.map(function(cacheName) {
                      return caches.delete(cacheName);
                  });
                  
                  // After clearing caches, reload the page
                  Promise.all(clearPromises).then(function() {
                      window.location.reload();
                  });
              }).catch(function() {
                  // If cache clearing fails, just reload
                  window.location.reload();
              });
          } else {
              // No service worker, just reload the page
              setTimeout(() => {
                  window.location.reload();
              }, 800);
          }
      } else {
          // Reset to hidden state if not pulled enough
          refreshIndicator.style.transform = 'translateX(-50%) translateY(-70px)';
          refreshIndicator.style.opacity = '0';
      }
      
      // Reset tracking variables
      startY = 0;
      currentY = 0;
  };
  
  // Add event listeners
  document.addEventListener('touchstart', touchStartHandler, { passive: true });
  document.addEventListener('touchmove', touchMoveHandler, { passive: false });
  document.addEventListener('touchend', touchEndHandler, { passive: true });
}