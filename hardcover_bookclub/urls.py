from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path

from bookclub.views.auth_views import CustomLoginView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("bookclub.urls")),
    path("accounts/", include("django.contrib.auth.urls")),
    path("accounts/login/", CustomLoginView.as_view(), name="login"),
    path("accounts/logout/", auth_views.LogoutView.as_view(), name="logout"),
]
