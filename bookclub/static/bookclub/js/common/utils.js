// Utility Functions
export function getCsrfToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    
    return cookieValue;
}

export function copyInviteLink(link) {
    navigator.clipboard.writeText(link).then(function() {
        alert('Invitation link copied to clipboard!');
    }, function() {
        alert('Failed to copy invitation link.');
    });
}