from django.contrib import admin

from .models import Book, Comment, Group

admin.site.register(Group)
admin.site.register(Book)
admin.site.register(Comment)
