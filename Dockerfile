# Define custom function directory
ARG FUNCTION_DIR="/function"

FROM python:3.8-buster as build-image
ENV DEBIAN_FRONTEND=noninteractive

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# Install aws-lambda-cpp build dependencies
RUN apt-get update && \
  apt-get install -y \
  g++ \
  make \
  cmake \
  unzip \
  libcurl4-openssl-dev

RUN mkdir -p ${FUNCTION_DIR}/tests

ADD requirements.txt ${FUNCTION_DIR}
ADD autograph.py ${FUNCTION_DIR}
COPY tests ${FUNCTION_DIR}/tests

# Install the function's dependencies
RUN pip install --target ${FUNCTION_DIR} --pre -r ${FUNCTION_DIR}/requirements.txt

# Install the function's dependencies
RUN pip install --target ${FUNCTION_DIR} awslambdaric


FROM python:3.8-buster
ENV DEBIAN_FRONTEND=noninteractive

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# install fx release w/ deps and 7zip for tls-canary
RUN apt-get update \
    && echo 'deb http://deb.debian.org/debian unstable main' > /etc/apt/sources.list.d/unstable.list \
    && apt update \
    && apt-get install -y -t unstable firefox \
    && apt-get install -y p7zip-full

# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

# Copy in the built dependencies
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

CMD [ "/usr/local/bin/python", "autograph.py" ]
