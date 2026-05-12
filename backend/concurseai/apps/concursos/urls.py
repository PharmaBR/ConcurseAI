from django.urls import path

from .views import ConcursoDetailView, ConcursoListCreateView, ConcursoSalvoDeleteView, ConcursoSalvoListView

urlpatterns = [
    path("", ConcursoListCreateView.as_view(), name="concurso-list"),
    path("<uuid:pk>/", ConcursoDetailView.as_view(), name="concurso-detail"),
    path("salvos/", ConcursoSalvoListView.as_view(), name="concurso-salvo-list"),
    path("salvos/<int:pk>/", ConcursoSalvoDeleteView.as_view(), name="concurso-salvo-delete"),
]
