# Reset for Testing
```
source venv/bin/activate
python manage.py flush
python manage.py createsuperuser
python manage.py set_group_admin $USERNAME
```