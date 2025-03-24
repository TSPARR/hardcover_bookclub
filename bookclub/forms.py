from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.forms import (
    EmailInput,
    ModelForm,
    PasswordInput,
    Select,
    Textarea,
    TextInput,
)

from .models import BookGroup, Comment, UserProfile


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ["text", "progress_type", "progress_value"]
        widgets = {
            "text": forms.Textarea(attrs={"class": "form-control", "rows": 4}),
            "progress_type": forms.HiddenInput(),
            "progress_value": forms.HiddenInput(),
        }


class BookSearchForm(forms.Form):
    query = forms.CharField(label="Search for books", max_length=100)


class UserRegistrationForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "username",
            "email",
            "password1",
            "password2",
        ]


class UserRegistrationForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "username",
            "email",
            "password1",
            "password2",
        ]
        widgets = {
            "first_name": TextInput(attrs={"class": "form-control"}),
            "last_name": TextInput(attrs={"class": "form-control"}),
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


class ApiKeyForm(forms.ModelForm):
    hardcover_api_key = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 3, "cols": 40}),
        required=False,
        help_text="Paste your Hardcover API bearer token here. It will be stored securely.",
    )

    class Meta:
        model = UserProfile
        fields = ["hardcover_api_key"]


class GroupForm(forms.ModelForm):
    class Meta:
        model = BookGroup
        fields = ["name", "description", "is_public"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control"}),
            "description": forms.Textarea(attrs={"class": "form-control", "rows": 4}),
            "is_public": forms.CheckboxInput(attrs={"class": "form-check-input"}),
        }
