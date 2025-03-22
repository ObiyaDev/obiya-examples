import os
import pytest
from unittest.mock import AsyncMock, MagicMock
from steps.shared.actions import Evaluation, Issue

import importlib.util
spec = importlib.util.spec_from_file_location(
    name="controller",
    location="steps/code_review/controller.step.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
MCTSControllerInput = module.MCTSControllerInput

def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "llm: mark test as requiring real LLM responses"
    )

def pytest_runtest_setup(item):
    """Skip LLM tests unless SPEND=true is set."""
    if "llm" in item.keywords and not os.environ.get("SPEND") == "true":
        pytest.skip("Skipping LLM test because SPEND=true is not set")

@pytest.fixture
def mock_context():
    """Fixture for the context object."""
    context = MagicMock()
    context.logger = MagicMock()
    context.state = AsyncMock()
    context.emit = AsyncMock()
    context.trace_id = "test-trace-id"
    return context

@pytest.fixture
def sample_input():
    """Fixture for sample input data."""
    return MCTSControllerInput(
        prompt="Review this code",
        repo_dir="/path/to/repo",
        branch="main",
        max_iterations=100,
        exploration_constant=1.414,
        max_depth=10,
        requirements="Check code quality",
        output_url=None
    )

@pytest.fixture
def mock_evaluation():
    """Fixture for evaluation result."""
    return Evaluation(
        score=0.8,
        issues=[
            Issue(
                claim="Good code structure",
                grounds="Clear organization",
                warrant="Industry standard practices",
                backing="Best practices in software engineering",
                qualifier="Minor improvements needed"
            )
        ],
        summary="Code is well structured",
        issueSummary="Minor issues found"
    )

@pytest.fixture
def mock_commits():
    """Fixture for commits object with properly mocked async attributes."""
    commits = AsyncMock()
    commits.files = "file1.py\nfile2.py"
    commits.messages = "commit1\ncommit2"
    commits.diff = "diff content"
    return commits 