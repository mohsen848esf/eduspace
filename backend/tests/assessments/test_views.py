from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Organization, Session, AcademyClass, Course, OrgMember, Role, Permission
from assessments.models import (
    QuestionBank,
    Question,
    Assessment,
    AssessmentQuestion,
    Submission,
    StudentAnswer,
)

User = get_user_model()


class AssessmentViewsIntegrationTest(APITestCase):
    def setUp(self):
        # Create users
        self.teacher = User.objects.create_user(
            username="teacher1",
            email="teacher1@example.com",
            password="password123",
            role="teacher"
        )
        self.student = User.objects.create_user(
            username="student1",
            email="student1@example.com",
            password="password123",
            role="student"
        )
        self.other_student = User.objects.create_user(
            username="student2",
            email="student2@example.com",
            password="password123",
            role="student"
        )

        # Create organizations
        self.org = Organization.objects.create(
            name="Org One",
            slug="org-one",
            owner=self.teacher
        )
        self.other_org = Organization.objects.create(
            name="Org Two",
            slug="org-two",
            owner=self.teacher
        )

        # Retrieve/Assign roles & enroll users as members of the organization
        self.teacher_role = Role.objects.get(name='Teacher')
        self.student_role = Role.objects.get(name='Student')

        OrgMember.objects.create(organization=self.org, user=self.teacher, role=self.teacher_role)
        OrgMember.objects.create(organization=self.org, user=self.student, role=self.student_role)
        OrgMember.objects.create(organization=self.org, user=self.other_student, role=self.student_role)

        # Create course & class
        self.course = Course.objects.create(
            organization=self.org,
            title="Math 101",
            code="MATH-101",
            price="50.00"
        )
        self.academy_class = AcademyClass.objects.create(
            course=self.course,
            name="Section A",
            created_by=self.teacher
        )

        # Create session
        self.session = Session.objects.create(
            academy_class=self.academy_class,
            organization=self.org,
            title="Lesson 1",
            host=self.teacher
        )

        # Create question banks
        self.qbank = QuestionBank.objects.create(
            organization=self.org,
            title="Algebra Bank",
            created_by=self.teacher
        )

        # Create questions
        self.q_single = Question.objects.create(
            question_bank=self.qbank,
            text="What is 1 + 1?",
            question_type=Question.QuestionType.SINGLE_CHOICE,
            options=[{"id": "a", "text": "1"}, {"id": "b", "text": "2"}],
            correct_answer=["b"],
            points=Decimal("5.00")
        )

        # Create assessment
        self.assessment = Assessment.objects.create(
            organization=self.org,
            session=self.session,
            title="Midterm",
            is_published=False,
            created_by=self.teacher
        )
        AssessmentQuestion.objects.create(
            assessment=self.assessment,
            question=self.q_single,
            order=1,
            points=Decimal("5.00")
        )

    def test_question_bank_and_question_access_control(self):
        """Verify that only teachers/admins can access QuestionBank and Question CRUD views."""
        # 1. Access as student -> Forbidden
        self.client.force_authenticate(user=self.student)
        
        qbank_url = reverse('assessments:questionbank-list')
        response = self.client.get(qbank_url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        q_url = reverse('assessments:question-list')
        response = self.client.get(q_url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Access as teacher -> Succeeded
        self.client.force_authenticate(user=self.teacher)
        
        response = self.client.get(qbank_url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        response = self.client.get(q_url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_assessment_visibility_and_publish_action(self):
        """Verify that students can only see published assessments."""
        # 1. Retrieve list as student (currently unpublished) -> Empty
        self.client.force_authenticate(user=self.student)
        url = reverse('assessments:assessment-list')
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

        # 2. Publish as teacher -> Succeeded
        self.client.force_authenticate(user=self.teacher)
        publish_url = reverse('assessments:assessment-publish', kwargs={'pk': self.assessment.id})
        response = self.client.post(publish_url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 3. Retrieve list as student -> Contains published assessment, correct_answer stripped
        self.client.force_authenticate(user=self.student)
        response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        # correct_answer must not be leaked to the student
        self.assertNotIn("correct_answer", response.data[0]["questions"][0]["question"])

    def test_attempt_lifecycle_and_answer_locking(self):
        """Verify the full lifecycle (Start attempt -> Save answers -> Submit -> Block edits)."""
        # Publish assessment
        self.assessment.is_published = True
        self.assessment.save()

        self.client.force_authenticate(user=self.student)

        # 1. Start submission
        start_url = reverse('assessments:assessment-start', kwargs={'pk': self.assessment.id})
        response = self.client.post(start_url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        submission_id = response.data["id"]
        self.assertEqual(response.data["status"], Submission.Status.STARTED)
        self.assertEqual(len(response.data["answers"]), 1)
        
        answer_id = response.data["answers"][0]["id"]

        # 2. Student updates answer (Autosave)
        ans_url = reverse('assessments:studentanswer-detail', kwargs={'pk': answer_id})
        response = self.client.patch(
            ans_url,
            {"selected_options": ["b"]},
            format='json',
            HTTP_X_ORGANIZATION_SLUG=self.org.slug
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["selected_options"], ["b"])

        # 3. Student submits assessment
        submit_url = reverse('assessments:submission-submit', kwargs={'pk': submission_id})
        response = self.client.post(submit_url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Submission.Status.GRADED)  # choice only -> autograded directly

        # 4. Student tries to edit answer after submission -> Locked, Bad Request
        response = self.client.patch(
            ans_url,
            {"selected_options": ["a"]},
            format='json',
            HTTP_X_ORGANIZATION_SLUG=self.org.slug
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot modify answers of a submitted or graded assessment.", response.data[0])

    def test_unauthorized_cross_tenant_access_and_idor(self):
        """Verify IDOR protections scoping submissions and answers strictly to request user."""
        self.assessment.is_published = True
        self.assessment.save()

        # Student 1 starts submission
        self.client.force_authenticate(user=self.student)
        start_url = reverse('assessments:assessment-start', kwargs={'pk': self.assessment.id})
        response = self.client.post(start_url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        submission_id = response.data["id"]

        # Student 2 tries to access Student 1's submission -> Forbidden (IDOR block)
        self.client.force_authenticate(user=self.other_student)
        sub_url = reverse('assessments:submission-detail', kwargs={'pk': submission_id})
        response = self.client.get(sub_url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_query_optimization_n_plus_one(self):
        """Verify that select_related and prefetch_related optimize assessment queries (ADR-012)."""
        # Publish assessment
        self.assessment.is_published = True
        self.assessment.save()

        self.client.force_authenticate(user=self.student)
        url = reverse('assessments:assessment-list')

        # 1. Warm-up org context and user cached permissions (so we don't count auth DB queries)
        self.client.get(url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)

        # 2. Run query count for 1 assessment
        with self.assertNumQueries(4):
            response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(len(response.data), 1)

        # 3. Create 5 additional assessments with questions to verify query count is constant (not linear)
        for i in range(5):
            extra_asm = Assessment.objects.create(
                organization=self.org,
                title=f"Extra Quiz {i}",
                is_published=True
            )
            AssessmentQuestion.objects.create(
                assessment=extra_asm,
                question=self.q_single,
                order=1,
                points=Decimal("5.00")
            )

        # 4. Verify listing 6 assessments runs the EXACT same number of queries (O(1) database queries)
        with self.assertNumQueries(4):
            response = self.client.get(url, HTTP_X_ORGANIZATION_SLUG=self.org.slug)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(len(response.data), 6)
