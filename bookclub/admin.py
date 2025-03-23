# bookclub/admin.py
from django.contrib import admin
from .models import Group, Book, Comment

admin.site.register(Group)
admin.site.register(Book)
admin.site.register(Comment)
