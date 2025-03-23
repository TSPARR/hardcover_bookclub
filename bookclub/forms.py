# bookclub/forms.py
from django import forms
from .models import Comment
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.forms import (
    ModelForm,
    TextInput,
    EmailInput,
    PasswordInput,
    Textarea,
    Select,
)


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ["text", "progress_type", "progress_value"]
        widgets = {
            "text": forms.Textarea(attrs={"rows": 4}),
        }


class BookSearchForm(forms.Form):
    query = forms.CharField(label="Search for books", max_length=100)


class UserRegistrationForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ["username", "email", "password1", "password2"]


class UserRegistrationForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ["username", "email", "password1", "password2"]
        widgets = {
            "username": TextInput(attrs={"class": "form-control"}),
            "email": EmailInput(attrs={"class": "form-control"}),
            "password1": PasswordInput(attrs={"class": "form-control"}),
            "password2": PasswordInput(attrs={"class": "form-control"}),
        }

    def __init__(self, *args, **kwargs):
        super(UserRegistrationForm, self).__init__(*args, **kwargs)
        # Add Bootstrap classes to the auto-generated fields
        for field in self.fields:
            self.fields[field].widget.attrs.update({"class": "form-control"})
