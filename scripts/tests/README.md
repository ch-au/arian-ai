# Negotiation Service Tests

Comprehensive test suite for the AI negotiation service.

## Setup

### Install Test Dependencies

```bash
# From the scripts/ directory
pip install pytest pytest-cov pytest-asyncio python-dotenv pydantic
```

## Running Tests

### Run All Tests

```bash
cd scripts
pytest
```

### Run Specific Test Categories

```bash
# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# Tests requiring API keys (skipped by default)
pytest -m requires_api
```

### Run Specific Test Files

```bash
# Test utilities only
pytest tests/test_negotiation_utils.py

# Test models only
pytest tests/test_negotiation_models.py
```

### Run with Coverage

```bash
# Generate coverage report
pytest --cov=. --cov-report=html

# View coverage report
open htmlcov/index.html  # macOS
# or
xdg-open htmlcov/index.html  # Linux
```

### Verbose Output

```bash
# See detailed test output
pytest -v

# See print statements
pytest -s

# Both
pytest -vs
```

## Test Structure

```
tests/
├── __init__.py
├── test_negotiation_models.py    # Pydantic model tests
├── test_negotiation_utils.py     # Utility function tests
└── README.md                      # This file
```

## Test Categories

### Unit Tests (`@pytest.mark.unit`)
- Fast, isolated tests
- No external dependencies
- Test individual functions/methods

### Integration Tests (`@pytest.mark.integration`)
- Test multiple components together
- May use mocked external services
- Test workflows and interactions

### API Tests (`@pytest.mark.requires_api`)
- Require actual API keys
- Test real OpenAI/Langfuse integration
- Skipped by default (use `pytest -m requires_api` to run)

## Writing New Tests

### Test Naming Convention

```python
class TestFeatureName:
    """Tests for FeatureName."""

    @pytest.mark.unit
    def test_specific_behavior(self):
        """Test that specific behavior works correctly."""
        # Arrange
        input_data = {...}

        # Act
        result = function_to_test(input_data)

        # Assert
        assert result == expected_value
```

### Using Fixtures

```python
@pytest.fixture
def sample_dimensions():
    """Provide sample dimension data for tests."""
    return [
        {"name": "Price", "minValue": 1000, "maxValue": 5000},
        {"name": "Delivery", "minValue": 7, "maxValue": 45}
    ]

def test_with_fixture(sample_dimensions):
    """Use fixture in test."""
    result = format_dimensions_for_prompt(sample_dimensions)
    assert "Price" in result
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    cd scripts
    pytest --cov=. --cov-report=xml
```

## Troubleshooting

### Import Errors

If you see `ModuleNotFoundError`:
```bash
# Make sure you're in the scripts/ directory
cd scripts
python -m pytest
```

### Environment Variables

Some tests may need environment variables:
```bash
export OPENAI_API_KEY="your-key"
export LANGFUSE_PUBLIC_KEY="your-key"
export LANGFUSE_SECRET_KEY="your-key"
pytest
```

Or use a `.env` file in the scripts/ directory.

## Coverage Goals

- **Target**: 80%+ coverage for critical code paths
- **Current Status**: Run `pytest --cov` to see current coverage

## Next Steps

1. Add more integration tests for the main service class
2. Add mock tests for external API calls
3. Add property-based tests with `hypothesis`
4. Add performance benchmarks
