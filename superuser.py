import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hardcover_bookclub.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
username = os.getenv('DJANGO_ADMIN_USERNAME', 'admin')
email = os.getenv('DJANGO_ADMIN_EMAIL', 'admin@example.com')
password = os.getenv('DJANGO_ADMIN_PASSWORD', 'adminpassword')
if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, email, password)
    print(f'Superuser {username} created')
else:
    print(f'Superuser {username} already exists')