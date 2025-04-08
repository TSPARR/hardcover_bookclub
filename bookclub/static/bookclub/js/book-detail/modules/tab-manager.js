// tab-manager.js - Module for managing tab selection and persistence
export const TabManager = {
    init() {
      // Update URL when tabs change (without page reload)
      const tabLinks = document.querySelectorAll('.nav-tabs .nav-link');
      tabLinks.forEach(tab => {
        tab.addEventListener('shown.bs.tab', (event) => {
          const tabId = event.target.id.replace('-tab', '');
          const url = new URL(window.location.href);
          
          // Just update the tab parameter, preserve everything else
          url.searchParams.set('tab', tabId);
          window.history.pushState({}, '', url.toString());
        });
      });
      
      // Activate the correct tab based on URL on page load
      const url = new URL(window.location.href);
      const tabParam = url.searchParams.get('tab');
      if (tabParam) {
        const tabEl = document.getElementById(`${tabParam}-tab`);
        if (tabEl) {
          const tab = new bootstrap.Tab(tabEl);
          tab.show();
        }
      }
    }
  };