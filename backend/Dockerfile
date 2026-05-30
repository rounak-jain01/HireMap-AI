FROM python:3.10-slim

# Set working directory
WORKDIR /code

# Copy requirements and install
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Hugging Face permissions fix (Create a non-root user)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    TRANSFORMERS_CACHE=/tmp/huggingface_cache

WORKDIR $HOME/app

# Copy all code with proper user ownership
COPY --chown=user . $HOME/app

# Start FastAPI on Hugging Face default port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]