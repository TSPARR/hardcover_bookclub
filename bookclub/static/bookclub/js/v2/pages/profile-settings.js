function initializePage() {
    initPasswordForm();
    initHomePageSettings();
    initApiSettings();
    initNotificationSettings();
    initDeveloperOptions();

    const pushEnabled = document.querySelector('.notification-settings-card');
    if (pushEnabled) {
        initNotificationToggle();
    }
}

function initPasswordForm() {
    const toggleButton = document.getElementById('toggle-password-form');
    const cancelButton = document.getElementById('cancel-password-change');
    const formContainer = document.getElementById('password-form-container');

    if (toggleButton && formContainer) {
        toggleButton.addEventListener('click', function() {
            formContainer.classList.remove('hidden');
            toggleButton.classList.add('hidden');
        });
    }

    if (cancelButton && formContainer && toggleButton) {
        cancelButton.addEventListener('click', function() {
            formContainer.classList.add('hidden');
            toggleButton.classList.remove('hidden');

            const form = formContainer.querySelector('form');
            if (form) {
                const passwordFields = form.querySelectorAll('input[type="password"]');
                passwordFields.forEach(field => field.value = '');
            }
        });
    }
}

function initHomePageSettings() {
    const preferenceRadios = document.querySelectorAll('input[name="preference_type"]');
    const groupSelectContainer = document.getElementById('group-select-container');
    const homePageForm = document.querySelector('.home-page-form');

    if (!groupSelectContainer) return;

    function toggleGroupSelect() {
        const selectedValue = document.querySelector('input[name="preference_type"]:checked')?.value;
        if (selectedValue === 'default') {
            groupSelectContainer.classList.add('hidden');
        } else {
            groupSelectContainer.classList.remove('hidden');
        }
    }

    preferenceRadios.forEach(radio => {
        radio.addEventListener('change', toggleGroupSelect);
    });

    toggleGroupSelect();

    if (homePageForm) {
        homePageForm.addEventListener('submit', function(e) {
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                const originalText = submitButton.innerHTML;
                submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

                setTimeout(() => {
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalText;
                }, 3000);
            }
        });
    }
}

function initApiSettings() {
    const apiForm = document.querySelector('.api-form');

    if (apiForm) {
        apiForm.addEventListener('submit', function(e) {
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                const originalText = submitButton.innerHTML;
                submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

                setTimeout(() => {
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalText;
                }, 3000);
            }
        });
    }
}

function initNotificationSettings() {
    const notificationForm = document.querySelector('.notification-form');

    if (notificationForm) {
        notificationForm.addEventListener('submit', function(e) {
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                const originalText = submitButton.innerHTML;
                submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

                setTimeout(() => {
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalText;
                }, 3000);
            }
        });
    }
}

function initDeveloperOptions() {
    const header = document.getElementById('developer-options-header');
    const content = document.getElementById('developer-options-content');
    const icon = header?.querySelector('.collapse-icon');

    if (header && content && icon) {
        header.addEventListener('click', function() {
            const isExpanded = content.classList.contains('expanded');

            if (isExpanded) {
                content.classList.remove('expanded');
                icon.classList.remove('rotated');
            } else {
                content.classList.add('expanded');
                icon.classList.add('rotated');
            }
        });
    }
}

function initNotificationToggle() {
    const notificationCheckbox = document.getElementById('id_enable_notifications');
    const notificationOptions = document.getElementById('notification-options');
    const testContainer = document.getElementById('notification-test-container');

    if (notificationCheckbox && notificationOptions && testContainer) {
        function toggleNotificationOptions(enabled) {
            if (enabled) {
                notificationOptions.classList.remove('notification-options-hidden');
                notificationOptions.setAttribute('aria-hidden', 'false');
                testContainer.classList.remove('notification-options-hidden');
                updateNotificationStatusBadge(true);
            } else {
                notificationOptions.classList.add('notification-options-hidden');
                notificationOptions.setAttribute('aria-hidden', 'true');
                testContainer.classList.add('notification-options-hidden');
                updateNotificationStatusBadge(false);

                document.querySelectorAll('#notification-options input[type="checkbox"]').forEach(checkbox => {
                    checkbox.checked = false;
                });
            }
        }

        toggleNotificationOptions(notificationCheckbox.checked);

        notificationCheckbox.addEventListener('change', function() {
            toggleNotificationOptions(this.checked);
        });
    }
}

function updateNotificationStatusBadge(enabled) {
    const badge = document.getElementById('notification-status-badge');
    if (badge) {
        if (enabled) {
            badge.className = 'notification-status-badge badge-enabled';
            badge.innerHTML = '<i class="bi bi-bell-fill"></i>Enabled';
        } else {
            badge.className = 'notification-status-badge badge-disabled';
            badge.innerHTML = '<i class="bi bi-bell-slash"></i>Disabled';
        }
    }
}

