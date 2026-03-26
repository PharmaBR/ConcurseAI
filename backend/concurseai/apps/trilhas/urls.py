from django.urls import path

from .views import TrilhaDetailView, TrilhaListView, avancar_modulo_view

urlpatterns = [
    path("", TrilhaListView.as_view(), name="trilha-list"),
    path("<uuid:pk>/", TrilhaDetailView.as_view(), name="trilha-detail"),
    path("modulos/<int:pk>/avancar/", avancar_modulo_view, name="modulo-avancar"),
]
