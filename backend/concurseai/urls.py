"""URLs raiz do ConcurseAI."""
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Auth JWT
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Apps
    path("api/users/", include("concurseai.apps.users.urls")),
    path("api/concursos/", include("concurseai.apps.concursos.urls")),
    path("api/trilhas/", include("concurseai.apps.trilhas.urls")),
    path("api/llm/", include("concurseai.apps.llm.urls")),
    # TODO FASE 2: path("api/llm/explicar/", ...) — chat streaming SSE
]
