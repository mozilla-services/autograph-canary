# Define custom function directory
ARG FUNCTION_DIR="/function"

FROM python:3.8-buster as build-image
ENV DEBIAN_FRONTEND=noninteractive

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# Install aws-lambda-cpp build dependencies and curl to download Fx
RUN apt-get update && \
  apt-get install -y \
  g++ \
  make \
  cmake \
  unzip \
  libcurl4-openssl-dev \
  curl

RUN mkdir -p ${FUNCTION_DIR}/tests ${FUNCTION_DIR}/firefox && \
    cd ${FUNCTION_DIR}/firefox && \
    curl -sSf -o - --proto '=https' --tlsv1.2 -L 'https://download.mozilla.org/?product=firefox-nightly-latest&os=linux64&lang=en-US' | \
    tar xvjf -

ADD requirements.txt ${FUNCTION_DIR}

# Install the function's dependencies
RUN pip install -U pip \
    && pip install --target ${FUNCTION_DIR} -r ${FUNCTION_DIR}/requirements.txt

# add function code
ADD autograph.py ${FUNCTION_DIR}
COPY tests ${FUNCTION_DIR}/tests
COPY bin ${FUNCTION_DIR}/bin

FROM python:3.8-buster
ENV DEBIAN_FRONTEND=noninteractive

# aws cli env vars
ENV AWS_ACCESS_KEY_ID=
ENV AWS_SECRET_ACCESS_KEY=
ENV AWS_DEFAULT_REGION=
ENV AWS_REGION=
ENV AWS_PROFILE=
ENV AWS_SESSION_TOKEN=

# run firefox in headless mode
ENV MOZ_HEADLESS=1
# avoid segfault on prctl(PR_SET_SECCOMP
ENV MOZ_FAKE_NO_SANDBOX=1

ENV CANARY_LOG_LEVEL=debug
ENV TEST_FILES_GLOB="*_test.js"
ENV XPI_ENV="prod"
ENV XPI_URLS="https://addons.mozilla.org/firefox/downloads/file/3772109/facebook_container-2.2.1-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3713375/firefox_multi_account_containers-7.3.0-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3768975/ublock_origin-1.35.2-an+fx.xpi"
ENV CSIG_ENV="prod"
ENV CSIG_COLLECTIONS="security-state/onecrl"

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# install fx release w/ deps
RUN apt-get update \
    && echo 'deb http://deb.debian.org/debian unstable main' > /etc/apt/sources.list.d/unstable.list \
    && apt update \
    && apt-get install -y -t unstable firefox

# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

# add version.json for dockerflow
RUN mkdir -p /app/
ADD version.json /app/

# Copy in the built dependencies
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

CMD [ "/usr/local/bin/python", "autograph.py" ]
