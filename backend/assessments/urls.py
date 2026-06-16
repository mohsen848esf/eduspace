from django.urls import path, include
from rest_framework.routers import DefaultRouter
from assessments.views import (
    QuestionBankViewSet,
    QuestionViewSet,
    AssessmentViewSet,
    SubmissionViewSet,
    StudentAnswerViewSet,
    AssignmentViewSet,
    AssignmentSubmissionViewSet,
)

app_name = 'assessments'

router = DefaultRouter()
router.register(r'question-banks', QuestionBankViewSet, basename='questionbank')
router.register(r'questions', QuestionViewSet, basename='question')
router.register(r'assessments', AssessmentViewSet, basename='assessment')
router.register(r'submissions', SubmissionViewSet, basename='submission')
router.register(r'answers', StudentAnswerViewSet, basename='studentanswer')
router.register(r'assignments', AssignmentViewSet, basename='assignment')
router.register(r'assignment-submissions', AssignmentSubmissionViewSet, basename='assignmentsubmission')

urlpatterns = [
    path('', include(router.urls)),
]
