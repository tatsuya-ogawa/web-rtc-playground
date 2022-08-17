FROM python:3.9
RUN pip install pipenv
WORKDIR /opt
ADD Pipfile.lock /opt
ADD Pipfile /opt
RUN pipenv install --system