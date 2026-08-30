from django.urls import path

from media_library import views


urlpatterns = [
    path('progressive-upload/capability/', views.progressive_upload_capability, name='progressive_upload_capability'),
    path('playback/master.m3u8', views.media_delivery_master, name='media_delivery_master'),
    path('playback/<str:label>/index.m3u8', views.media_delivery_variant, name='media_delivery_variant'),
    path('playback/<str:label>/<str:filename>', views.media_delivery_segment, name='media_delivery_segment'),
    path('assets/', views.assets, name='media_assets'),
    path('assets/<str:public_token>/', views.asset_detail, name='media_asset_detail'),
    path('assets/<str:public_token>/history/', views.asset_history, name='media_asset_history'),
    path('assets/<str:public_token>/uploads/initiate/', views.initiate_media_upload, name='media_upload_initiate'),
    path('assets/<str:public_token>/uploads/<str:upload_token>/', views.media_upload_status, name='media_upload_status'),
    path('assets/<str:public_token>/uploads/<str:upload_token>/parts/', views.sign_media_upload_part, name='media_upload_sign_part'),
    path('assets/<str:public_token>/uploads/<str:upload_token>/complete/', views.complete_media_upload, name='media_upload_complete'),
    path('assets/<str:public_token>/progressive-uploads/initiate/', views.initiate_progressive_upload, name='progressive_upload_initiate'),
    path('assets/<str:public_token>/progressive-uploads/<str:upload_token>/', views.progressive_upload_status, name='progressive_upload_status'),
    path('assets/<str:public_token>/progressive-uploads/<str:upload_token>/chunks/sign/', views.sign_progressive_chunk, name='progressive_chunk_sign'),
    path('assets/<str:public_token>/progressive-uploads/<str:upload_token>/chunks/commit/', views.commit_progressive_chunk, name='progressive_chunk_commit'),
    path('assets/<str:public_token>/progressive-uploads/<str:upload_token>/complete/', views.complete_progressive_upload, name='progressive_upload_complete'),
]