function clearBrowserCache() {
    console.log('Attempting to clear browser cache...');

    const timestamp = new Date().getTime();

    const button = document.querySelector('button.btn-warning');
    if (button) {
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Clearing...';

        setTimeout(() => {
            window.location.reload(true);
        }, 1000);
    }

    console.log('Cache clearing initiated');
}

window.clearBrowserCache = clearBrowserCache;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

try {
    if (typeof module !== 'undefined' && module.exports) {
        import('./../../common/utils.js').then(({ getCsrfToken }) => {
            import('./../../common/push-notifications.js').then(pushModule => {
                const {
                    arePushNotificationsSupported,
                    checkPushNotificationsAvailable,
                    getCurrentPushSubscription,
                    subscribeToPushNotifications,
                    unsubscribeFromPushNotifications
                } = pushModule;

                import('./../../common/toast.js').then(toastModule => {
                    const { showSuccessToast, showErrorToast, showInfoToast } = toastModule;

                    async function initPushNotificationUI() {
                        const notificationCheckbox = document.getElementById('id_enable_notifications');
                        const testContainer = document.getElementById('notification-test-container');
                        const testButton = document.getElementById('test-notification-button');

                        if (!notificationCheckbox || !testContainer || !testButton) {
                            return;
                        }

                        if (!arePushNotificationsSupported()) {
                            console.log('Browser does not support push notifications');
                            notificationCheckbox.disabled = true;
                            notificationCheckbox.checked = false;
                            notificationCheckbox.closest('.form-check').style.display = 'none';
                            testContainer.style.display = 'none';

                            const notificationOptions = document.getElementById('notification-options');
                            if (notificationOptions) {
                                notificationOptions.style.display = 'none';
                            }
                            return;
                        }

                        const pushAvailable = await checkPushNotificationsAvailable();
                        if (!pushAvailable) {
                            console.log('Push notifications not available on server');
                            notificationCheckbox.closest('.form-check').style.display = 'none';
                            testContainer.style.display = 'none';

                            const notificationOptions = document.getElementById('notification-options');
                            if (notificationOptions) {
                                notificationOptions.style.display = 'none';
                            }
                            return;
                        }

                        const subscription = await getCurrentPushSubscription();
                        notificationCheckbox.checked = !!subscription;

                        const newNotificationCheckbox = notificationCheckbox.cloneNode(true);
                        notificationCheckbox.parentNode.replaceChild(newNotificationCheckbox, notificationCheckbox);

                        const updatedNotificationCheckbox = document.getElementById('id_enable_notifications');

                        updatedNotificationCheckbox.addEventListener('change', async function() {
                            if (this.checked) {
                                const success = await subscribeToPushNotifications();
                                this.checked = !!success;
                            } else {
                                await unsubscribeFromPushNotifications();
                            }

                            const notificationOptions = document.getElementById('notification-options');
                            const testContainer = document.getElementById('notification-test-container');

                            if (this.checked) {
                                notificationOptions?.classList.remove('notification-options-hidden');
                                testContainer?.classList.remove('notification-options-hidden');
                                updateNotificationStatusBadge(true);
                            } else {
                                notificationOptions?.classList.add('notification-options-hidden');
                                testContainer?.classList.add('notification-options-hidden');
                                updateNotificationStatusBadge(false);
                            }
                        });

                        const newTestButton = testButton.cloneNode(true);
                        testButton.parentNode.replaceChild(newTestButton, testButton);

                        const updatedTestButton = document.getElementById('test-notification-button');

                        updatedTestButton.addEventListener('click', async function() {
                            const button = this;
                            const originalText = button.innerHTML;

                            button.disabled = true;
                            button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';

                            try {
                                const response = await fetch('/api/push/test/', {
                                    method: 'POST',
                                    headers: {
                                        'X-CSRFToken': getCsrfToken(),
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({})
                                });

                                const data = await response.json();

                                if (response.ok) {
                                    showSuccessToast('Test Notification Sent', 'Check your device for the notification.');
                                } else {
                                    showErrorToast('Notification Error', data.message || 'Could not send notification');
                                }
                            } catch (error) {
                                console.error('Error sending test notification:', error);
                                showErrorToast('Request Failed', 'Failed to send test notification. Check console for details.');
                            } finally {
                                button.disabled = false;
                                button.innerHTML = originalText;
                            }
                        });

                        console.log('Push notification UI initialized successfully');
                    }

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', initPushNotificationUI);
                    } else {
                        initPushNotificationUI();
                    }
                });
            });
        });
    }
} catch (error) {
    console.log('ES6 modules not available, using basic functionality only');
}
